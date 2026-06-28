// ioBroker JavaScript: Musik (Sonos) tab on the .mv2 design system.
// 8 room cards (cover + now-playing + play/pause + volume) and preset group buttons.
// HTML/CSS is display-only → native i-vis-universal overlays drive the taps (positions logged as
// MUSIK_LAYOUT). Relative actions (volume ±, grouping) go through the javascript.0.musik_cmd helper.

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
/* preset group buttons */
.mv2 .gbtn{position:absolute; background:var(--bg); border:1px solid var(--border); border-radius:var(--r3); display:flex; align-items:center; justify-content:center; gap:8px; font-size:16px; font-weight:600}
.mv2 .gbtn .gi{display:flex}
/* room card */
.mv2 .room{position:absolute; background:var(--bg); border:1px solid var(--border); border-radius:var(--r3); padding:12px 14px; display:flex; align-items:center; gap:12px; overflow:hidden}
.mv2 .room.playing{border-color:rgba(181,251,91,.4)}
.mv2 .room .cover{width:58px; height:58px; border-radius:8px; background:var(--inset); flex:none; object-fit:cover}
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

var GREEN = '#b5fb5b', BLUE = '#5080AC', LBL = '#8A8A8A', TEXT = '#CCCCCC', MUT = '#8A8A8A';
var SROOT = 'sonos.0.root.';
// [label, ip-key, coordinator-name (object common.name) for grouping]
var ROOMS = [
    ['Fernsehzimmer', '192_168_178_25', 'Fernsehzimmer'],
    ['Küche', '192_168_178_28', 'Kueche'],
    ['Wohnzimmer', '192_168_178_29', 'Wohnzimmer'],
    ['Sauna', '192_168_178_30', 'Sauna'],
    ['Bad', '192_168_178_41', 'Bad'],
    ['Kinderzimmer', '192_168_178_42', 'Kinderzimmer'],
    ['Studio', '192_168_178_43', 'Studio'],
    ['Move', '192_168_178_64', 'Move']
];
var COORD = 'Wohnzimmer';                        // group coordinator (Sonos player name)
var COORD_IP = '192_168_178_29';                 // Wohnzimmer ip-key (write groupings here)
var WOHNEN = ['Kueche', 'Fernsehzimmer'];        // joined to COORD for the "Wohnen" preset
var VOL_STEP = 1;

function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function sStr(id) { var s = getState(id); return (s && s.val != null) ? String(s.val) : null; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function clip(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n - 1) + '…' : s); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(o) { return { kind: o.kind, oid: o.oid, value: o.value, x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w), h: Math.round(o.h) }; }

function icoPlay(c) { return '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M7 4 L19 12 L7 20 Z" fill="' + c + '"/></svg>'; }
function icoPause(c) { return '<svg width="18" height="18" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" fill="' + c + '"/><rect x="14" y="4" width="4" height="16" rx="1" fill="' + c + '"/></svg>'; }
function icoSpeaker(c) { return '<svg width="22" height="22" viewBox="0 0 24 24"><g fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><circle cx="12" cy="15" r="3.4"/><circle cx="12" cy="6.5" r="1"/></g></svg>'; }
function icoStop(c) { return '<svg width="20" height="20" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2.5" fill="' + c + '"/></svg>'; }
function icoLink(c) { return '<svg width="20" height="20" viewBox="0 0 24 24"><g fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round"><path d="M9 12 h6"/><path d="M8 8 H6 a4 4 0 0 0 0 8 h2"/><path d="M16 8 h2 a4 4 0 0 1 0 8 h-2"/></g></svg>'; }

function roomCard(it, x, y, w, h) {
    var ip = it[1], P = SROOT + ip + '.';
    var ss = getState(P + 'state_simple'); var playing = !!(ss && ss.val);  // truth (state can be stale)
    var st = sStr(P + 'state');
    var vol = sNum(P + 'volume');
    var title = sStr(P + 'current_title') || sStr(P + 'current_station');
    var artist = sStr(P + 'current_artist');
    var coord = sStr(P + 'coordinator');           // an ip-key (e.g. 192_168_178_29)
    var grouped = coord && coord !== ip;           // grouped when the coordinator isn't itself
    var coordName = grouped ? (ipName(coord) || coord) : null;
    var cover = '/sonos/coverImage/' + ip + '.png';
    var ppIcon = playing ? icoPause(GREEN) : icoPlay(LBL);
    var html = '<div class="room' + (playing ? ' playing' : '') + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px">'
        + '<img class="cover" src="' + cover + '" alt=""/>'
        + '<div class="mid"><div class="nm">' + esc(it[0]) + '</div>'
        + (playing
            ? '<div class="ti">' + clip(title, 34) + '</div><div class="ar">' + clip(artist, 34) + '</div>'
            : '<div class="ar">' + (st === 'stop' ? 'gestoppt' : 'pausiert') + '</div>')
        + (grouped ? '<div class="grp">↪ ' + esc(coordName) + '</div>' : '')
        + '</div>'
        + '<div class="ctl">'
        + '<span class="vb">–</span><span class="vol">' + (vol != null ? Math.round(vol) : '–') + '</span><span class="vb">+</span>'
        + '<span class="pp">' + ppIcon + '</span>'
        + '</div></div>';
    // tap targets: vol−, vol+, play/pause — right-anchored ctl row [vb−][vol][vb+][pp], gap g
    var pad = 14, ppW = 48, vbW = 42, volW = 40, g = 8, th = 48;
    var ppX = x + w - pad - ppW;            // play/pause
    var volPX = ppX - g - vbW;              // vol +
    var volNX = volPX - g - volW - g - vbW; // vol − (two gaps + the volume readout between)
    var cy = y + (h - th) / 2;
    var targets = [
        rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: ip + ':vol:down', x: volNX, y: cy, w: vbW, h: th }),
        rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: ip + ':vol:up', x: volPX, y: cy, w: vbW, h: th }),
        rnd({ kind: 'toggle', oid: P + 'state_simple', x: ppX, y: cy, w: ppW, h: th })
    ];
    return { html: html, targets: targets };
}

function build() {
    var html = '', targets = [];
    // 1) Gruppen preset row
    var gTop = 4, gH = 84, gHeadY = gTop + 12;
    html += '<div class="seccard" style="left:' + PADX + 'px;top:' + gTop + 'px;width:' + (W - 2 * PADX) + 'px;height:' + gH + 'px"></div>'
        + '<div class="card-h" style="left:' + (PADX + 14) + 'px;top:' + gHeadY + 'px">Gruppen</div>';
    var presets = [['Alle', 'group:alle', icoLink(GREEN)], ['Wohnen', 'group:wohnen', icoLink(BLUE)], ['Einzeln', 'group:einzeln', icoStop(LBL)]];
    var pbY = gTop + 36, pbH = 38, pbGap = 10, pbW = (W - 2 * PADX - 28 - (presets.length - 1) * pbGap) / presets.length, pbX0 = PADX + 14;
    presets.forEach(function (p, i) {
        var px = pbX0 + i * (pbW + pbGap);
        html += '<div class="gbtn" style="left:' + px + 'px;top:' + pbY + 'px;width:' + pbW + 'px;height:' + pbH + 'px"><span class="gi">' + p[2] + '</span>' + p[0] + '</div>';
        targets.push(rnd({ kind: 'cmd', oid: 'javascript.0.musik_cmd', value: p[1], x: px, y: pbY, w: pbW, h: pbH }));
    });

    // 2) room cards: 2 cols x 4 rows
    var top = gTop + gH + 10, cols = 2, gap = 10;
    var cw = (W - 2 * PADX - (cols - 1) * gap) / cols;
    var ch = Math.floor((H - top - 4 - 3 * gap) / 4);
    ROOMS.forEach(function (it, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var x = PADX + c * (cw + gap), y = top + r * (ch + gap);
        var res = roomCard(it, x, y, cw, ch);
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
createState('javascript.0.musik_cmd', '', { type: 'string', role: 'text', desc: 'Musik command (vol/group)' });

// command helper: volume ± and preset grouping
function ipName(ip) { for (var i = 0; i < ROOMS.length; i++) { if (ROOMS[i][1] === ip) return ROOMS[i][2]; } return null; }
on({ id: 'javascript.0.musik_cmd', change: 'any' }, function (obj) {
    var v = obj && obj.state ? String(obj.state.val || '') : '';
    if (!v) return;
    var m = v.match(/^(\d+_\d+_\d+_\d+):vol:(up|down)$/);
    if (m) {
        var vid = SROOT + m[1] + '.volume';
        var cur = sNum(vid); if (cur == null) cur = 30;
        setState(vid, clamp(cur + (m[2] === 'up' ? VOL_STEP : -VOL_STEP), 0, 100));
        return;
    }
    // grouping: write the MEMBER's name to the COORDINATOR's add_to_group / remove_from_group
    // (addToGroup(state.val, player) → player=the one written to becomes coordinator). Stagger the
    // writes so the Sonos API isn't hammered on the same state.
    function gAdd(name, d) { setTimeout(function () { setState(SROOT + COORD_IP + '.add_to_group', name); }, d); }
    function gRem(name, d) { setTimeout(function () { setState(SROOT + COORD_IP + '.remove_from_group', name); }, d); }
    var d = 0;
    if (v === 'group:alle') {
        ROOMS.forEach(function (r) { if (r[2] !== COORD) { gAdd(r[2], d); d += 400; } });
    } else if (v === 'group:wohnen') {
        ROOMS.forEach(function (r) {
            if (r[2] === COORD) return;
            if (WOHNEN.indexOf(r[2]) >= 0) gAdd(r[2], d); else gRem(r[2], d);
            d += 400;
        });
    } else if (v === 'group:einzeln') {
        ROOMS.forEach(function (r) { if (r[2] !== COORD) { gRem(r[2], d); d += 400; } });
    }
});

// re-render on playback/volume/group changes
ROOMS.forEach(function (r) {
    ['state', 'volume', 'current_title', 'current_artist', 'coordinator'].forEach(function (s) {
        on({ id: SROOT + r[1] + '.' + s, change: 'ne' }, publish);
    });
});
setTimeout(publish, 2000);
schedule('*/2 * * * *', publish);
console.log('[Musik v2] initialized');
