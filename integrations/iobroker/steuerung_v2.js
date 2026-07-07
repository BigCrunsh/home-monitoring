// ioBroker JavaScript: Steuerung (Control) tab — full control surface on the .mv2 design system.
// STAGE 1 = the display tile grid (HTML/CSS can only show, not tap). Tile positions are computed
// deterministically so STAGE 2 can drop native i-vis-universal tap-overlays on the exact same rects
// (printed to the log as STEUERUNG_LAYOUT for the vis-views generator).
//
// Convention (owner's bubble concept): ON = bright accent + tint, OFF = muted. Plugs show live W,
// shutters show position % + ↑↓ affordance.
//
// This grid renders only the upper three bands (Lichter / Rollläden / Steckdosen∥Garten, H=360);
// the Musik band below it on the same view is a second widget rendered by musik_v2.js.

var W = 1170, H = 360, GAP = 10, PADX = 4;

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
.mv2 .tile.stop{border-color:rgba(160,6,41,.5)} .mv2 .tile.stop .st{color:var(--red)}
/* square 68×68 tiles: state lives in border + icon colour; captions shrink to fit */
.mv2 .tile.sq{gap:3px} .mv2 .tile.sq .cap,.mv2 .tile.sq1 .cap{font-size:11px}
.mv2 .tile.sq .cap{white-space:normal; text-align:center; line-height:1.15; padding:0 1px; letter-spacing:-.01em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical}
.mv2 .tile.sq1{gap:2px}
/* garden tiles are narrower (7 per row) — slightly smaller caption */
.mv2 .tile.gt .cap{font-size:12px}
/* shutter tile: top-aligned head (icon · name · position) + 3 buttons below */
.mv2 .tile.stile{flex-direction:column; align-items:stretch; justify-content:flex-start; padding:8px 10px}
.mv2 .stile .shead{display:flex; align-items:center; gap:6px}
.mv2 .stile .shead .cap{flex:1; text-align:left}
.mv2 .stile .shead .st{color:var(--blue); font-weight:600}
.mv2 .sbtn{position:absolute; background:var(--inset); border:1px solid var(--border); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; color:var(--text)}
`;

var GREEN = '#b5fb5b', AMBER = '#F1BE3D', BLUE = '#5080AC', RED = '#A00629', LBL = '#8A8A8A', TEXT = '#CCCCCC';

// [label, hue on-state] — long one-word labels carry a soft hyphen (­) so the 2-line
// square-tile clamp can break them cleanly if the device font runs wider than the preview
var LIGHTS = [
    ['Esstisch', 'hue.0.Esszimmer.on'], ['Couch­tisch', 'hue.0.Wohnzimmertischlampe.on'],
    ['TV', 'hue.0.TV-Bereich.on'], ['Küche', 'hue.0.Küche.on'],
    ['Eingang', 'hue.0.Eingangsbereich.on'], ['Flur', 'hue.0.Flur.on'],
    ['Büro', 'hue.0.Arbeitszimmerlicht.on'], ['Keller', 'hue.0.Keller.on'],
    ['Spiel­zimmer', 'hue.0.Spielzimmer.on'], ['Clara Decke', 'hue.0.Claras_Deckenlampe.on'],
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
// "Alle Rollläden" lives with the shutters (it's a shutter-group action, not a scene)
var ROLL_ALL = ['Alle', 'scene.0.Alle_Rollläden'];
// Gardena: tap a valve → start WATER_SECS; "Stop" → stop_all_valves_i
var GLOC = 'smartgarden.0.LOCATION_28b39c94-2D8503-2D4ee7-2D8a95-2D7c5a0f50a8d7.';
var GDEV = GLOC + 'DEVICE_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c.';
var GVALVE = GDEV + 'SERVICE_VALVE_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c';
var GSTOP = GDEV + 'SERVICE_VALVE_SET_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c.stop_all_valves_i';
var VALVES = ['-3A1', '-3A2', '-3A3', '-3A4', '-3A5', '-3A6'];
var WATER_SECS = 600;   // tap a valve = water 10 min

function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function sStr(id) { var s = getState(id); return (s && s.val != null) ? String(s.val) : null; }
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
function icoValve(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 3 C12 3 6 10 6 14.5 a6 6 0 0 0 12 0 C18 10 12 3 12 3 Z" fill="' + c + '"/><ellipse cx="9.8" cy="14.5" rx="1.5" ry="2.2" fill="#ffffff" opacity=".35"/></svg>'; }
function icoStop(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2.5" fill="' + c + '"/></svg>'; }
function icoPower(c) { return '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + c + '" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.3 6.5a8 8 0 1 0 11.4 0"/></g></svg>'; }
// per-plug icon (reuse the overview's device icons where they match)
function plugIcon(serial, c) {
    if (serial === '0001DD89A46CAD') return icoCouch(c);
    if (serial === '0001DD89A46CE1') return icoPrinter(c);
    if (serial === '0001DD89AADDE7') return icoCabinet(c);
    if (serial === '0001DD89A46CA5') return icoBattery(c);
    return icoPlug(c);
}

function pos(x, y, w, h) { return 'style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px"'; }
function rnd(o) { return { kind: o.kind, oid: o.oid, value: o.value, x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w), h: Math.round(o.h) }; }
// renderers return {html, targets:[{kind,oid,value?,x,y,w,h}]} — targets drive the native tap-overlays
function tileHtml(cls, p, icon, cap, st) {
    return '<div class="tile' + (cls ? ' ' + cls : '') + '" ' + p + '>'
        + '<span class="ic">' + icon + '</span><span class="cap">' + esc(cap) + '</span><span class="st">' + st + '</span></div>';
}
// square light tile: no status line — state reads from the amber border + icon colour
function lightTile(it, x, y, w, h) {
    var on = sBool(it[1]);
    var html = '<div class="tile sq' + (on ? ' on' : '') + '" ' + pos(x, y, w, h) + '>'
        + '<span class="ic">' + icoBulb(on ? AMBER : LBL) + '</span><span class="cap">' + esc(it[0]) + '</span></div>';
    return { html: html, targets: [rnd({ kind: 'toggle', oid: it[1], x: x, y: y, w: w, h: h })] };
}
// square plug tile: keeps the live-W status line
function plugTile(it, x, y, w, h) {
    var oid = 'hm-rpc.1.' + it[1] + '.3.STATE';
    var on = sBool(oid); var pw = sNum('hm-rpc.1.' + it[1] + '.6.POWER');
    var st = on ? (pw != null ? Math.round(pw) + ' W' : 'an') : 'aus';
    return { html: tileHtml('sq1' + (on ? ' on' : ''), pos(x, y, w, h), plugIcon(it[1], on ? AMBER : LBL), it[0], st),
        targets: [rnd({ kind: 'toggle', oid: oid, x: x, y: y, w: w, h: h })] };
}
// Gardena valve: tap = water 10 min (write seconds to duration_value); 'STOP' marker = stop-all tile
function gardenaTile(it, x, y, w, h) {
    if (it[1] === 'STOP') {
        return { html: tileHtml('gt stop', pos(x, y, w, h), icoStop(RED), 'Stop', 'stoppen'),
            targets: [rnd({ kind: 'set', oid: GSTOP, value: true, x: x, y: y, w: w, h: h })] };
    }
    var base = GVALVE + it[1];
    var nm = sStr(base + '.name_value') || it[0];
    var act = sStr(base + '.activity_value') || '';
    var watering = /WATERING|MANUAL|SCHEDULED/i.test(act);
    var st = watering ? 'läuft' : '10 min';
    return { html: tileHtml('gt' + (watering ? ' open' : ''), pos(x, y, w, h), icoValve(watering ? BLUE : LBL), nm, st),
        targets: [rnd({ kind: 'set', oid: base + '.duration_value', value: WATER_SECS, x: x, y: y, w: w, h: h })] };
}
// SYSTEM: CCU reboot via the hm-rega script channel, guarded by a two-tap confirm
// (first tap arms for 6 s, second tap reboots — a wall panel needs the guard).
var CCU_ARM_MS = 6000, CCU_REBOOT_MS = 180000;
var ccuArmUntil = 0, ccuRebootUntil = 0;
function systemTile(it, x, y, w, h) {
    var now = Date.now();
    var conn = sBool('hm-rpc.1.info.connection');
    var cls = '', st = 'neu starten', col = LBL;
    if (now < ccuRebootUntil) { cls = 'stop'; st = 'startet neu…'; col = RED; }
    else if (now < ccuArmUntil) { cls = 'stop'; st = 'sicher? nochmal tippen'; col = RED; }
    else if (!conn) { cls = 'stop'; st = 'offline'; col = RED; }
    return { html: tileHtml(cls, pos(x, y, w, h), icoPower(col), 'CCU', st),
        targets: [rnd({ kind: 'cmd', oid: 'javascript.0.ccu_restart_cmd', value: 'go', x: x, y: y, w: w, h: h })] };
}
// shutter tile: name + position on top, three Auf/80%/Zu buttons below (each a write-target)
function shutterTile(it, x, y, w, h) {
    var isAlle = it[0] === 'Alle';
    var oidBase = isAlle ? 'javascript.0.roll_all_cmd' : 'hm-rpc.1.' + it[1] + '.4.LEVEL';
    var lvl = isAlle ? null : sNum(oidBase);
    var posTxt = isAlle ? 'alle' : (lvl != null ? Math.round(lvl) + ' %' : '–');
    var open = isAlle || (lvl != null && lvl > 5);
    var html = '<div class="tile stile' + (open ? ' open' : '') + '" ' + pos(x, y, w, h) + '>'
        + '<div class="shead">' + icoBlind(open ? BLUE : LBL) + '<span class="cap">' + esc(it[0]) + '</span><span class="st">' + posTxt + '</span></div></div>';
    var pad = 7, gap = 6, byH = 26, bw = (w - 2 * pad - 2 * gap) / 3, by = y + h - pad - byH;
    var labels = [['Auf', 100], ['50%', 50], ['Zu', 0]];
    var targets = [];
    labels.forEach(function (lb, i) {
        var bx = x + pad + i * (bw + gap);
        html += '<div class="sbtn" style="left:' + bx + 'px;top:' + by + 'px;width:' + bw + 'px;height:' + byH + 'px">' + lb[0] + '</div>';
        targets.push(rnd({ kind: 'set', oid: oidBase, value: lb[1], x: bx, y: by, w: bw, h: byH }));
    });
    return { html: html, targets: targets };
}

// one titled section card with its tile grid; targets collected for the overlay generator.
// opts: {x, w}   card rect (default full width at PADX)
//       {cols}   tile count per row (tile width fills the card), or
//       {tileW}  fixed tile width (all items in one left-aligned row of squares)
//       {rows}   row count (default 1)
function section(title, items, top, opts, render, allTargets) {
    var CPAD = 10, HEAD = 18, HGAP = 6, TH = 68, TGAP = 8, SGAP = 8;
    var sx = opts.x != null ? opts.x : PADX;
    var sw = opts.w != null ? opts.w : W - 2 * PADX;
    var rows = opts.rows || 1;
    var ix = sx + CPAD, iw = sw - 2 * CPAD;
    var tilesTop = top + CPAD + HEAD + HGAP;
    var cardH = CPAD + HEAD + HGAP + rows * TH + (rows - 1) * TGAP + CPAD;
    var html = '<div class="seccard" style="left:' + sx + 'px;top:' + top + 'px;width:' + sw + 'px;height:' + cardH + 'px"></div>'
        + '<div class="card-h" style="left:' + ix + 'px;top:' + (top + CPAD) + 'px">' + title + '</div>';
    var cols = opts.cols || items.length;
    var cw = opts.tileW != null ? opts.tileW : (iw - (cols - 1) * TGAP) / cols;
    items.forEach(function (it, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var tx = ix + c * (cw + TGAP), ty = tilesTop + r * (TH + TGAP);
        var res = render(it, tx, ty, cw, TH);
        html += res.html;
        (res.targets || []).forEach(function (t) { allTargets.push(t); });
    });
    return { html: html, nextY: top + cardH + SGAP };
}

function build() {
    var y = 4, html = '', targets = [];
    // valve names read live from name_value; the red stop-all tile lives with its valves
    var GARDENA = VALVES.map(function (v) { return ['Ventil', v]; }).concat([['Stop', 'STOP']]);
    // Lichter narrows to exactly its 12 squares (904px inner); the freed right end hosts SYSTEM
    var LW = 924;
    var L = section('Lichter', LIGHTS, y, { x: PADX, w: LW, tileW: 68 }, lightTile, targets); html += L.html;
    var S = section('System', [['CCU', 'CCU']], y, { x: PADX + LW + 8, w: W - 2 * PADX - LW - 8, cols: 1 }, systemTile, targets); html += S.html; y = L.nextY;
    var R = section('Rollläden', SHUTTERS.concat([ROLL_ALL]), y, { cols: 6 }, shutterTile, targets); html += R.html; y = R.nextY;
    // Steckdosen (5 squares, exactly 392 wide) and Garten share the third band
    var PW = 392;
    var P = section('Steckdosen', PLUGS, y, { x: PADX, w: PW, tileW: 68 }, plugTile, targets); html += P.html;
    var G = section('Garten · Bewässerung', GARDENA, y, { x: PADX + PW + 8, w: W - 2 * PADX - PW - 8, cols: 7 }, gardenaTile, targets); html += G.html; y = G.nextY;

    // emit the flat tap-target list once so the vis-views overlay generator can place native widgets
    if (!build._logged) { console.log('STEUERUNG_LAYOUT ' + JSON.stringify(targets)); build._logged = true; }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
        + '<foreignObject width="' + W + '" height="' + H + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml" class="mv2"><style>' + CSS_BASE + '</style>'
        + '<div class="wrap">' + html + '</div></div></foreignObject></svg>';
}

function publish() { setState('steuerung_grid', build(), true); }
createState('javascript.0.steuerung_grid', '', { type: 'string', role: 'html', desc: 'Steuerung tile grid' });

// "Alle Rollläden" fan-out: the Alle tile's Auf/80%/Zu buttons write 100/80/0 here; mirror to all 5
createState('javascript.0.roll_all_cmd', 0, { type: 'number', role: 'level', desc: 'Alle Rollläden Sollwert' });
on({ id: 'javascript.0.roll_all_cmd', change: 'any' }, function (obj) {
    var v = obj && obj.state ? obj.state.val : null;
    if (typeof v !== 'number') return;
    SHUTTERS.forEach(function (s) { setState('hm-rpc.1.' + s[1] + '.4.LEVEL', v); });
});

// CCU reboot (two-tap): first tap arms for 6 s, second tap sends ReGa system.Exec("reboot")
createState('javascript.0.ccu_restart_cmd', '', { type: 'string', role: 'text', desc: 'CCU Neustart (2-Tap-Bestätigung)' });
on({ id: 'javascript.0.ccu_restart_cmd', change: 'any' }, function () {
    var now = Date.now();
    if (now < ccuRebootUntil) return;                          // reboot already under way
    if (now < ccuArmUntil) {                                   // second tap → fire
        ccuArmUntil = 0; ccuRebootUntil = now + CCU_REBOOT_MS; publish();
        sendTo('hm-rega.0', 'script', 'system.Exec("reboot");', function (res) {
            console.log('[Steuerung v2] CCU reboot sent: ' + JSON.stringify(res));
        });
        setTimeout(function () { ccuRebootUntil = 0; publish(); }, CCU_REBOOT_MS);
        return;
    }
    ccuArmUntil = now + CCU_ARM_MS; publish();                 // first tap → arm
    setTimeout(function () { if (Date.now() >= ccuArmUntil) publish(); }, CCU_ARM_MS + 300);
});
// CCU back online ends the reboot hold early; also keeps the tile's offline state honest
on({ id: 'hm-rpc.1.info.connection', change: 'ne' }, function (obj) {
    if (obj && obj.state && obj.state.val === true) ccuRebootUntil = 0;
    publish();
});
// diagnostics: write anything to ccu_rega_ping to prove the ReGa script channel end-to-end
createState('javascript.0.ccu_rega_ping', '', { type: 'string', role: 'text', desc: 'ReGa channel test' });
on({ id: 'javascript.0.ccu_rega_ping', change: 'any' }, function () {
    sendTo('hm-rega.0', 'script', 'WriteLine(system.Date("%F %T"));', function (res) {
        console.log('[Steuerung v2] rega ping: ' + JSON.stringify(res));
    });
});

// re-render on any control state change
LIGHTS.forEach(function (l) { on({ id: l[1], change: 'ne' }, publish); });
PLUGS.forEach(function (p) { on({ id: 'hm-rpc.1.' + p[1] + '.3.STATE', change: 'ne' }, publish); on({ id: 'hm-rpc.1.' + p[1] + '.6.POWER', change: 'ne' }, publish); });
SHUTTERS.forEach(function (s) { on({ id: 'hm-rpc.1.' + s[1] + '.4.LEVEL', change: 'ne' }, publish); });

setTimeout(publish, 2000);
schedule('*/2 * * * *', publish);
console.log('[Steuerung v2] initialized');
