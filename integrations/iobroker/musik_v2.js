// ioBroker JavaScript: Musik (Sonos) tab — driven by the Sonos HTTP API (jishi,
// node-sonos-http-api on localhost:5005), because the native iobroker.sonos adapter can't group
// this (S2) system (HTTP 500). jishi gives correct live room names, state, and working grouping.
//
// 8 room cards (now-playing + play/pause + volume ±) + preset group buttons (Alle/Wohnen/Einzeln).
// HTML/CSS is display-only → native i-vis-universal overlays write to javascript.0.musik_cmd; this
// script polls /zones for state and turns commands into jishi HTTP calls.

var http = require('http');
var API = { host: '127.0.0.1', port: 5005 };
function jget(path, cb) {
    http.get({ host: API.host, port: API.port, path: encodeURI(path), timeout: 4000 }, function (res) {
        var d = ''; res.on('data', function (c) { d += c; }); res.on('end', function () { cb && cb(null, d); });
    }).on('error', function (e) { cb && cb(e); }).on('timeout', function () { cb && cb(new Error('timeout')); });
}

var W = 1170, H = 680, PADX = 4;

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
.mv2 .gbtn{position:absolute; background:var(--bg); border:1px solid var(--border); border-radius:var(--r3); display:flex; align-items:center; justify-content:center; gap:8px; font-size:16px; font-weight:600}
.mv2 .room{position:absolute; background:var(--bg); border:1px solid var(--border); border-radius:var(--r3); padding:12px 14px; display:flex; align-items:center; gap:12px; overflow:hidden}
.mv2 .room.playing{border-color:rgba(181,251,91,.4)}
.mv2 .room .disc{width:54px; height:54px; border-radius:50%; background:var(--inset); flex:none; display:flex; align-items:center; justify-content:center}
.mv2 .room.playing .disc{background:var(--green-16)}
.mv2 .room .mid{flex:1; min-width:0; display:flex; flex-direction:column; gap:1px}
.mv2 .room .nm{font-size:17px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .ti{font-size:13px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .ar{font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .grp{font-size:11px; color:var(--blue); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .ctl{flex:none; display:flex; align-items:center; gap:8px}
.mv2 .room .pp{width:48px; height:48px; border-radius:50%; background:var(--inset); display:flex; align-items:center; justify-content:center}
.mv2 .room.playing .pp{background:var(--green-16)}
.mv2 .room .vb{width:42px; height:42px; border-radius:10px; background:var(--inset); display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:700; color:var(--text)}
.mv2 .room .vol{font-size:14px; color:var(--text); font-weight:600; width:40px; text-align:center}
`;

var GREEN = '#b5fb5b', BLUE = '#5080AC', LBL = '#8A8A8A';
// live Sonos room names (from jishi /zones), fixed order for a stable layout
var ROOMS = ['Fernsehzimmer', 'Küche', 'Wohnzimmer', 'Sauna', 'Bad', 'Claras Zimmer', 'Carlottas Zimmer', 'Studio'];
var COORD = 'Wohnzimmer';                         // preset group coordinator
var WOHNEN = ['Küche', 'Fernsehzimmer'];          // joined to COORD for "Wohnen"
var ZONES = {};                                   // roomName -> {vol, play, title, artist, coord}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function clip(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n - 1) + '…' : s); }
function rnd(o) { return { kind: o.kind, oid: o.oid, value: o.value, x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w), h: Math.round(o.h) }; }

function icoPlay(c) { return '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 4 L19 12 L7 20 Z" fill="' + c + '"/></svg>'; }
function icoPause(c) { return '<svg width="18" height="18" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" fill="' + c + '"/><rect x="14" y="4" width="4" height="16" rx="1" fill="' + c + '"/></svg>'; }
function icoSpeaker(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><circle cx="12" cy="15" r="3.4"/><circle cx="12" cy="6.5" r="1"/></g></svg>'; }
function icoStop(c) { return '<svg width="20" height="20" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2.5" fill="' + c + '"/></svg>'; }
function icoLink(c) { return '<svg width="20" height="20" viewBox="0 0 24 24"><g fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round"><path d="M9 12 h6"/><path d="M8 8 H6 a4 4 0 0 0 0 8 h2"/><path d="M16 8 h2 a4 4 0 0 1 0 8 h-2"/></g></svg>'; }

function roomCard(room, x, y, w, h) {
    var z = ZONES[room] || {};
    var playing = !!z.play;
    var vol = (typeof z.vol === 'number') ? z.vol : null;
    var grouped = z.coord && z.coord !== room;
    var ppIcon = playing ? icoPause(GREEN) : icoPlay(LBL);
    var html = '<div class="room' + (playing ? ' playing' : '') + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px">'
        + '<div class="disc">' + icoSpeaker(playing ? GREEN : LBL) + '</div>'
        + '<div class="mid"><div class="nm">' + esc(room) + '</div>'
        + (playing
            ? '<div class="ti">' + clip(z.title, 36) + '</div><div class="ar">' + clip(z.artist, 36) + '</div>'
            : '<div class="ar">' + (z.coord ? (z.stopped ? 'gestoppt' : 'pausiert') : '–') + '</div>')
        + (grouped ? '<div class="grp">↪ ' + esc(z.coord) + '</div>' : '')
        + '</div>'
        + '<div class="ctl">'
        + '<span class="vb">–</span><span class="vol">' + (vol != null ? vol : '–') + '</span><span class="vb">+</span>'
        + '<span class="pp">' + ppIcon + '</span>'
        + '</div></div>';
    var pad = 14, ppW = 48, vbW = 42, volW = 40, g = 8, th = 48;
    var ppX = x + w - pad - ppW;
    var volPX = ppX - g - vbW;
    var volNX = volPX - g - volW - g - vbW;
    var cy = y + (h - th) / 2;
    var targets = [
        rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: room + ':vol:down', x: volNX, y: cy, w: vbW, h: th }),
        rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: room + ':vol:up', x: volPX, y: cy, w: vbW, h: th }),
        rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: room + ':playpause', x: ppX, y: cy, w: ppW, h: th })
    ];
    return { html: html, targets: targets };
}

function build() {
    var html = '', targets = [];
    var gTop = 4, gH = 84;
    html += '<div class="seccard" style="left:' + PADX + 'px;top:' + gTop + 'px;width:' + (W - 2 * PADX) + 'px;height:' + gH + 'px"></div>'
        + '<div class="card-h" style="left:' + (PADX + 14) + 'px;top:' + (gTop + 12) + 'px">Gruppen</div>';
    var presets = [['Alle', 'group:alle', icoLink(GREEN)], ['Wohnen', 'group:wohnen', icoLink(BLUE)], ['Einzeln', 'group:einzeln', icoStop(LBL)]];
    var pbY = gTop + 36, pbH = 38, pbGap = 10, pbW = (W - 2 * PADX - 28 - (presets.length - 1) * pbGap) / presets.length, pbX0 = PADX + 14;
    presets.forEach(function (p, i) {
        var px = pbX0 + i * (pbW + pbGap);
        html += '<div class="gbtn" style="left:' + px + 'px;top:' + pbY + 'px;width:' + pbW + 'px;height:' + pbH + 'px"><span>' + p[2] + '</span>' + p[0] + '</div>';
        targets.push(rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: p[1], x: px, y: pbY, w: pbW, h: pbH }));
    });

    var top = gTop + gH + 10, cols = 2, gap = 10;
    var cw = (W - 2 * PADX - (cols - 1) * gap) / cols;
    var ch = Math.floor((H - top - 4 - 3 * gap) / 4);
    ROOMS.forEach(function (room, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var x = PADX + c * (cw + gap), y = top + r * (ch + gap);
        var res = roomCard(room, x, y, cw, ch);
        html += res.html; res.targets.forEach(function (t) { targets.push(t); });
    });

    if (!build._logged) { console.log('MUSIK_LAYOUT ' + JSON.stringify(targets)); build._logged = true; }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
        + '<foreignObject width="' + W + '" height="' + H + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="mv2"><style>' + CSS + '</style>'
        + '<div class="wrap">' + html + '</div></div></foreignObject></svg>';
}

function publish() { setState('musik_grid', build(), true); }
createState('javascript.0.musik_grid', '', { type: 'string', role: 'html', desc: 'Musik (Sonos) grid' });
createState('javascript.0.musik_cmd', '', { type: 'string', role: 'text', desc: 'Musik command (jishi)' });

// poll jishi /zones → ZONES cache → render
function refresh() {
    jget('/zones', function (err, body) {
        if (err) return;
        try {
            var z = JSON.parse(body), map = {};
            z.forEach(function (g) {
                var coord = g.coordinator && g.coordinator.roomName;
                var ct = g.coordinator && g.coordinator.state && g.coordinator.state.currentTrack;
                (g.members || []).forEach(function (m) {
                    var st = m.state || (m.roomName === coord ? g.coordinator.state : null) || {};
                    var t = st.currentTrack || ct || {};
                    map[m.roomName] = {
                        vol: st.volume, play: st.playbackState === 'PLAYING',
                        stopped: st.playbackState === 'STOPPED',
                        title: t.title || t.stationName, artist: t.artist, coord: coord
                    };
                });
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
    if (v === 'group:alle') {
        var d = 0; ROOMS.forEach(function (r) { if (r !== COORD) { (function (rr, dd) { setTimeout(function () { jget('/' + rr + '/join/' + COORD); }, dd); })(r, d); d += 500; } });
    } else if (v === 'group:wohnen') {
        var d2 = 0; ROOMS.forEach(function (r) {
            if (r === COORD) return;
            var path = (WOHNEN.indexOf(r) >= 0) ? '/' + r + '/join/' + COORD : '/' + r + '/leave';
            (function (p, dd) { setTimeout(function () { jget(p); }, dd); })(path, d2); d2 += 500;
        });
    } else if (v === 'group:einzeln') {
        var d3 = 0; ROOMS.forEach(function (r) { (function (rr, dd) { setTimeout(function () { jget('/' + rr + '/leave'); }, dd); })(r, d3); d3 += 400; });
    } else {
        var parts = v.split(':');           // "<room>:playpause" | "<room>:vol:up|down"
        var room = parts[0];
        var z = ZONES[room] || (ZONES[room] = {});
        if (parts[1] === 'playpause') {
            z.play = !z.play; publish();    // optimistic: flip the icon now, jishi confirms on next poll
            jget('/' + room + '/playpause');
        } else if (parts[1] === 'vol') {
            if (typeof z.vol === 'number') { z.vol = Math.max(0, Math.min(100, z.vol + (parts[2] === 'up' ? 1 : -1))); publish(); }
            jget('/' + room + '/volume/' + (parts[2] === 'up' ? '+1' : '-1'));
        }
    }
    setTimeout(refresh, 900);               // reconcile with jishi shortly after
});

setTimeout(refresh, 2000);
setInterval(refresh, 4000);                 // jishi has no push; poll
console.log('[Musik v2] initialized (jishi)');
