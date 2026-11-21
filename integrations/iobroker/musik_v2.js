// ioBroker JavaScript: Musik band (Sonos) — driven by the Sonos HTTP API (jishi,
// node-sonos-http-api on localhost:5005), because the native iobroker.sonos adapter can't group
// this (S2) system (HTTP 500). jishi gives correct live room names, state, and working grouping.
//
// Rendered as the bottom band of the Steuerung view (widget at 4,364 — the standalone Musik tab
// is gone): compact 4×2 room-card grid (now-playing + play/pause + volume ±) with the preset
// group buttons (Alle/Wohnen/Einzeln) in the header row.
// HTML/CSS is display-only → native i-vis-universal overlays write to javascript.0.musik_cmd; this
// script polls /zones for state and turns commands into jishi HTTP calls.

var http = require('http');
var API = { host: '127.0.0.1', port: 5005 };
function jget(path, cb) {
    http.get({ host: API.host, port: API.port, path: encodeURI(path), timeout: 4000 }, function (res) {
        var d = ''; res.on('data', function (c) { d += c; }); res.on('end', function () { cb && cb(null, d); });
    }).on('error', function (e) { cb && cb(e); }).on('timeout', function () { cb && cb(new Error('timeout')); });
}

var W = 1170, H = 320, PADX = 4;

var CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');
.mv2{
  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;
  --text:#CCCCCC; --muted:#8A8A8A; --mute:#7F8A99;
  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;
  --green-16:rgba(181,251,91,.16); --blue-16:rgba(80,128,172,.16); --muted-16:rgba(138,138,138,.16);
  --r2:14px; --r3:12px;
  box-sizing:border-box; background:var(--bg);
  font-family:'Figtree',system-ui,sans-serif; color:var(--text);
  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;
}
.mv2 *{margin:0; padding:0; box-sizing:border-box}
.mv2 .wrap{position:relative; width:${W}px; height:${H}px}
.mv2 .seccard{position:absolute; background:var(--surface); border:1px solid var(--border); border-radius:var(--r2)}
.mv2 .card-h{position:absolute; font-size:14px; font-weight:700; letter-spacing:.06em; color:var(--muted); text-transform:uppercase}
.mv2 .gbtn{position:absolute; background:var(--bg); border:1px solid var(--border); border-radius:var(--r3); display:flex; align-items:center; justify-content:center; gap:8px; font-size:15px; font-weight:600}
/* compact room card (278×122): head row + now-playing lines + absolute control row at the bottom */
.mv2 .room{position:absolute; background:var(--bg); border:1px solid var(--border); border-radius:var(--r3); padding:10px 12px; overflow:hidden}
.mv2 .room.playing{border-color:rgba(181,251,91,.4)}
.mv2 .rhead{display:flex; align-items:center; gap:8px}
.mv2 .room .disc{width:30px; height:30px; border-radius:50%; background:var(--inset); flex:none; display:flex; align-items:center; justify-content:center}
.mv2 .room.playing .disc{background:var(--green-16)}
.mv2 .room .nm{font-size:15px; font-weight:600; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .ti{margin-top:5px; font-size:12px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .ar{margin-top:2px; font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .grp{color:var(--blue)}
.mv2 .room .pp{position:absolute; width:38px; height:38px; border-radius:50%; background:var(--inset); display:flex; align-items:center; justify-content:center}
.mv2 .room .pp.ghost{background:transparent; border:1px dashed var(--border)}
.mv2 .room.off{opacity:.45}
.mv2 .room .stt{font-size:12px; color:var(--muted); flex:none}
.mv2 .room .stt.on{color:var(--green)}
.mv2 .gbtn.on{border-color:rgba(181,251,91,.4); background:var(--green-16)}
/* "Effekt aktiv" (design system): a music-light pill whose zone is on gets a frame in the effect gradient */
.mv2 .gbtn.fx{border:1px solid transparent; background:linear-gradient(var(--bg),var(--bg)) padding-box, linear-gradient(90deg,${VC_PAL.effect.join(',')}) border-box}
.mv2 .room.playing .pp{background:var(--green-16)}
.mv2 .room .vb{position:absolute; width:42px; height:34px; border-radius:10px; background:var(--inset); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; color:var(--text)}
.mv2 .room .vol{position:absolute; width:36px; height:34px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:14px; color:var(--text); font-weight:600}
.mv2 .room .vbar{display:block; width:28px; height:3px; border-radius:2px; background:var(--inset); overflow:hidden}
.mv2 .room .vbar>span{display:block; height:3px; background:var(--muted)}
`;

var GREEN = VC_PAL.good, LBL = VC_PAL.muted;
// live Sonos room names (from jishi /zones), fixed order for a stable layout
var ROOMS = ['Fernsehzimmer', 'Küche', 'Wohnzimmer', 'Sauna', 'Bad', 'Claras Zimmer', 'Carlottas Zimmer', 'Studio'];
var COORD = 'Wohnzimmer';                         // preset group coordinator
var WOHNEN = ['Küche', 'Fernsehzimmer'];          // joined to COORD for "Wohnen"
var ZONES = {};                                   // roomName -> {vol, play, title, artist, coord}
// TV-room soundbars reject standalone transport (play/pause/seek all HTTP 500) — show volume + group
// only, no play button. Seeded with the known one; auto-learned if any other room rejects play too.
var TV = { 'Fernsehzimmer': true };
// music light (music_light.js): zones (label, Sonos rooms, lamps) are configured privately on the Pi in
// LIGHT_ZONES_ID; LIGHT_OFF_ID lists the keys of zones switched off, so a zone is on unless switched off
var LIGHT_ZONES_ID = 'javascript.0.music_light_zones';
var LIGHT_OFF_ID = 'javascript.0.music_light_off';
var AUDIOBOOK_ARTISTS_ID = 'javascript.0.music_light_audiobook_artists';
var MAX_LIGHT_PILLS = 4;   // the header has room for four, each with its fixed overlay slot
function jsonState(id, fallback) {
    if (!existsState(id)) return fallback;
    var s = getState(id);
    try { return JSON.parse((s && s.val) || 'null') || fallback; } catch (e) { return fallback; }
}
function lightZones() {
    var z = jsonState(LIGHT_ZONES_ID, []);
    return Array.isArray(z) ? z.slice(0, MAX_LIGHT_PILLS) : [];
}
function lightOff() { var o = jsonState(LIGHT_OFF_ID, []); return Array.isArray(o) ? o : []; }

var esc = vcEsc;
function clip(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n - 1) + '…' : s); }
function rnd(o) { return { kind: o.kind, oid: o.oid, value: o.value, x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w), h: Math.round(o.h) }; }

function icoPlay(c) { return '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 4 L19 12 L7 20 Z" fill="' + c + '"/></svg>'; }
function icoPause(c) { return '<svg width="18" height="18" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" fill="' + c + '"/><rect x="14" y="4" width="4" height="16" rx="1" fill="' + c + '"/></svg>'; }
function icoSpeaker(c) { return '<svg width="18" height="18" viewBox="0 0 24 24"><g fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><circle cx="12" cy="15" r="3.4"/><circle cx="12" cy="6.5" r="1"/></g></svg>'; }
function icoStop(c) { return '<svg width="20" height="20" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2.5" fill="' + c + '"/></svg>'; }
// sparkle for the music-light pills: the "Effekt aktiv" gradient when on, plain grey when off
// (each pill gets its own gradient id, as all pills share one document)
function icoSparkle(on, i) {
    var id = 'mlfx' + i, stops = VC_PAL.effect;
    var defs = on ? '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' + stops.map(function (c, k) {
        return '<stop offset="' + (k / (stops.length - 1)) + '" stop-color="' + c + '"/>';
    }).join('') + '</linearGradient></defs>' : '';
    return '<svg width="20" height="20" viewBox="0 0 24 24">' + defs + '<g fill="' + (on ? 'url(#' + id + ')' : LBL) + '">'
        + '<path d="M11 3 L12.9 9.1 L19 11 L12.9 12.9 L11 19 L9.1 12.9 L3 11 L9.1 9.1 Z"/>'
        + '<path d="M19 2.5 l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>'
        + '<path d="M18.5 15.5 l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/></g></svg>';
}
function icoLink(c) { return '<svg width="20" height="20" viewBox="0 0 24 24"><g fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round"><path d="M9 12 h6"/><path d="M8 8 H6 a4 4 0 0 0 0 8 h2"/><path d="M16 8 h2 a4 4 0 0 1 0 8 h-2"/></g></svg>'; }

// a room missing from the Sonos /zones answer is offline (speaker unplugged or unreachable)
function roomCard(room, x, y, w, h) {
    var offline = !ZONES[room];
    var z = ZONES[room] || {};
    var isTV = !!TV[room];                         // TV soundbar: no standalone play, volume + group only
    var playing = !!z.play;
    var vol = (typeof z.vol === 'number') ? z.vol : null;
    var grouped = z.coord && z.coord !== room;
    var idle = offline ? '–' : (isTV ? 'TV · nur Lautstärke' : (z.coord ? (z.stopped ? 'gestoppt' : 'pausiert') : '–'));
    var stt = offline ? '<span class="stt">offline</span>' : (playing ? '<span class="stt on">spielt</span>' : '');
    var grp = grouped ? '<span class="grp">↪ ' + esc(z.coord) + '</span>' : '';
    var ti = playing ? clip(z.title, 34) : esc(idle);
    var ar = playing && z.artist ? clip(z.artist, 28) + (grouped ? ' &#160;' + grp : '') : grp;
    // control row pinned to the card bottom; positions are relative to the (absolute) card
    var vbY = h - 10 - 34, ppY = h - 10 - 38, ppX = w - 12 - 38;
    var html = '<div class="room' + (playing ? ' playing' : '') + (offline ? ' off' : '') + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px">'
        + '<div class="rhead"><div class="disc">' + icoSpeaker(playing ? GREEN : LBL) + '</div><span class="nm">' + esc(room) + '</span>' + stt + '</div>'
        + '<div class="ti">' + ti + '</div>'
        + '<div class="ar">' + (ar || '&#160;') + '</div>'
        + '<span class="vb" style="left:12px;top:' + vbY + 'px">–</span>'
        + '<span class="vol" style="left:60px;top:' + vbY + 'px">' + (vol != null ? vol + '<span class="vbar"><span style="width:' + vol + '%"></span></span>' : '–') + '</span>'
        + '<span class="vb" style="left:102px;top:' + vbY + 'px">+</span>'
        // TV rooms keep an invisible play slot so the layout (and its overlay) stays uniform;
        // the play tap is simply ignored by the command handler (no standalone transport)
        + '<span class="pp' + (isTV ? ' ghost' : '') + '" style="left:' + ppX + 'px;top:' + ppY + 'px">' + (isTV ? '' : (playing ? icoPause(GREEN) : icoPlay(LBL))) + '</span>'
        + '</div>';
    // tap targets slightly larger than the visuals (finger-friendly), non-overlapping
    var targets = [
        rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: room + ':vol:down', x: x + 6, y: y + vbY - 7, w: 52, h: 48 }),
        rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: room + ':vol:up', x: x + 98, y: y + vbY - 7, w: 52, h: 48 }),
        rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: room + ':playpause', x: x + ppX - 6, y: y + ppY - 6, w: 50, h: 50 })
    ];
    return { html: html, targets: targets };
}

// which preset the current grouping matches (over the rooms that answer), null if none
function activePreset() {
    var online = ROOMS.filter(function (r) { return ZONES[r]; });
    if (!online.length) return null;
    function coordOf(r) { return ZONES[r].coord || r; }
    function matches(target) { return online.every(function (r) { return coordOf(r) === target(r); }); }
    if (matches(function (r) { return r; })) return 'group:einzeln';
    if (matches(function () { return COORD; })) return 'group:alle';
    if (matches(function (r) { return (r === COORD || WOHNEN.indexOf(r) >= 0) ? COORD : r; })) return 'group:wohnen';
    return null;
}

function build() {
    var html = '', targets = [];
    var cTop = 4, cH = H - 8;   // one section card fills the band
    html += '<div class="seccard" style="left:' + PADX + 'px;top:' + cTop + 'px;width:' + (W - 2 * PADX) + 'px;height:' + cH + 'px"></div>'
        + '<div class="card-h" style="left:' + (PADX + 14) + 'px;top:' + (cTop + 12) + 'px">Musik</div>';
    // preset group pills, right-aligned in the header row
    // the preset matching the current grouping is lit like an "on" tile; the others stay muted
    var presets = [['Alle', 'group:alle', icoLink], ['Wohnen', 'group:wohnen', icoLink], ['Einzeln', 'group:einzeln', icoStop]];
    var active = activePreset();
    var pbW = 150, pbH = 32, pbGap = 8, pbY = cTop + 8;
    var pbX0 = PADX + (W - 2 * PADX) - 14 - presets.length * pbW - (presets.length - 1) * pbGap;
    presets.forEach(function (p, i) {
        var px = pbX0 + i * (pbW + pbGap);
        var on = p[1] === active;
        html += '<div class="gbtn' + (on ? ' on' : '') + '" style="left:' + px + 'px;top:' + pbY + 'px;width:' + pbW + 'px;height:' + pbH + 'px"><span>' + p[2](on ? GREEN : LBL) + '</span>' + p[0] + '</div>';
        targets.push(rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: p[1], x: px, y: pbY - 6, w: pbW, h: pbH + 12 }));
    });
    // one music-light pill per zone, left of the presets and set apart by a wider gap (they are not
    // groupings); four fixed slots, each with its own native overlay
    var off = lightOff(), lbW = 120, lbGap = 8;
    var lbX0 = pbX0 - 24 - MAX_LIGHT_PILLS * lbW - (MAX_LIGHT_PILLS - 1) * lbGap;
    lightZones().forEach(function (zone, i) {
        var lx = lbX0 + i * (lbW + lbGap), on = off.indexOf(zone.key) < 0;
        html += '<div class="gbtn' + (on ? ' fx' : '') + '" style="left:' + lx + 'px;top:' + pbY + 'px;width:' + lbW + 'px;height:' + pbH + 'px"><span>' + icoSparkle(on, i) + '</span>' + esc(zone.label) + '</div>';
        targets.push(rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: 'light:toggle:' + i, x: lx, y: pbY - 6, w: lbW, h: pbH + 12 }));
    });

    // 4×2 compact room cards inside the card (10px inner padding)
    var top = pbY + pbH + 10, cols = 4, gap = 10, rgap = 8, ch = 122;
    var ix = PADX + 10;
    var cw = (W - 2 * PADX - 20 - (cols - 1) * gap) / cols;
    ROOMS.forEach(function (room, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var res = roomCard(room, ix + c * (cw + gap), top + r * (ch + rgap), cw, ch);
        html += res.html; res.targets.forEach(function (t) { targets.push(t); });
    });

    if (!build._logged) { console.log('MUSIK_LAYOUT ' + JSON.stringify(targets)); build._logged = true; }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
        + '<foreignObject width="' + W + '" height="' + H + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="mv2"><style>' + CSS + '</style>'
        + '<div class="wrap">' + html + '</div></div></foreignObject></svg>';
}

// playing rooms, for the Übersicht status bar's "Musik" chip
function playingRooms() { return ROOMS.filter(function (r) { return ZONES[r] && ZONES[r].play; }).length; }
createState('javascript.0.music_playing', 0, { type: 'number', role: 'value', desc: 'Übersicht: Anzahl spielender Räume' });
createState('javascript.0.music_zones', '{}', { type: 'string', role: 'json', desc: 'Musiklicht: was je Zone spielt' });
createState(LIGHT_OFF_ID, '[]', { type: 'string', role: 'json', desc: 'Musiklicht: ausgeschaltete Zonen' });
createState(AUDIOBOOK_ARTISTS_ID, '[]', { type: 'string', role: 'json', desc: 'Musiklicht: Hörspiel-Künstler (kein Musiklicht)' });
function publish() {
    setState('musik_grid', build(), true);
    setState('javascript.0.music_playing', playingRooms(), true);
    var music = JSON.stringify(zonesMusic());
    if (jsonState('javascript.0.music_zones', null) === null || JSON.stringify(jsonState('javascript.0.music_zones', {})) !== music) {
        setState('javascript.0.music_zones', music, true);
    }
}
createState('javascript.0.musik_grid', '', { type: 'string', role: 'html', desc: 'Musik (Sonos) grid' });
createState('javascript.0.musik_cmd', '', { type: 'string', role: 'text', desc: 'Musik command (jishi)' });

// The cover image of a track. Some streaming services put the track's audio file into
// absoluteAlbumArtUri (a FLAC download); the real cover is then the full URL in albumArtUri. A relative
// albumArtUri (served by the speaker) only works as the absolute variant.
function coverOf(t) {
    var direct = String(t.albumArtUri || ''), absolute = String(t.absoluteAlbumArtUri || '');
    if (/^https?:\/\//.test(direct)) return direct;
    if (absolute && absolute !== t.uri) return absolute;
    return undefined;
}

// jishi /zones groups → roomName → {vol, play, stopped, title, artist, album, uri, art, nextArt, mute, coord}
function zonesFromSonos(groups) {
    var map = {};
    groups.forEach(function (g) {
        var coord = g.coordinator && g.coordinator.roomName;
        var cs = (g.coordinator && g.coordinator.state) || {};
        (g.members || []).forEach(function (m) {
            var st = m.state || (m.roomName === coord ? cs : null) || {};
            var t = st.currentTrack || cs.currentTrack || {};
            var next = st.nextTrack || cs.nextTrack || {};
            map[m.roomName] = {
                vol: st.volume, play: (st.playbackState || cs.playbackState) === 'PLAYING',
                stopped: (st.playbackState || cs.playbackState) === 'STOPPED',
                title: t.title || t.stationName, artist: t.artist, album: t.album, uri: t.uri,
                art: coverOf(t), nextArt: coverOf(next), mute: st.mute === true, coord: coord
            };
        });
    });
    return map;
}

// A zone plays music when one of its rooms plays a track that is neither the TV input nor an audiobook:
// the soundbar reports TV sound as PLAYING too (x-sonos-htastream:), and the Hue Sync Box lights the TV
// then; audiobooks play at bedtime, when a light change would wake the children. Read by music_light.js.
var TV_INPUT = 'x-sonos-htastream:';
var AUDIOBOOK_NAMING = /\b(Folge|Kapitel|Teil|Episode)\s+\d+|Hörspiel|Hörbuch/i;
function isAudiobook(z, artists) {
    if (AUDIOBOOK_NAMING.test(z.album || '') || AUDIOBOOK_NAMING.test(z.title || '')) return true;
    var artist = String(z.artist || '').toLowerCase();
    return artists.some(function (a) { return artist && artist.indexOf(String(a).toLowerCase()) >= 0; });
}
function zoneMusic(rooms, artists) {
    var room = rooms.filter(function (r) {
        var z = ZONES[r];
        return z && z.play && !z.mute && String(z.uri || '').indexOf(TV_INPUT) !== 0 && !isAudiobook(z, artists);
    })[0];
    if (!room) return { playing: false };
    var z = ZONES[room];
    return { playing: true, artist: z.artist, title: z.title, album: z.album, uri: z.uri, art: z.art, nextArt: z.nextArt, vol: z.vol };
}
function zonesMusic() {
    var artists = jsonState(AUDIOBOOK_ARTISTS_ID, []), out = {};
    lightZones().forEach(function (zone) { out[zone.key] = zoneMusic(zone.rooms || [], Array.isArray(artists) ? artists : []); });
    return out;
}

// poll jishi /zones → ZONES cache → render
function refresh() {
    jget('/zones', function (err, body) {
        if (err) return;
        try {
            var now = Date.now(), map = zonesFromSonos(JSON.parse(body));
            // while a tap is still settling, keep the optimistic value — a mid-transition poll
            // would otherwise clobber it (the playing→paused→playing flicker the user saw)
            Object.keys(ZONES).forEach(function (r) {
                var old = ZONES[r];
                if (old && old.holdUntil > now && map[r]) {
                    map[r].play = old.play;
                    map[r].stopped = old.play ? false : map[r].stopped;
                    if (typeof old.vol === 'number') map[r].vol = old.vol;
                    map[r].coord = old.coord;       // hold membership through the staggered group joins
                    map[r].holdUntil = old.holdUntil;
                }
            });
            ZONES = map;
        } catch (e) { /* keep last */ }
        publish();
    });
}

// command helper: turn musik_cmd into jishi HTTP calls
on({ id: 'javascript.0.musik_cmd', change: 'any' }, function (obj) {
    // overlays alternate value/value+space so every tap is a state change (the i-vis-universal
    // Switch won't re-write an identical value) — trim the marker back off here.
    var v = (obj && obj.state ? String(obj.state.val || '') : '').trim();
    if (!v) return;
    if (v.indexOf('light:toggle:') === 0) {
        var zone = lightZones()[parseInt(v.slice('light:toggle:'.length), 10)];
        if (!zone) return;                          // an overlay slot without a zone
        var off = lightOff().filter(function (k) { return k !== zone.key; });
        if (off.length === lightOff().length) off.push(zone.key);
        setState(LIGHT_OFF_ID, JSON.stringify(off), true);
        publish();
        return;
    }
    function zof(r) { return ZONES[r] || (ZONES[r] = {}); }
    var HOLD = 3500;                        // ms to protect an optimistic value from a stale poll
    if (v === 'group:alle' || v === 'group:wohnen' || v === 'group:einzeln') {
        // optimistic membership so the cards update instantly, then fire the staggered joins/leaves
        var d = 0; ROOMS.forEach(function (r) { if (r !== COORD) d += 500; });
        var groupHold = Date.now() + d + HOLD;
        ROOMS.forEach(function (r) {
            var zz = zof(r);
            zz.coord = (v === 'group:einzeln') ? r
                : (v === 'group:wohnen' && r !== COORD && WOHNEN.indexOf(r) < 0) ? r : COORD;
            zz.holdUntil = groupHold;       // hold membership through the staggered calls + settle
        });
        publish();
        var dd2 = 0;
        ROOMS.forEach(function (r) {
            if (r === COORD) return;
            var join = (v === 'group:alle') || (v === 'group:wohnen' && WOHNEN.indexOf(r) >= 0);
            var path = join ? '/' + r + '/join/' + COORD : '/' + r + '/leave';
            (function (p, ddd) { setTimeout(function () { jget(p); }, ddd); })(path, dd2); dd2 += 500;
        });
        setTimeout(refresh, d + HOLD + 300); // reconcile just after the hold expires
        return;
    }
    var parts = v.split(':');               // "<room>:playpause" | "<room>:vol:up|down"
    var room = parts[0], z = zof(room);
    if (parts[1] === 'playpause') {
        if (TV[room]) return;                       // TV soundbar has no standalone play control
        var prev = !!z.play;
        z.play = !prev; z.holdUntil = Date.now() + HOLD; publish();     // optimistic, protected
        jget('/' + room + '/' + (z.play ? 'play' : 'pause'), function (err, body) {  // explicit, not toggle
            if (err || (body && body.indexOf('"status":"error"') >= 0)) {
                if (body && body.indexOf('AVTransport') >= 0) TV[room] = true;  // learn: soundbar can't be driven standalone
                z.play = prev; z.holdUntil = 0; publish();             // rejected → honest revert (+ drop play button)
            }
        });
    } else if (parts[1] === 'vol') {
        // ±5 per tap — the native overlays can't do press-and-hold, and ±1 meant 15+ taps
        // for an audible change on the wall panel
        if (typeof z.vol === 'number') { z.vol = Math.max(0, Math.min(100, z.vol + (parts[2] === 'up' ? 5 : -5))); }
        z.holdUntil = Date.now() + HOLD; publish();
        jget('/' + room + '/volume/' + (parts[2] === 'up' ? '+5' : '-5'));
    }
    setTimeout(refresh, HOLD + 300);        // reconcile just after the hold expires (state has settled)
});

setTimeout(refresh, 2000);
setInterval(refresh, 4000);                 // jishi has no push; poll
console.log('[Musik v2] initialized (jishi)');