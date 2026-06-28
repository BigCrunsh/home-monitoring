// ioBroker JavaScript: Steuerung (Control) tab — full control surface on the .mv2 design system.
// STAGE 1 = the display tile grid (HTML/CSS can only show, not tap). Tile positions are computed
// deterministically so STAGE 2 can drop native i-vis-universal tap-overlays on the exact same rects
// (printed to the log as STEUERUNG_LAYOUT for the vis-views generator).
//
// Convention (owner's bubble concept): ON = bright accent + tint, OFF = muted. Plugs show live W,
// shutters show position % + ↑↓ affordance, scenes are buttons.

var W = 1170, H = 680, GAP = 10, PADX = 4;

var CSS_BASE = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');
.mv2{
  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;
  --text:#CCCCCC; --muted:#8A8A8A; --mute:#7F8A99;
  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;
  --green-16:rgba(181,251,91,.16); --amber-16:rgba(241,190,61,.16); --blue-16:rgba(80,128,172,.16); --red-16:rgba(160,6,41,.22); --muted-16:rgba(138,138,138,.16);
  --s1:4px; --s2:8px; --r2:14px; --r3:12px;
  --t-label:14px; --t-cap:12px;
  box-sizing:border-box; background:var(--bg);
  font-family:'Figtree',system-ui,sans-serif; color:var(--text);
  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;
}
.mv2 *{margin:0; padding:0; box-sizing:border-box}
.mv2 .wrap{position:relative; width:${W}px; height:${H}px}
/* section cards — same container language as Klima/Diagnose/overview */
.mv2 .seccard{position:absolute; background:var(--surface); border:1px solid var(--border); border-radius:var(--r2)}
.mv2 .card-h{position:absolute; font-size:var(--t-label); font-weight:700; letter-spacing:.06em; color:var(--muted); text-transform:uppercase}
/* the overview's .tile component (centered, border-tint on) — one dashboard, one component */
.mv2 .tile{position:absolute; background:var(--bg); border:1px solid var(--border); border-radius:var(--r3); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--s1); overflow:hidden}
.mv2 .tile .ic{height:26px; display:flex; align-items:center; justify-content:center}
.mv2 .tile .cap{font-size:var(--t-label); color:var(--muted); font-weight:600; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .tile .st{font-size:var(--t-cap); color:var(--mute)}
.mv2 .tile.on{border-color:rgba(241,190,61,.55)} .mv2 .tile.on .cap{color:var(--text)} .mv2 .tile.on .st{color:var(--amber)}
.mv2 .tile.open{border-color:rgba(80,128,172,.5)} .mv2 .tile.open .cap{color:var(--text)} .mv2 .tile.open .st{color:var(--blue)}
.mv2 .tile.scene{border-color:rgba(80,128,172,.45)} .mv2 .tile.scene .st{color:var(--blue)}
`;

var GREEN = '#b5fb5b', AMBER = '#F1BE3D', BLUE = '#5080AC', RED = '#A00629', LBL = '#8A8A8A', TEXT = '#CCCCCC';

// [label, hue on-state]
var LIGHTS = [
    ['Esstisch', 'hue.0.Esszimmer.on'], ['Couchtisch', 'hue.0.Wohnzimmertischlampe.on'],
    ['TV', 'hue.0.TV-Bereich.on'], ['Küche', 'hue.0.Küche.on'],
    ['Eingang', 'hue.0.Eingangsbereich.on'], ['Flur', 'hue.0.Flur.on'],
    ['Büro', 'hue.0.Arbeitszimmerlicht.on'], ['Keller', 'hue.0.Keller.on'],
    ['Spielzimmer', 'hue.0.Spielzimmer.on'], ['Clara Decke', 'hue.0.Claras_Deckenlampe.on'],
    ['Carlotta Decke', 'hue.0.Carlottas_Deckenlampe.on'], ['Carlotta Lampe', 'hue.0.Carlottas_Stehlampe.on']
];
// [label, hm serial] → .3.STATE (on/off) + .6.POWER (W)
var PLUGS = [
    ['Couch', '0001DD89A46CAD'], ['Drucker', '0001DD89A46CE1'], ['Vitrine', '0001DD89AADDE7'],
    ['Stehlampe', '0001DD89A46B91'], ['Maxxi Akku', '0001DD89A46CA5']
];
// [label, hm serial] → .4.LEVEL (0..100 position)
var SHUTTERS = [
    ['Terrasse', '001118A997B92D'], ['Bad', '001118A997B950'], ['Wohnzimmer', '00111A498CE3E2'],
    ['Küche', '00111A498CE451'], ['Seite', '00111A498CE463']
];
var SCENES = [['Fernsehabend', 'scene.0.Fernsehabend']];
// "Alle Rollläden" lives with the shutters (it's a shutter-group action, not a scene)
var ROLL_ALL = ['Alle', 'scene.0.Alle_Rollläden'];

function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function sBool(id) { var s = getState(id); return s ? !!s.val : false; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// 24px state-coloured icons (same visual language as main_v2's Steuerung tiles)
function icoBulb(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + c + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.1h6c0-.8.4-1.5 1-2.1A6 6 0 0 0 12 3Z"/></g></svg>'; }
function icoPlug(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + c + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v5M15 3v5"/><path d="M7 8h10v2a5 5 0 0 1-10 0V8Z"/><path d="M12 15v6"/></g></svg>'; }
function icoCouch(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + c + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13 v-2 a3 3 0 0 1 3 -3 h8 a3 3 0 0 1 3 3 v2"/><rect x="3" y="13" width="18" height="5" rx="1.5"/><line x1="6" y1="18" x2="6" y2="20"/><line x1="18" y1="18" x2="18" y2="20"/></g></svg>'; }
function icoPrinter(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + c + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="6" rx="1"/><path d="M4 9 h16 v7 h-4 v5 H8 v-5 H4 Z"/><line x1="8" y1="13" x2="16" y2="13"/></g></svg>'; }
function icoCabinet(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + c + '" stroke-width="1.6" fill="none"><rect x="6" y="3" width="12" height="18" rx="1.5"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="6" y1="15" x2="18" y2="15"/></g></svg>'; }
function icoBattery(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + c + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="15" height="9" rx="1.5"/><line x1="20.5" y1="11" x2="20.5" y2="14"/><path d="M11 9.5 L9 13 h3 l-2 3.5" stroke-width="1.4"/></g></svg>'; }
function icoBlind(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + c + '" stroke-width="1.6" fill="none" stroke-linecap="round"><rect x="4" y="3" width="16" height="16" rx="1"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="16" x2="20" y2="16"/></g></svg>'; }
function icoTV(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2" fill="none" stroke="' + c + '" stroke-width="1.6"/><line x1="8" y1="20" x2="16" y2="20" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round"/></svg>'; }
function icoScene(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2l2.6 6.3L21 9l-5 4.3L17.5 21 12 17.2 6.5 21 8 13.3 3 9l6.4-.7L12 2Z" fill="' + c + '"/></svg>'; }
// per-plug icon (reuse the overview's device icons where they match)
function plugIcon(serial, c) {
    if (serial === '0001DD89A46CAD') return icoCouch(c);
    if (serial === '0001DD89A46CE1') return icoPrinter(c);
    if (serial === '0001DD89AADDE7') return icoCabinet(c);
    if (serial === '0001DD89A46CA5') return icoBattery(c);
    return icoPlug(c);
}

function pos(x, y, w, h) { return 'style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px"'; }
function tileHtml(cls, p, icon, cap, st) {
    return '<div class="tile' + (cls ? ' ' + cls : '') + '" ' + p + '>'
        + '<span class="ic">' + icon + '</span><span class="cap">' + esc(cap) + '</span><span class="st">' + st + '</span></div>';
}
function lightTile(it, x, y, w, h) {
    var on = sBool(it[1]);
    return tileHtml(on ? 'on' : '', pos(x, y, w, h), icoBulb(on ? AMBER : LBL), it[0], on ? 'an' : 'aus');
}
function plugTile(it, x, y, w, h) {
    var on = sBool(it[1] + '.3.STATE'); var pw = sNum('hm-rpc.1.' + it[1] + '.6.POWER');
    var st = on ? (pw != null ? Math.round(pw) + ' W' : 'an') : 'aus';
    return tileHtml(on ? 'on' : '', pos(x, y, w, h), plugIcon(it[1], on ? AMBER : LBL), it[0], st);
}
function shutterTile(it, x, y, w, h) {
    // the "Alle" group action (a scene) renders blue with a "starten" label
    if (it[1] && it[1].indexOf('scene.') === 0) {
        return tileHtml('open', pos(x, y, w, h), icoBlind(BLUE), it[0], 'starten');
    }
    var lvl = sNum('hm-rpc.1.' + it[1] + '.4.LEVEL');
    var open = lvl != null && lvl > 5;
    return tileHtml(open ? 'open' : '', pos(x, y, w, h), icoBlind(open ? BLUE : LBL), it[0], lvl != null ? Math.round(lvl) + ' %' : '–');
}
function sceneTile(it, x, y, w, h) {
    var icon = it[1] === 'scene.0.Fernsehabend' ? icoTV(BLUE) : icoScene(BLUE);
    return tileHtml('scene', pos(x, y, w, h), icon, it[0], 'starten');
}

// one titled section card with its tile grid; tiles get absolute coords (for overlays)
function section(title, items, cols, render, top, rows, allRects, key) {
    var CPAD = 12, HEAD = 22, HGAP = 10, TH = 80, TGAP = 10;
    var ix = PADX + CPAD, iw = W - 2 * PADX - 2 * CPAD;
    var tilesTop = top + CPAD + HEAD + HGAP;
    var cardH = CPAD + HEAD + HGAP + rows * TH + (rows - 1) * TGAP + CPAD;
    var html = '<div class="seccard" style="left:' + PADX + 'px;top:' + top + 'px;width:' + (W - 2 * PADX) + 'px;height:' + cardH + 'px"></div>'
        + '<div class="card-h" style="left:' + ix + 'px;top:' + (top + CPAD) + 'px">' + title + '</div>';
    var cw = (iw - (cols - 1) * TGAP) / cols;
    var rects = [];
    items.forEach(function (it, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var tx = ix + c * (cw + TGAP), ty = tilesTop + r * (TH + TGAP);
        html += render(it, tx, ty, cw, TH);
        rects.push({ label: it[0], oid: it[1], x: Math.round(tx), y: Math.round(ty), w: Math.round(cw), h: TH });
    });
    allRects[key] = rects;
    return { html: html, nextY: top + cardH + 12 };
}

function build() {
    var y = 6, html = '', allRects = {};
    var L = section('Lichter', LIGHTS, 6, lightTile, y, 2, allRects, 'lights'); html += L.html; y = L.nextY;
    var R = section('Rollläden', SHUTTERS.concat([ROLL_ALL]), 6, shutterTile, y, 1, allRects, 'shutters'); html += R.html; y = R.nextY;
    var P = section('Steckdosen', PLUGS, 6, plugTile, y, 1, allRects, 'plugs'); html += P.html; y = P.nextY;
    var S = section('Szenen', SCENES, 6, sceneTile, y, 1, allRects, 'scenes'); html += S.html;

    // emit the layout once so the vis-views overlay generator can read exact tile rects
    if (!build._logged) { console.log('STEUERUNG_LAYOUT ' + JSON.stringify(allRects)); build._logged = true; }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
        + '<foreignObject width="' + W + '" height="' + H + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="mv2"><style>' + CSS_BASE + '</style>'
        + '<div class="wrap">' + html + '</div></div></foreignObject></svg>';
}

function publish() { setState('steuerung_grid', build(), true); }
createState('javascript.0.steuerung_grid', '', { type: 'string', role: 'html', desc: 'Steuerung tile grid' });

// re-render on any control state change
LIGHTS.forEach(function (l) { on({ id: l[1], change: 'ne' }, publish); });
PLUGS.forEach(function (p) { on({ id: 'hm-rpc.1.' + p[1] + '.3.STATE', change: 'ne' }, publish); on({ id: 'hm-rpc.1.' + p[1] + '.6.POWER', change: 'ne' }, publish); });
SHUTTERS.forEach(function (s) { on({ id: 'hm-rpc.1.' + s[1] + '.4.LEVEL', change: 'ne' }, publish); });

setTimeout(publish, 2000);
schedule('*/2 * * * *', publish);
console.log('[Steuerung v2] initialized');
