// ioBroker JavaScript: music light (openspec add-music-ambient-light). The house is split into zones
// (the ground floor and the children's rooms), each with its Sonos room(s) and its colour lamps. While a
// zone plays music (javascript.0.music_zones, published by musik_v2.js without TV sound and audiobooks)
// and its pill in the Musik band is on, its lamps go to a music scene; the moment that zone's music
// stops or its pill goes off, its lamps return exactly to their state before the music.
//
// The zones are configured privately on the Pi in ZONES_ID (label, Sonos rooms, lamps); the repo only
// holds the ground floor as a default. Only colour lamps take part (owner, 2026-11-21).
// The scene starts warm and dimmed, then drifts through the cover's colours at the track's tempo, with
// the genre and the volume setting the brightness.
//
// The hue adapter takes a JSON command per lamp: bri 0-254 (>0 switches on), ct in Kelvin, xy as
// "x,y", on:false switches off, transitiontime in tenths of a second.

var ZONES_ID = 'javascript.0.music_light_zones';
var MUSIC_ID = 'javascript.0.music_zones';
var OFF_ID = 'javascript.0.music_light_off';
// zone key → lamp → state before the music, persisted so a restart during a song still restores
var SNAPSHOT_ID = 'javascript.0.music_light_snapshot';
var DEFAULT_ZONES = [{
    key: 'eg', label: 'EG', rooms: ['Wohnzimmer', 'Küche', 'Fernsehzimmer'],
    lamps: ['hue.0.Küchenlicht', 'hue.0.TV-Licht_links', 'hue.0.TV-Licht_rechts']
}];
var FADE = 20;
var SCENE = { bri: 90, ct: 2200, transitiontime: FADE };

// existsState first: getState on a missing state logs a warning (createState is asynchronous, so on
// the first start the states do not exist yet)
function val(id) {
    if (!existsState(id)) return null;
    var s = getState(id);
    return s ? s.val : null;
}
function json(id, fallback) {
    try { return JSON.parse(val(id) || 'null') || fallback; } catch (e) { return fallback; }
}
function zones() { var z = json(ZONES_ID, []); return Array.isArray(z) ? z : []; }
function switchedOff(key) { var o = json(OFF_ID, []); return Array.isArray(o) && o.indexOf(key) >= 0; }
function command(id, cmd) { setState(id + '.command', JSON.stringify(cmd)); }

function lampState(id) {
    return { on: val(id + '.on') === true, bri: val(id + '.bri'), ct: val(id + '.ct'), xy: val(id + '.xy'), colormode: val(id + '.colormode') };
}
function restoreCommand(s) {
    if (!s.on) return { on: false, transitiontime: FADE };
    var cmd = { bri: s.bri, transitiontime: FADE };
    if (s.colormode === 'ct' && s.ct != null) cmd.ct = s.ct;
    else if (s.xy != null) cmd.xy = s.xy;
    return cmd;
}

// ===== cover colours (stage 3): the scene drifts through the album cover's palette =====
var TICK_MS = 1000;            // the cycle timer; each zone steps at its own pace (paceSeconds)
var CYCLE_SLOTS = 12;          // a cycle holds each colour for its share of these slots
var MAX_COVER_BYTES = 3000000;
var MAX_PALETTE = 5;

// Up to MAX_PALETTE colours of an RGBA image with their share, largest first. Near-black, white and grey
// pixels (background, text) do not count; colours are grouped by hue in 30° bins.
function coverPalette(img) {
    var bins = {}, total = 0, step = Math.max(1, Math.floor(img.width * img.height / 6000));
    for (var p = 0; p < img.width * img.height; p += step) {
        var r = img.data[p * 4], g = img.data[p * 4 + 1], b = img.data[p * 4 + 2];
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max < 40 || (max - min) / max < 0.2) continue;
        var h = hueOf(r, g, b, max, min), key = Math.floor(h / 30) % 12;
        var bin = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
        bin.n++; bin.r += r; bin.g += g; bin.b += b; total++;
    }
    if (!total) return [];
    var colours = Object.keys(bins).map(function (k) {
        var bin = bins[k];
        return { rgb: saturated([bin.r / bin.n, bin.g / bin.n, bin.b / bin.n]), share: bin.n / total };
    }).sort(function (a, c) { return c.share - a.share; });
    return mergeNear(colours).filter(function (c) { return c.share >= 0.04; }).slice(0, MAX_PALETTE);
}
// Colours the lamps cannot tell apart (two blues of one cover) merge into the larger one, so the cycle
// only alternates between colours that look different (owner: the blue did not seem to change).
var SAME_COLOUR_XY = 0.04;
function mergeNear(colours) {
    var kept = [];
    colours.forEach(function (c) {
        var xy = rgbToXy(c.rgb).split(',').map(Number);
        var twin = kept.filter(function (k) { return Math.hypot(k.xy[0] - xy[0], k.xy[1] - xy[1]) < SAME_COLOUR_XY; })[0];
        if (twin) twin.share += c.share;
        else kept.push({ rgb: c.rgb, share: c.share, xy: xy });
    });
    return kept.map(function (k) { return { rgb: k.rgb, share: k.share }; });
}
function hueOf(r, g, b, max, min) {
    var d = max - min, h;
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    return (h * 60 + 360) % 360;
}
// washed-out cover colours look grey as light: lift the saturation to at least 55 %, full brightness
function saturated(rgb) {
    var max = Math.max.apply(null, rgb), min = Math.min.apply(null, rgb);
    var s = Math.max((max - min) / max, 0.55);
    return rgb.map(function (c) { return Math.round(255 * (1 - s * (max - c) / (max - min || 1))); });
}
// sRGB → CIE xy (Hue's wide-gamut conversion), as the hue adapter's "x,y" string
function rgbToXy(rgb) {
    var lin = rgb.map(function (c) { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; });
    var X = lin[0] * 0.664511 + lin[1] * 0.154324 + lin[2] * 0.162028;
    var Y = lin[0] * 0.283881 + lin[1] * 0.668433 + lin[2] * 0.047685;
    var Z = lin[0] * 0.000088 + lin[1] * 0.072310 + lin[2] * 0.986039;
    var sum = X + Y + Z || 1;
    return (X / sum).toFixed(4) + ',' + (Y / sum).toFixed(4);
}
// The cycle: each colour holds slots in proportion to its share (at least one), and while it is held it
// drifts through related shades, a neighbouring hue and a little brighter or darker, so even a
// single-colour cover keeps moving. Entries: {xy, bri, base: index of the palette colour}.
var SHADES = [{ hue: 0, bri: 1 }, { hue: 15, bri: 1.25 }, { hue: 0, bri: 0.85 }, { hue: -15, bri: 1.15 }];
function weightedCycle(palette, slots, briBase) {
    var base = briBase || SCENE.bri;
    var seq = [];
    palette.forEach(function (c, index) {
        for (var i = 0, n = Math.max(1, Math.round(c.share * slots)); i < n; i++) {
            var shade = SHADES[i % SHADES.length];
            seq.push({ xy: rgbToXy(rotateHue(c.rgb, shade.hue)), bri: Math.max(20, Math.min(230, Math.round(base * shade.bri))), base: index });
        }
    });
    return seq;
}
function rotateHue(rgb, deg) {
    if (!deg) return rgb;
    var max = Math.max.apply(null, rgb), min = Math.min.apply(null, rgb);
    if (max === min) return rgb;
    var h = (hueOf(rgb[0], rgb[1], rgb[2], max, min) + deg + 360) % 360, s = (max - min) / max, v = max;
    var f = function (n) { var k = (n + h / 60) % 6; return Math.round(v - v * s * Math.max(0, Math.min(k, 4 - k, 1))); };
    return [f(5), f(3), f(1)];
}

function fetchBuffer(url, cb) {
    var chunks = [], size = 0, done = false;
    function finish(err, buf) { if (!done) { done = true; cb(err, buf); } }
    var req = require(url.indexOf('https:') === 0 ? 'https' : 'http').get(url, { timeout: 5000 }, function (res) {
        if (res.statusCode !== 200) { res.resume(); finish(new Error('HTTP ' + res.statusCode)); return; }
        res.on('data', function (c) {
            size += c.length;
            if (size > MAX_COVER_BYTES) { finish(new Error('cover too large')); req.destroy(); return; }
            chunks.push(c);
        });
        res.on('end', function () { finish(null, Buffer.concat(chunks)); });
    });
    req.on('error', finish);
    req.on('timeout', function () { finish(new Error('timeout')); req.destroy(); });
}
function fetchJson(url, cb) {
    fetchBuffer(url, function (err, buf) {
        if (err) { cb(null); return; }
        try { cb(JSON.parse(buf.toString())); } catch (e) { cb(null); }
    });
}

// ===== genre (stage 2) and tempo (stage 4) =====
// Both come from Deezer, looked up once per track: the album's genres set the character (brightness
// factor, and the pace when the track has no tempo), the track's BPM sets the pace. MusicBrainz was the
// first choice for genres but is unreachable over the Pi's IPv6 and throttles hard over IPv4 (2026-11-21).
// An audiobook genre anywhere in the list means no music light; otherwise the first genre that matches
// decides (Deezer lists the album's main genre first).
var SPOKEN_WORDS = ['spoken word', 'audiobook', 'audio drama', 'hörspiel', 'hörb'];
var GENRES = [
    { words: ['classical', 'klassik', 'ambient', 'jazz', 'soundtrack', 'score', 'film', 'acoustic', 'folk', 'lullaby', 'new age', 'piano', 'chill'], bri: 0.8, pace: 20 },
    { words: ['techno', 'electro', 'dance', 'house', 'edm', 'trance', 'disco', 'drum and bass', 'dubstep', 'hip hop', 'rap', 'rock', 'metal', 'punk'], bri: 1.25, pace: 10 },
    { words: ['kids', 'kinder', 'children'], bri: 1.15, pace: 12 }
];
var NEUTRAL = { bri: 1, pace: 15 };
function lowerTags(tags) { return (tags || []).map(function (t) { return String(t).toLowerCase(); }); }
function hasWord(tag, words) { return words.some(function (w) { return tag.indexOf(w) >= 0; }); }
function isSpokenWord(tags) { return lowerTags(tags).some(function (t) { return hasWord(t, SPOKEN_WORDS); }); }
function genreCharacter(tags) {
    var lower = lowerTags(tags);
    for (var t = 0; t < lower.length; t++) {
        for (var g = 0; g < GENRES.length; g++) if (hasWord(lower[t], GENRES[g].words)) return GENRES[g];
    }
    return NEUTRAL;
}
// "A, B & C feat. D" → "A": the first named artist finds the track
function firstArtist(name) { return String(name || '').split(/\s*(?:,|&|\bfeat\.?|\bft\.|\bx\b)\s*/i)[0].trim(); }
// seconds per colour step: from the tempo (1200/BPM, 120 BPM = 10 s), else the genre's pace
var MIN_STEP_S = 4, MAX_STEP_S = 25;
function paceSeconds(bpm, character) {
    if (bpm > 0) return Math.max(MIN_STEP_S, Math.min(MAX_STEP_S, Math.round(1200 / bpm)));
    return character.pace;
}
// quiet music dims the light: 0 % volume = 0.7, 50 % = 1, 100 % = 1.3
function volumeFactor(vol) { return typeof vol === 'number' ? 0.7 + 0.6 * Math.max(0, Math.min(100, vol)) / 100 : 1; }

// track → {bpm, tags}: Deezer search (artist + title), then the track (BPM) and its album (genres)
function lookupTrack(artist, title, cb) {
    fetchJson('https://api.deezer.com/search?q=' + encodeURIComponent(artist + ' ' + title) + '&limit=1', function (body) {
        var hit = body && body.data && body.data[0];
        if (!hit) { cb({ bpm: 0, tags: [] }); return; }
        fetchJson('https://api.deezer.com/track/' + encodeURIComponent(hit.id), function (track) {
            var bpm = (track && track.bpm) || 0;
            if (!hit.album) { cb({ bpm: bpm, tags: [] }); return; }
            fetchJson('https://api.deezer.com/album/' + encodeURIComponent(hit.album.id), function (album) {
                var tags = ((album && album.genres && album.genres.data) || []).map(function (g) { return g.name; });
                cb({ bpm: bpm, tags: tags });
            });
        });
    });
}

// Lookups run once per key; the answer lands in its cache and re-evaluates the zones. A failed lookup is
// cached as "no data" too, so a dead service is not asked again on every poll.
var paletteCache = {}, trackCache = {}, pending = {};
function lookupOnce(cache, key, fetcher) {
    if (!key || key in cache || pending[key]) return;
    pending[key] = true;
    fetcher(function (value) { cache[key] = value; delete pending[key]; evaluate(); });
}
function coverLookup(url) {
    return function (done) {
        fetchBuffer(url, function (err, buf) {
            var palette = [];
            if (!err) {
                try { palette = coverPalette(require('jpeg-js').decode(buf, { useTArray: true, maxResolutionInMP: 4 })); } catch (e) { palette = []; }
            }
            done(palette);
        });
    };
}
function startLookups(music) {
    var artist = firstArtist(music.artist);
    lookupOnce(paletteCache, music.art, coverLookup(music.art));
    lookupOnce(paletteCache, music.nextArt, coverLookup(music.nextArt));   // ready at the track switch
    if (music.title) lookupOnce(trackCache, artist + '|' + music.title, function (done) { lookupTrack(artist, music.title, done); });
}
function trackInfo(music) { return trackCache[firstArtist(music.artist) + '|' + music.title]; }
function isSpoken(music) {
    var info = trackInfo(music);
    return !!(info && isSpokenWord(info.tags));
}

// zone key → {cycle: [{xy, bri, base}…], pace, inputs, pos, wait}
var cycling = {};
function followMusic(zone, music) {
    var c = cycling[zone.key] || (cycling[zone.key] = { pos: 0, wait: 0 });
    var info = trackInfo(music);
    var character = genreCharacter(info && info.tags);
    var palette = paletteCache[music.art] || [];
    var briBase = SCENE.bri * character.bri * volumeFactor(music.vol);
    var inputs = [music.art, palette.length, Math.round(briBase)].join('|');
    if (c.inputs !== inputs) { c.inputs = inputs; c.cycle = weightedCycle(palette, CYCLE_SLOTS, briBase); }
    c.pace = paceSeconds(info ? info.bpm : 0, character);
}
// called every second; each zone steps at its own pace
function stepColours() {
    if (!Object.keys(cycling).length) return;
    var snapshots = json(SNAPSHOT_ID, {});
    zones().forEach(function (zone) {
        var c = cycling[zone.key];
        if (!c || !c.cycle || !c.cycle.length || !snapshots[zone.key]) return;
        if (c.wait > 0) { c.wait--; return; }
        c.wait = c.pace - 1;
        c.pos++;
        // all lamps of a zone show the same shade at the same time (owner, 2026-11-21)
        var shade = c.cycle[c.pos % c.cycle.length];
        var fade = Math.round(c.pace * 10 * 0.6);
        zoneLamps(zone, snapshots[zone.key]).forEach(function (id) {
            command(id, { bri: shade.bri, xy: shade.xy, transitiontime: fade });
        });
    });
}

function startScene(zone) {
    var snapshot = {};
    (zone.lamps || []).forEach(function (id) {
        if (val(id + '.reachable') === true) snapshot[id] = lampState(id);   // no power: skip
    });
    Object.keys(snapshot).forEach(function (id) { command(id, SCENE); });
    return snapshot;
}
// Only lamps the zone still lists are ever commanded: a lamp that left the zone (the dining table,
// 2026-11-21) is not touched again, even if an older snapshot still holds it.
function zoneLamps(zone, snapshot) {
    return Object.keys(snapshot).filter(function (id) { return (zone.lamps || []).indexOf(id) >= 0; });
}
function restore(zone, snapshot) {
    zoneLamps(zone, snapshot).forEach(function (id) { command(id, restoreCommand(snapshot[id])); });
}
function evaluate() {
    var music = json(MUSIC_ID, {});
    // lookups first: an answer that arrives at once re-evaluates before this run reads the snapshots
    zones().forEach(function (zone) { if (music[zone.key] && music[zone.key].playing) startLookups(music[zone.key]); });
    var snapshots = json(SNAPSHOT_ID, {}), changed = false;
    zones().forEach(function (zone) {
        var m = music[zone.key] || {};
        var want = !switchedOff(zone.key) && m.playing === true && !isSpoken(m);
        if (want && !snapshots[zone.key]) { snapshots[zone.key] = startScene(zone); changed = true; }
        else if (!want && snapshots[zone.key]) { restore(zone, snapshots[zone.key]); delete snapshots[zone.key]; changed = true; }
        if (want) followMusic(zone, m);
        else delete cycling[zone.key];
    });
    if (changed) setState(SNAPSHOT_ID, JSON.stringify(snapshots), true);
}

createState(ZONES_ID, JSON.stringify(DEFAULT_ZONES), { type: 'string', role: 'json', desc: 'Musiklicht: Zonen (Sonos-Räume, Farblampen), privat auf dem Pi' });
createState(SNAPSHOT_ID, '{}', { type: 'string', role: 'json', desc: 'Musiklicht: Lampenzustand vor der Musik je Zone' });
on({ id: MUSIC_ID, change: 'ne' }, evaluate);
on({ id: OFF_ID, change: 'ne' }, evaluate);
evaluate();
setInterval(stepColours, TICK_MS);

console.log('[music_light] initialized');
