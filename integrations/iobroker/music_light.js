// ioBroker JavaScript: music light (openspec add-music-ambient-light). The house is split into zones
// (the ground floor and the children's rooms), each with its Sonos room(s) and its colour lamps. While a
// zone plays music (javascript.0.music_zones, published by musik_v2.js without TV sound and audiobooks)
// and its pill in the Musik band is on, its lamps go to a music scene; the moment that zone's music
// stops or its pill goes off, its lamps return exactly to their state before the music.
//
// The zones are configured privately on the Pi in ZONES_ID (label, Sonos rooms, lamps); the repo only
// holds the ground floor as a default. Only colour lamps take part (owner, 2026-11-21).
// Stage 1 scene: warm and dimmed. Later stages derive it from genre, cover colours and tempo.
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
    lamps: ['hue.0.Küchenlicht', 'hue.0.Hue_Play_wall_washer_1', 'hue.0.Hue_Play_wall_washer_2']
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
function playing(key) { var m = json(MUSIC_ID, {}); return !!(m[key] && m[key].playing === true); }
function coverArt(key) { var m = json(MUSIC_ID, {}); return m[key] && m[key].art; }
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
var CYCLE_MS = 15000;          // one step per lamp; stage 4 derives it from the tempo
var DRIFT = 80;                // transition per colour change, tenths of a second
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
function weightedCycle(palette, slots) {
    var seq = [];
    palette.forEach(function (c, base) {
        for (var i = 0, n = Math.max(1, Math.round(c.share * slots)); i < n; i++) {
            var shade = SHADES[i % SHADES.length];
            seq.push({ xy: rgbToXy(rotateHue(c.rgb, shade.hue)), bri: Math.round(SCENE.bri * shade.bri), base: base });
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
var paletteCache = {};   // cover URL → palette (rgb + share), [] when the cover has no colour
function coverColours(url, cb) {
    if (paletteCache[url]) { cb(paletteCache[url]); return; }
    fetchBuffer(url, function (err, buf) {
        var palette = [];
        if (!err) {
            try {
                palette = coverPalette(require('jpeg-js').decode(buf, { useTArray: true, maxResolutionInMP: 4 }));
            } catch (e) { palette = []; }
        }
        if (!err) paletteCache[url] = palette;
        cb(palette);
    });
}

// zone key → {art, cycle: [{xy, bri, base}…], pos, sent: {lamp: "xy@bri"}}
var cycling = {};
function followCover(zone, art) {
    var c = cycling[zone.key] || (cycling[zone.key] = { pos: 0, sent: {} });
    if (c.art === art) return;
    c.art = art;
    c.cycle = [];
    if (!art) return;
    coverColours(art, function (palette) {
        if (c.art === art) c.cycle = weightedCycle(palette, CYCLE_SLOTS);
    });
}
function stepColours() {
    var snapshots = json(SNAPSHOT_ID, {});
    zones().forEach(function (zone) {
        var c = cycling[zone.key];
        if (!c || !c.cycle || !c.cycle.length || !snapshots[zone.key]) return;
        c.pos++;
        // all lamps of a zone show the same shade at the same time (owner, 2026-11-21)
        var shade = c.cycle[c.pos % c.cycle.length], key = shade.xy + '@' + shade.bri;
        zoneLamps(zone, snapshots[zone.key]).forEach(function (id) {
            if (c.sent[id] === key) return;
            c.sent[id] = key;
            command(id, { bri: shade.bri, xy: shade.xy, transitiontime: DRIFT });
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
    var snapshots = json(SNAPSHOT_ID, {}), changed = false;
    zones().forEach(function (zone) {
        var want = !switchedOff(zone.key) && playing(zone.key);
        if (want && !snapshots[zone.key]) { snapshots[zone.key] = startScene(zone); changed = true; }
        else if (!want && snapshots[zone.key]) { restore(zone, snapshots[zone.key]); delete snapshots[zone.key]; changed = true; }
        if (want) followCover(zone, coverArt(zone.key));
        else delete cycling[zone.key];
    });
    if (changed) setState(SNAPSHOT_ID, JSON.stringify(snapshots), true);
}

createState(ZONES_ID, JSON.stringify(DEFAULT_ZONES), { type: 'string', role: 'json', desc: 'Musiklicht: Zonen (Sonos-Räume, Farblampen), privat auf dem Pi' });
createState(SNAPSHOT_ID, '{}', { type: 'string', role: 'json', desc: 'Musiklicht: Lampenzustand vor der Musik je Zone' });
on({ id: MUSIC_ID, change: 'ne' }, evaluate);
on({ id: OFF_ID, change: 'ne' }, evaluate);
evaluate();
setInterval(stepColours, CYCLE_MS);

console.log('[music_light] initialized');
