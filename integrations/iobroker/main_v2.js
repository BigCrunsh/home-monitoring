// Redesigned Main — "Neu" tab. HTML/CSS rebuild (frontend-design–led), rendered into
// javascript.0.main_v2_card and shown on the Main2 view via a tplValueStringRaw (role html) widget.
// The HTML is wrapped in an SVG <foreignObject> so it scales-to-fill the 1170×676 widget exactly
// like the old SVG card did (preserveAspectRatio). Design system = ground-truth palette + a token
// set (4px spacing grid, radii by nesting level, 5 type roles, one unit rule, two bar concepts);
// see openspec .../SESSION-HANDOFF.md and the scratchpad TOKENS-audit.md. Data wiring/logic is
// unchanged from the SVG version; only rendering changed. Interactive Steuerung controls + the
// house-status ribbon are separate native/secondary widgets (next phase); here the Steuerung tiles
// are drawn for layout. Pi OS TZ is Europe/London → wall-clock values rendered in Europe/Berlin.

// ===== scoped CSS (everything under .mv2 so it never clashes with vis-user.css / other widgets) =====
var CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Expanded:wght@600;700&display=swap');
.mv2{
  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;
  --text:#CCCCCC; --muted:#8A8A8A; --mute:#7F8A99;
  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;
  --green-16:rgba(181,251,91,.16); --amber-16:rgba(241,190,61,.16); --blue-16:rgba(80,128,172,.16); --red-16:rgba(160,6,41,.22); --muted-16:rgba(138,138,138,.16);
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px;
  --r2:14px; --r3:10px;
  --t-hero:84px; --t-metric:27px; --t-sub:18px; --t-label:14px; --t-cap:12px;
  width:1170px; height:676px; box-sizing:border-box; background:var(--bg);
  padding:var(--s4); display:grid; grid-template-rows:118px 1fr; gap:var(--s3);
  font-family:'Archivo',system-ui,sans-serif; color:var(--text);
  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;
}
.mv2 *{margin:0; padding:0; box-sizing:border-box}
.mv2 .num{font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1}
.mv2 .exp{font-family:'Archivo Expanded','Archivo',sans-serif}
.mv2 .u{font-size:max(12px,.42em); color:var(--muted); font-weight:500; letter-spacing:0}
.mv2 .eyebrow{font-size:var(--t-cap); letter-spacing:.16em; text-transform:uppercase; color:var(--muted); font-weight:600; display:flex; align-items:center; gap:var(--s2)}
.mv2 .eyebrow .status{margin-left:auto; letter-spacing:.01em; text-transform:none; font-size:var(--t-label); font-weight:600}

/* HERO */
.mv2 .hero{display:flex; justify-content:space-between; align-items:stretch; padding:var(--s1) var(--s1) 0; border-bottom:1px solid var(--border)}
.mv2 .h-left{display:flex; flex-direction:column; justify-content:flex-start}
.mv2 .m2clk{font-size:var(--t-hero); font-weight:700; line-height:.84; letter-spacing:-.02em}
.mv2 .m2clk .sep{opacity:.35; font-weight:600}
.mv2 .m2date{margin-top:var(--s3); font-size:var(--t-sub); color:var(--muted); font-weight:500}
.mv2 .h-center{display:flex; gap:var(--s6); align-items:center; justify-content:center}
.mv2 .alm-col{display:flex; flex-direction:column; gap:var(--s3)}
.mv2 .alm{display:flex; align-items:center; gap:var(--s2); height:21px}
.mv2 .alm .v{font-size:var(--t-sub); font-weight:600}
.mv2 .alm .k{font-size:var(--t-cap); color:var(--muted); letter-spacing:.04em; margin-left:1px}
.mv2 .moonwrap{display:flex; flex-direction:column; align-items:center; gap:var(--s1)}
.mv2 .moonlabel{font-size:var(--t-cap); color:var(--muted); letter-spacing:.05em}
.mv2 .h-right{display:flex; align-items:stretch; gap:var(--s4)}
.mv2 .h-metrics{display:flex; flex-direction:column; justify-content:center; gap:var(--s3)}
.mv2 .h-metrics .line{display:flex; align-items:center; gap:var(--s2); font-size:var(--t-label); color:var(--muted); height:21px}
.mv2 .h-metrics .line b{color:var(--text); font-weight:600; font-size:var(--t-sub)}
.mv2 .h-wx{display:flex; align-items:center; justify-content:center; align-self:center}
.mv2 .h-wx img{height:92px; width:auto; display:block}
.mv2 .h-temp{display:flex; flex-direction:column; justify-content:flex-start; align-items:flex-end}
.mv2 .otemp{font-size:var(--t-hero); font-weight:700; line-height:.84; letter-spacing:-.03em; white-space:nowrap}
.mv2 .mm{display:flex; gap:var(--s5); margin-top:var(--s2); align-items:flex-start}
.mv2 .mm .pair{display:flex; align-items:stretch; gap:var(--s1)}
.mv2 .mm .pair .n{font-size:42px; font-weight:700; line-height:.78}
.mv2 .mm .pair .ux{display:flex; flex-direction:column; justify-content:space-between; line-height:1; padding:2px 0; color:var(--muted); font-weight:500; font-size:13px}

/* ZONES */
.mv2 .zones{display:grid; grid-template-columns:1fr 1fr 1fr; gap:var(--s3); min-height:0}
.mv2 .col{display:grid; gap:var(--s3); min-height:0}
.mv2 .col.mid{grid-template-rows:2.2fr 1fr}
.mv2 .col.right{grid-template-rows:1.15fr 1fr}
.mv2 .card{background:var(--surface); border:1px solid var(--border); border-radius:var(--r2); padding:var(--s3) var(--s4); display:flex; flex-direction:column; gap:var(--s2); min-height:0; overflow:hidden}
.mv2 .card--accent{border-color:rgba(181,251,91,.55); box-shadow:0 0 0 1px rgba(181,251,91,.12)}
.mv2 .card-body{flex:1; min-height:0; display:flex; flex-direction:column; gap:var(--s2)}

/* KLIMA */
.mv2 .klima .rooms{flex:1; display:grid; grid-template-rows:repeat(4,1fr); gap:var(--s2)}
.mv2 .room{display:grid; grid-template-columns:auto 1fr auto; grid-template-rows:auto auto auto; column-gap:var(--s3); row-gap:var(--s1); align-items:center; background:var(--bg); border-radius:var(--r3); padding:var(--s2) var(--s4) var(--s2) var(--s3)}
.mv2 .thermo{grid-column:1; grid-row:1 / 4; align-self:center; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center}
.mv2 .room .name{grid-column:2; grid-row:1; font-size:var(--t-label); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mv2 .room .op{grid-column:2; grid-row:2; display:flex; align-items:center; gap:var(--s2); font-size:var(--t-cap); font-weight:500; color:var(--muted)}
.mv2 .room .op .batt{display:flex; align-items:center; gap:3px}
.mv2 .room .sub{grid-column:2; grid-row:3; display:flex; align-items:center; gap:var(--s3); font-size:var(--t-cap)}
.mv2 .room .sub .metric{display:flex; align-items:center; gap:var(--s1)}
.mv2 .room .sub .metric svg{flex:none}
.mv2 .room .sub .metric .un{color:var(--muted); font-weight:500}
.mv2 .room .temp{grid-column:3; grid-row:1 / 3; align-self:center; justify-self:end; font-size:34px; font-weight:700; line-height:1; white-space:nowrap}
.mv2 .room .word{grid-column:3; grid-row:3; justify-self:end; align-self:center; font-size:var(--t-cap); color:var(--muted)}

/* WOCHE */
.mv2 .woche .days{flex:1; display:flex; flex-direction:column; min-height:0}
.mv2 .drow{display:grid; grid-template-columns:40px 1fr; gap:var(--s3); align-items:start; border-top:1px solid var(--border); padding:var(--s1) 2px}
.mv2 .drow:first-child{border-top:none}
.mv2 .drow.today,.mv2 .drow.we{margin:0 calc(-1 * var(--s2)); padding-left:calc(var(--s2) + 2px); padding-right:calc(var(--s2) + 2px); border-radius:var(--r3); border-top-color:transparent}
.mv2 .drow.today{background:rgba(241,190,61,.09)}
.mv2 .drow.we{background:rgba(80,128,172,.12)}
.mv2 .drow.today .dow,.mv2 .drow.today .dnum{color:var(--amber)}
.mv2 .drow.we .dow,.mv2 .drow.we .dnum{color:var(--blue)}
.mv2 .drow .dcell{display:flex; flex-direction:column; line-height:1.05}
.mv2 .drow .dow{font-size:var(--t-label); font-weight:700}
.mv2 .drow .dnum{font-size:var(--t-cap); color:var(--muted)}
.mv2 .drow .ev{display:flex; flex-direction:column; gap:2px; min-width:0}
.mv2 .drow .e{font-size:var(--t-label); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.25}
.mv2 .drow .e .t{color:var(--muted); font-weight:600; margin-right:var(--s2)}
.mv2 .drow .none{font-size:var(--t-label); color:var(--mute)}

/* shared SPECTRUM bar (price position: Tanken + Strompreis) */
.mv2 .spectrum{display:flex; flex-direction:column; gap:var(--s1)}
.mv2 .spectrum .bar{height:5px; border-radius:3px; position:relative; background:linear-gradient(90deg,var(--green),var(--amber),var(--red)); opacity:.82}
.mv2 .spectrum .knob{position:absolute; top:50%; width:10px; height:10px; border-radius:50%; background:var(--text); border:2px solid var(--surface); transform:translate(-50%,-50%)}
.mv2 .spectrum .mmrow{display:flex; justify-content:space-between; font-size:var(--t-cap)}
.mv2 .spectrum .mmrow .lo{color:var(--green)} .mv2 .spectrum .mmrow .hi{color:var(--red)}

/* TANKEN */
.mv2 .tanken .fuels{flex:1; display:grid; grid-template-rows:1fr 1fr; gap:var(--s2)}
.mv2 .fuel{display:grid; grid-template-columns:124px 1fr; grid-template-rows:auto auto; column-gap:var(--s4); row-gap:var(--s2); align-items:center}
.mv2 .fuel .fhead{grid-column:1; grid-row:1; display:flex; align-items:baseline; gap:var(--s2)}
.mv2 .fuel .fname{font-size:var(--t-label); font-weight:600}
.mv2 .fuel .fago{font-size:var(--t-cap); color:var(--muted)}
.mv2 .fuel .price{grid-column:1; grid-row:2; font-size:var(--t-metric); font-weight:700; line-height:1; white-space:nowrap}
.mv2 .fuel .price .sup{font-size:.52em; vertical-align:super; margin-left:1px}
.mv2 .fuel .verdict{grid-column:2; grid-row:1; justify-self:end; font-size:var(--t-label); font-weight:600}
.mv2 .fuel .barwrap{grid-column:2; grid-row:2}

/* ENERGIE */
.mv2 .energie .price-head{display:flex; align-items:baseline; gap:var(--s2); font-size:var(--t-cap)}
.mv2 .energie .price-head .lbl{color:var(--muted)}
.mv2 .energie .price-head .val{font-size:var(--t-sub); font-weight:700}
.mv2 .energie .price-head .verdict{font-weight:600; font-size:var(--t-label)}
.mv2 .energie .price-head .net{margin-left:auto; font-weight:600; font-size:var(--t-label)}
.mv2 .energie .flows{flex:1; display:grid; grid-template-rows:repeat(4,1fr)}
.mv2 .flow{display:grid; grid-template-columns:24px 84px 1fr 70px; align-items:center; gap:var(--s2)}
.mv2 .flow .fi{display:flex; align-items:center; justify-content:center}
.mv2 .flow .fl{font-size:var(--t-label); color:var(--muted)}
.mv2 .flow .track{height:6px; border-radius:3px; background:var(--inset)}
.mv2 .flow .fill{height:6px; border-radius:3px}
.mv2 .flow .fv{text-align:right; font-size:var(--t-sub); font-weight:700; white-space:nowrap}
.mv2 .estats{display:flex; gap:var(--s4); border-top:1px solid var(--border); padding-top:var(--s2); align-items:baseline}
.mv2 .estat{flex:1; display:flex; align-items:baseline; gap:var(--s2)}
.mv2 .estat .v{font-size:var(--t-metric); font-weight:700; line-height:1}
.mv2 .estat .l{font-size:var(--t-cap); color:var(--muted); letter-spacing:.02em}
.mv2 .estat+.estat{border-left:1px solid var(--border); padding-left:var(--s4)}

/* STEUERUNG (tiles drawn for layout; interactivity = native widgets, next phase) */
.mv2 .steuerung .controls{flex:1; display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:1fr 1fr; gap:var(--s2)}
.mv2 .tile{background:var(--bg); border:1px solid var(--border); border-radius:var(--r3); padding:var(--s2) var(--s1); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--s1); min-height:0}
.mv2 .tile .ic{height:26px; display:flex; align-items:center; justify-content:center}
.mv2 .tile .cap{font-size:var(--t-label); color:var(--muted); font-weight:600}
.mv2 .tile .st{font-size:var(--t-cap); color:var(--mute)}
.mv2 .tile.on{border-color:rgba(241,190,61,.55)} .mv2 .tile.on .cap{color:var(--text)} .mv2 .tile.on .st{color:var(--amber)}
.mv2 .tile.scene{border-color:rgba(80,128,172,.45)} .mv2 .tile.scene .st{color:var(--blue)}
.mv2 .tile.arm{border-color:rgba(216,83,111,.6)} .mv2 .tile.arm .cap{color:var(--text)} .mv2 .tile.arm .st{color:#d8536f}
`;

// ===== colour tokens (data-driven colour = scoped CSS var names) =====
var GREEN = 'var(--green)', AMBER = 'var(--amber)', BLUE = 'var(--blue)', RED = 'var(--red)',
    VAL = 'var(--text)', LBL = 'var(--muted)', MUTE = 'var(--mute)';

// ===== data helpers =====
function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function sStr(id) { var s = getState(id); return (s && s.val != null) ? String(s.val) : null; }
function sBool(id) { var s = getState(id); return !!(s && s.val); }
function comma(v, d) { return (typeof v === 'number') ? v.toFixed(d == null ? 1 : d).replace('.', ',') : '–'; }
function pad2(n) { return ('0' + n).slice(-2); }
function hhmmBerlin(dt) { return dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }); }
function berlinNow() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })); }
function dayKey(dt) { return dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }); }
function ageMs(luVal) { if (!luVal) return null; var t = new Date(luVal).getTime(); return isNaN(t) ? null : (Date.now() - t); }
function agoStr(luVal) {
    var ms = ageMs(luVal); if (ms == null) return null;
    var s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? s + ' s' : (s < 3600 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h');
}
function comfortCol(t) { return t == null ? LBL : (t <= 3 ? LBL : (t < 12 ? BLUE : (t < 20 ? GREEN : (t < 27 ? AMBER : RED)))); }
function comfortTint(t) { return t == null ? 'var(--muted-16)' : (t <= 3 ? 'var(--muted-16)' : (t < 12 ? 'var(--blue-16)' : (t < 20 ? 'var(--green-16)' : (t < 27 ? 'var(--amber-16)' : 'var(--red-16)')))); }
function comfortWord(t) { return t == null ? '' : (t < 12 ? 'kalt' : (t < 20 ? 'kühl' : (t < 27 ? 'warm' : 'heiß'))); }
function co2Col(c) { return c == null ? LBL : (c < 1000 ? GREEN : (c < 1400 ? AMBER : RED)); }
function humCol(h) { return h == null ? LBL : (h < 40 ? AMBER : (h <= 60 ? GREEN : BLUE)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function clip(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n - 1) + '…' : s); }
// calendar event symbols — verbatim from the old ical_events.js (gift/ring/worker + kids' hearts)
function calSym(s) {
    return String(s == null ? '' : s)
        .split('[Geburtstag]').join('🎁').split('[Hochzeitstag]').join('💍')
        .split('[Müllabfuhr]').join('👷').split('Abholung').join('👷')
        .split('[Carlotta]').join('🩵').split('[Clara]').join('💜').split('[Clea]').join('🧡');
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function watts(v) { var a = Math.abs(v || 0); return a >= 1000 ? comma(a / 1000, 1) + '<span class="u">kW</span>' : Math.round(a) + '<span class="u">W</span>'; }

// price 1,659 with the third decimal raised
function priceSuper(v) {
    if (v == null) return '–';
    var s = v.toFixed(3);
    return s.slice(0, 4).replace('.', ',') + '<span class="sup num">' + s.slice(4) + '</span>';
}

// ===== state IDs =====
var NB = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
var OUTDOOR = NB + '.02-00-00-32-ae-a4';
var FCMIN = 'daswetter.0.NextDays.Location_1.Day_1.Minimale_Temperatur_value';
var FCMAX = 'daswetter.0.NextDays.Location_1.Day_1.Maximale_Temperatur_value';
// Klima: Außen lives in the hero now; 4 rooms here.
var ROOMS = [
    ['Wohnzimmer', NB],
    ['Carlottas Zimmer', NB + '.03-00-00-0e-16-36'],
    ['Claras Zimmer', NB + '.03-00-00-0f-01-6e'],
    ['Cleas Zimmer', NB + '.03-00-00-10-e5-42']
];
// Steuerung — the proven control set ("what we had before"), restyled. Lights = Hue .on / plug .STATE
// (boolean). Maxxisun = guarded plug. Garten = Gardena valves (start = write seconds; tap interactivity
// is the native-widget overlay phase). State IDs verified on the Pi.
var LIGHTS = [
    ['Küche', 'hue.0.Küche.on'], ['Esstisch', 'hue.0.Esszimmer.on'], ['Wohnen', 'hue.0.Wohnzimmertischlampe.on'],
    ['Flur', 'hue.0.Flur.on'], ['Büro', 'hue.0.Arbeitszimmerlicht.on'], ['Maxxi', 'hm-rpc.1.0001DD89A46CA5.3.STATE', 'mx']
];
var GARD = 'smartgarden.0.LOCATION_28b39c94-2D8503-2D4ee7-2D8a95-2D7c5a0f50a8d7.DEVICE_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c.SERVICE_VALVE_b193e1f6-2Db1bc-2D4488-2D9f9d-2Deabf9771e46c';
var VALVES = [['Rand', '-3A1'], ['Vor', '-3A2'], ['Trauf', '-3A3'], ['Dach', '-3A4'], ['Gart', '-3A5'], ['Hoch', '-3A6']];
var DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
var DAYS_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
var EN = 'javascript.0.';

// ===== icon snippets (inline SVG) =====
function icoThermo(col) { return '<svg width="16" height="22" viewBox="0 0 16 22"><rect x="6" y="1" width="4" height="13" rx="2" fill="' + col + '"/><circle cx="8" cy="17" r="4.5" fill="' + col + '"/></svg>'; }
function icoDrop(col, sz) { sz = sz || 16; return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24"><path d="M12 2.5 C12 2.5 5.5 10.5 5.5 15.2 a6.5 6.5 0 0 0 13 0 C18.5 10.5 12 2.5 12 2.5 Z" fill="' + col + '"/><ellipse cx="9.6" cy="15.2" rx="1.6" ry="2.4" fill="#ffffff" opacity="0.35"/></svg>'; }
function icoBatt(pct, col) {
    var w = (pct == null ? 0 : clamp01(pct / 100) * 10.0).toFixed(1);
    return '<svg width="17" height="11" viewBox="0 0 17 11"><rect x="1" y="2" width="12" height="7" rx="1.4" fill="none" stroke="' + col + '" stroke-width="1.2"/>'
        + '<rect x="13.4" y="4" width="1.8" height="3" rx=".6" fill="' + col + '"/>'
        + '<rect x="2.3" y="3.2" width="' + w + '" height="4.6" rx=".7" fill="' + col + '"/></svg>';
}
function icoGauge(sz) { sz = sz || 16; return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24"><g fill="none" stroke="#8A8A8A" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><line x1="12" y1="7.5" x2="12" y2="9.2"/><line x1="16.5" y1="12" x2="14.8" y2="12"/><line x1="7.5" y1="12" x2="9.2" y2="12"/><line x1="12" y1="12" x2="15.4" y2="9.2"/></g><circle cx="12" cy="12" r="1.6" fill="#8A8A8A"/></svg>'; }
function icoSunSmall() { return '<svg width="18" height="18" viewBox="0 0 22 22"><g stroke="#F1BE3D" stroke-width="1.5" fill="none" stroke-linecap="round"><circle cx="11" cy="11" r="3.4" fill="#F1BE3D" stroke="none"/><line x1="11" y1="2.5" x2="11" y2="4.6"/><line x1="11" y1="17.4" x2="11" y2="19.5"/><line x1="2.5" y1="11" x2="4.6" y2="11"/><line x1="17.4" y1="11" x2="19.5" y2="11"/><line x1="5" y1="5" x2="6.5" y2="6.5"/><line x1="15.5" y1="15.5" x2="17" y2="17"/><line x1="17" y1="5" x2="15.5" y2="6.5"/><line x1="6.5" y1="15.5" x2="5" y2="17"/></g></svg>'; }
function icoSunset() { return '<svg width="18" height="18" viewBox="0 0 22 22"><g stroke="#8A8A8A" stroke-width="1.5" fill="none" stroke-linecap="round"><circle cx="11" cy="13" r="3.4"/><line x1="11" y1="3" x2="11" y2="6"/><path d="M5 19 H17"/></g></svg>'; }
// moon — light disc + a bg-coloured shadow ellipse offset by phase (0..7). Approximate but live.
function moonSvg(phase) {
    if (phase == null || isNaN(phase)) phase = 6;
    phase = ((Math.round(phase) % 8) + 8) % 8;
    var R = 16, lit = '#e9ebef', dark = '#15161c';
    var s = '<svg width="44" height="44" viewBox="0 0 44 44"><defs><clipPath id="mvmc"><circle cx="22" cy="22" r="' + R + '"/></clipPath></defs>';
    s += '<circle cx="22" cy="22" r="' + R + '" fill="' + dark + '"/><g clip-path="url(#mvmc)"><circle cx="22" cy="22" r="' + R + '" fill="' + lit + '"/>';
    if (phase === 0) { s += '<circle cx="22" cy="22" r="' + R + '" fill="' + dark + '"/>'; }
    else if (phase !== 4) {
        var waning = phase >= 5, crescent = (phase === 1 || phase === 3 || phase === 5 || phase === 7);
        var rx = crescent ? R - 0.5 : R * 0.5;
        var cx = waning ? 22 + (crescent ? R * 0.62 : R * 0.22) : 22 - (crescent ? R * 0.62 : R * 0.22);
        s += '<ellipse cx="' + cx.toFixed(1) + '" cy="22" rx="' + rx.toFixed(1) + '" ry="' + R + '" fill="' + dark + '"/>';
    }
    return s + '</g></svg>';
}
function moonLabel(phase) {
    if (phase == null || isNaN(phase)) return '';
    phase = ((Math.round(phase) % 8) + 8) % 8;
    return phase === 0 ? 'Neumond' : (phase === 4 ? 'Vollmond' : (phase < 4 ? 'zunehmend' : 'abnehmend'));
}
// Weather symbol = the native daswetter art (galeria1, ids 1..22), embedded inline as a same-origin
// <img> beside the big temp (the foreignObject HTML rebuild makes the old native-overlay widget
// unnecessary; this auto-aligns + scales + survives the Neu→Main move). Falls back to nothing if the id is out of range.
function wxImg(id) {
    if (id == null || isNaN(id) || id < 1 || id > 22) return '';
    return '<div class="h-wx"><img src="/daswetter.admin/icons/tiempo-weather/galeria1/' + Math.round(id) + '.png" alt=""/></div>';
}
function enIco(kind, col) {
    var g = '<svg width="18" height="18" viewBox="0 0 18 18"><g stroke="' + col + '" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">';
    if (kind === 'sun') {
        g += '<circle cx="9" cy="9" r="3.4"/><line x1="9" y1="1.5" x2="9" y2="3.4"/><line x1="9" y1="14.6" x2="9" y2="16.5"/><line x1="1.5" y1="9" x2="3.4" y2="9"/><line x1="14.6" y1="9" x2="16.5" y2="9"/><line x1="4" y1="4" x2="5.3" y2="5.3"/><line x1="12.7" y1="12.7" x2="14" y2="14"/><line x1="14" y1="4" x2="12.7" y2="5.3"/><line x1="5.3" y1="12.7" x2="4" y2="14"/>';
    } else if (kind === 'battery') {
        g += '<rect x="2" y="5" width="13" height="8" rx="1.6"/><line x1="15.5" y1="7.5" x2="15.5" y2="10.5" stroke-width="2.4"/>';
    } else if (kind === 'grid') {
        g += '<line x1="3" y1="15" x2="6" y2="3"/><line x1="15" y1="15" x2="12" y2="3"/><line x1="6" y1="3" x2="12" y2="3"/><line x1="4.5" y1="9" x2="13.5" y2="9"/>';
    } else if (kind === 'house') {
        g += '<path d="M2 8 L9 2 L16 8"/><rect x="4.5" y="8" width="9" height="7" rx="1"/>';
    }
    return g + '</g></svg>';
}

// ===== shared components =====
// price-position classifier shared by Tanken + Strompreis. Missing data → muted "–" (no false verdict).
function priceBand(price, p20, p80) {
    if (price == null || p20 == null || p80 == null) return { band: -1, col: LBL, word: '–' };
    var band = price <= p20 ? 0 : (price >= p80 ? 2 : 1);
    return { band: band, col: [GREEN, AMBER, RED][band], word: ['günstig', 'mittel', 'teuer'][band] };
}
function spectrum(knobPct, loStr, hiStr) {
    return '<div class="spectrum"><div class="bar"><div class="knob" style="left:' + knobPct.toFixed(0) + '%"></div></div>'
        + '<div class="mmrow"><span class="lo num">' + loStr + '</span><span class="hi num">' + hiStr + '</span></div></div>';
}

// ===== HERO =====
function buildHero() {
    var b = berlinNow();
    var sr = sStr(EN + 'sunrise'), ss = sStr(EN + 'sunset');
    var mr = sStr(EN + 'moonrise'), ms = sStr(EN + 'moonset'), mph = sNum(EN + 'moon_phase');
    var ot = sNum(OUTDOOR + '.Temperature.Temperature'), mn = sNum(FCMIN), mx = sNum(FCMAX);
    var oh = sNum(OUTDOOR + '.Humidity.Humidity');
    var pr = sNum(NB + '.Pressure.Pressure'), prt = getState(NB + '.Pressure.PressureTrend');
    var trend = (prt && prt.val === 'up') ? '↑' : ((prt && prt.val === 'down') ? '↓' : '→');
    var wsym = sNum('daswetter.0.NextDays.Location_1.Day_1.Wetter_Symbol_id');

    var h = '<div class="hero">';
    // left: clock + date
    h += '<div class="h-left"><div class="m2clk num exp">' + pad2(b.getHours()) + '<span class="sep">:</span>' + pad2(b.getMinutes()) + '</div>'
        + '<div class="m2date">' + DAYS_FULL[b.getDay()] + ', ' + b.getDate() + '. ' + MONTHS[b.getMonth()] + '</div></div>';
    // centre: sun + moon almanac
    h += '<div class="h-center">'
        + '<div class="alm-col">'
        + '<div class="alm">' + icoSunSmall() + '<span class="v num">' + esc(sr || '–') + '</span><span class="k">auf</span></div>'
        + '<div class="alm">' + icoSunset() + '<span class="v num">' + esc(ss || '–') + '</span><span class="k">unter</span></div></div>'
        + '<div class="moonwrap">' + moonSvg(mph) + '<span class="moonlabel">' + moonLabel(mph) + '</span></div>'
        + '<div class="alm-col">'
        + '<div class="alm"><span class="v num">' + esc(mr || '–') + '</span><span class="k">auf</span></div>'
        + '<div class="alm"><span class="v num">' + esc(ms || '–') + '</span><span class="k">unter</span></div></div></div>';
    // right: humidity/pressure (aligned with auf/unter) + big temp + min/max
    h += '<div class="h-right"><div class="h-metrics">'
        + '<div class="line">' + icoDrop('#5080AC', 18) + '<b class="num">' + (oh != null ? Math.round(oh) : '–') + '</b><span class="u">%</span></div>'
        + '<div class="line">' + icoGauge(18) + '<b class="num">' + (pr != null ? Math.round(pr) : '–') + '</b><span class="u">mbar ' + trend + '</span></div></div>'
        + wxImg(wsym)
        + '<div class="h-temp"><div class="otemp num" style="color:' + comfortCol(ot) + '">' + comma(ot, 1) + '<span class="u">°C</span></div>'
        + '<div class="mm">'
        + '<div class="pair"><span class="n num" style="color:' + comfortCol(mn) + '">' + comma(mn, 0) + '</span><span class="ux"><span>°C</span><span>min</span></span></div>'
        + '<div class="pair"><span class="n num" style="color:' + comfortCol(mx) + '">' + comma(mx, 0) + '</span><span class="ux"><span>°C</span><span>max</span></span></div>'
        + '</div></div></div>';
    return h + '</div>';
}

// ===== KLIMA =====
function buildRoom(name, module) {
    var t = sNum(module + '.Temperature.Temperature'), hh = sNum(module + '.Humidity.Humidity'),
        c = sNum(module + '.CO2.CO2'), bs = sNum(module + '.BatteryStatus');
    var lu = getState(module + '.LastUpdate'), luv = lu && lu.val ? lu.val : null, ago = agoStr(luv);
    var luMs = ageMs(luv), stale = luMs != null && luMs > 3600000;  // >60 min = stale sensor (alarm)
    var cc = comfortCol(t);
    var h = '<div class="room">';
    h += '<div class="thermo" style="background:' + comfortTint(t) + '">' + icoThermo(cc) + '</div>';
    h += '<div class="name">' + esc(name) + '</div>';
    // operational: last-update (red when stale) + battery (red <20, amber <30)
    h += '<div class="op"><span' + (stale ? ' style="color:' + RED + '"' : '') + '>vor ' + (ago || '–') + '</span>';
    if (bs != null) { var bcol = bs < 20 ? RED : (bs < 30 ? AMBER : LBL); h += '<span class="batt" style="color:' + bcol + '">' + icoBatt(bs, bcol) + Math.round(bs) + '%</span>'; }
    h += '</div>';
    // environmental: humidity + CO2
    h += '<div class="sub">'
        + '<span class="metric">' + icoDrop('#5080AC', 13) + '<span style="color:' + humCol(hh) + '">' + (hh != null ? Math.round(hh) : '–') + '</span><span class="un">%</span></span>';
    if (c != null) { h += '<span class="metric"><span style="color:' + co2Col(c) + '">' + Math.round(c) + '</span><span class="un">ppm</span></span>'; }
    h += '</div>';
    h += '<div class="temp num" style="color:' + cc + '">' + comma(t, 1) + '<span class="u">°C</span></div>';
    h += '<div class="word">' + comfortWord(t) + '</div>';
    return h + '</div>';
}
function buildKlima() {
    var h = '<div class="card klima"><div class="eyebrow">Klima<span class="status" style="color:' + LBL + '">' + ROOMS.length + ' Räume</span></div><div class="card-body"><div class="rooms">';
    ROOMS.forEach(function (r) { h += buildRoom(r[0], r[1]); });
    return h + '</div></div></div>';
}

// ===== WOCHE — all events/day, time-sorted; trim whole trailing days when busy =====
function buildWoche() {
    var tbl = getState('ical.0.data.table'), arr = (tbl && tbl.val) ? tbl.val : [];
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } }
    var byDay = {};
    (arr || []).forEach(function (e) {
        var dt = e && e._date ? new Date(e._date) : null;
        if (!dt || isNaN(dt.getTime())) return;
        var k = dayKey(dt);
        (byDay[k] = byDay[k] || []).push({ dt: dt, allDay: e._allDay === true, title: e.event || '' });
    });
    var b = berlinNow();
    // Fit guard (the card can't measure its own height server-side): a sparse day ≈ 2 height-units
    // (the date marker), each shown event ≈ 1 unit. Cap a single day to DAY_CAP events (+"weitere"),
    // and drop whole trailing days once the budget is spent — so a crammed day can never overflow/clip.
    var UNIT_BUDGET = 15, DAY_CAP = 4, used = 0, rows = '', dropped = 0;
    for (var i = 0; i < 7; i++) {
        var dd = new Date(b.getFullYear(), b.getMonth(), b.getDate() + i);
        var dow = dd.getDay(), weekend = (dow === 0 || dow === 6), today = (i === 0);
        var evs = (byDay[dayKey(dd)] || []).sort(function (a, c) { return a.dt - c.dt; });
        // dedup repeated events (same time + title), as the old calendar did
        var seen = {}, ded = [];
        evs.forEach(function (ev) { var k = (ev.allDay ? 'gz' : hhmmBerlin(ev.dt)) + '|' + ev.title; if (!seen[k]) { seen[k] = 1; ded.push(ev); } });
        evs = ded;
        var shown = evs.slice(0, DAY_CAP), moreInDay = evs.length - shown.length;
        var units = Math.max(2, shown.length + (moreInDay > 0 ? 1 : 0));
        if (i > 0 && used + units > UNIT_BUDGET) { dropped = 7 - i; break; }
        used += units;
        var cls = today ? ' today' : (weekend ? ' we' : '');
        rows += '<div class="drow' + cls + '"><div class="dcell"><span class="dow">' + DAYS_SHORT[dow] + '</span><span class="dnum">' + dd.getDate() + '.</span></div><div class="ev">';
        if (!evs.length) { rows += '<div class="none">—</div>'; }
        else {
            shown.forEach(function (ev) {
                var tm = ev.allDay ? 'ganztägig' : hhmmBerlin(ev.dt);
                rows += '<div class="e"><span class="t' + (ev.allDay ? '' : ' num') + '">' + esc(tm) + '</span>' + clip(calSym(ev.title), 28) + '</div>';
            });
            if (moreInDay > 0) rows += '<div class="e none">+ ' + moreInDay + ' weitere</div>';
        }
        rows += '</div></div>';
    }
    if (dropped > 0) rows += '<div class="drow"><div class="dcell"></div><div class="ev"><div class="none">+ ' + dropped + ' weitere Tage</div></div></div>';
    return '<div class="card woche"><div class="eyebrow">Woche</div><div class="card-body"><div class="days">' + rows + '</div></div></div>';
}

// ===== TANKEN =====
function buildFuel(name, feedOid, base) {
    var price = sNum(feedOid), p20 = sNum(base + '_p20'), p80 = sNum(base + '_p80'),
        mn = sNum(base + '_min'), mx = sNum(base + '_max');
    var lu = getState(feedOid), ago = lu ? agoStr(lu.lc || lu.ts) : null;
    var pb = priceBand(price, p20, p80), col = pb.col, word = pb.word;
    var pos = (mn != null && mx != null && mx > mn && price != null) ? clamp01((price - mn) / (mx - mn)) * 100 : 50;
    var h = '<div class="fuel">';
    h += '<div class="fhead"><span class="fname">' + name + '</span><span class="fago">vor ' + (ago || '–') + '</span></div>';
    h += '<div class="verdict" style="color:' + col + '">' + word + '</div>';
    h += '<div class="price" style="color:' + col + '">' + priceSuper(price) + '<span class="u">€/l</span></div>';
    h += '<div class="barwrap">' + spectrum(pos, comma(mn, 3), comma(mx, 3)) + '</div>';
    return h + '</div>';
}
function buildTanken() {
    return '<div class="card tanken"><div class="eyebrow">Tanken</div><div class="card-body"><div class="fuels">'
        + buildFuel('Diesel', 'tankerkoenig.0.stations.1.diesel.feed', 'javascript.0.tankerkoenig_quantiles.diesel')
        + buildFuel('E5', 'tankerkoenig.0.stations.1.e5.feed', 'javascript.0.tankerkoenig_quantiles.e5')
        + '</div></div></div>';
}

// ===== ENERGIE =====
function enRoleCol(val, favourable, high) {
    var m = Math.abs(val || 0);
    if (favourable) return m < 75 ? LBL : GREEN;
    if (m < 150) return LBL;
    return m < (high || 2000) ? AMBER : RED;
}
function buildEnergie() {
    var prodTotal = sNum(EN + 'power_production'), maxxi = sNum(EN + 'power_maxxisun'),
        feedin = sNum(EN + 'power_feedin'), purchased = sNum(EN + 'power_purchased'),
        haus = sNum(EN + 'power_consumption'), autark = sNum(EN + 'rate_autarky'),
        eigen = sNum(EN + 'rate_selfconsumption'),
        price = sNum(EN + 'tibber_states.energy_price_euro'),
        p20 = sNum(EN + 'tibber_states.energy_price_euro_p20'),
        p80 = sNum(EN + 'tibber_states.energy_price_euro_p80');
    var staleS = getState(EN + 'power_data_stale'), stale = !!(staleS && staleS.val === true);
    var se = prodTotal != null ? Math.max(0, prodTotal - Math.max(0, -(maxxi || 0))) : null;  // SolarEdge-only
    var grid = (purchased || 0) - (feedin || 0);
    var imp = grid > 50, exp = grid < -50;
    var gridCol = enRoleCol(grid, grid < 0);
    var statusWord = exp ? 'Einspeisung' : (imp ? 'Netzbezug' : 'Ausgeglichen');
    var net = grid > 0 ? grid / 1000 * (price || 0) : grid / 1000 * 0.1048;
    // net>0 = importing (a cost, "−"); net<0 = exporting (income, "+")
    var netZero = Math.abs(net) < 0.005, netSign = netZero ? '' : (net < 0 ? '+' : '−'), netCol = netZero ? LBL : gridCol;
    var pb = priceBand(price, p20, p80), priceCol = pb.col, word = pb.word;
    var hasPrice = price != null && price > 0;

    var h = '<div class="card card--accent energie"><div class="eyebrow">Energie<span class="status" style="color:' + gridCol + '">' + statusWord + ' ' + watts(grid) + '</span></div><div class="card-body">';
    // price head + spectrum bar — only when a real price exists (else the row would assert a false verdict)
    if (hasPrice) {
        h += '<div class="price-head"><span class="lbl">Strompreis</span><span class="val num" style="color:' + priceCol + '">' + comma(price, 2) + '<span class="u">€/kWh</span></span>'
            + '<span class="verdict" style="color:' + priceCol + '">' + word + '</span>'
            + '<span class="net" style="color:' + netCol + '">' + netSign + comma(Math.abs(net), 2) + '<span class="u">€/h</span></span></div>';
        if (p20 != null && p80 != null && p80 > p20) {
            var pf = clamp01(1 / 6 + (price - p20) / (p80 - p20) * (2 / 3)) * 100;
            h += '<div class="pricebar">' + spectrum(pf, comma(p20, 2), comma(p80, 2)) + '</div>';
        }
    }
    // four flow rows
    var maxV = Math.max(Math.abs(se || 0), Math.abs(maxxi || 0), Math.abs(grid || 0), Math.abs(haus || 0), 1);
    function frow(kind, name, val, col, approx) {
        var frac = Math.min(1, Math.abs(val || 0) / maxV) * 100;
        return '<div class="flow"><span class="fi">' + enIco(kind, col) + '</span><span class="fl">' + name + '</span>'
            + '<span class="track"><span class="fill" style="width:' + frac.toFixed(0) + '%;background:' + col + '"></span></span>'
            + '<span class="fv num" style="color:' + col + '">' + (approx ? '≈ ' : '') + watts(val) + '</span></div>';
    }
    h += '<div class="flows">'
        + frow('sun', 'SolarEdge', se, enRoleCol(se, true))
        + frow('battery', 'Maxxisun', maxxi, enRoleCol(maxxi, maxxi < 0, 500))
        + frow('grid', 'Netz', grid, gridCol)
        + frow('house', 'Haus', haus, stale ? LBL : enRoleCol(haus, false), stale)
        + '</div>';
    // ratios — distinct stat treatment
    h += '<div class="estats">'
        + '<div class="estat"><span class="v num" style="color:' + GREEN + '">' + Math.round((autark || 0) * 100) + '<span class="u">%</span></span><span class="l">autark' + (stale ? ' (≈)' : '') + '</span></div>'
        + '<div class="estat"><span class="v num" style="color:' + BLUE + '">' + Math.round((eigen || 0) * 100) + '<span class="u">%</span></span><span class="l">Eigenverbrauch</span></div>'
        + '</div>';
    return h + '</div></div>';
}

// ===== STEUERUNG — the 6 agreed tiles + symbols (mockup). Native i-vis-universal tap widgets
// overlay each tile (the card is a read-only HTML string, so taps come from native vis widgets
// positioned over each tile's measured box). data-k maps a tile to its overlay. Plug tiles
// (Drucker/Couch/Vitrine) show real on/off; TV/Ambiente keep the mockup's "Szene" label; Tür
// ("öffnen") is the guarded front-door opener. STEUER_OIDS drives the reactive tiles' subscriptions. =====
var STEUER_OIDS = ['hm-rpc.1.0001DD89A46CE1.3.STATE', 'hm-rpc.1.0001DD89A46CAD.3.STATE', 'hm-rpc.1.0001DD89AADDE7.3.STATE', 'hue.0.TV-Bereich.on'];
function tile(key, kind, cap, state, icon) {
    return '<div class="tile ' + kind + '" data-k="' + key + '"><span class="ic">' + icon + '</span><span class="cap">' + cap + '</span><span class="st">' + state + '</span></div>';
}
function buildSteuerung() {
    // plug/light states drive the icon colour (amber = on, grey = off) — same symbols, state-coloured
    var dr = sBool('hm-rpc.1.0001DD89A46CE1.3.STATE');   // Drucker plug
    var co = sBool('hm-rpc.1.0001DD89A46CAD.3.STATE');   // Couchlampe plug
    var vi = sBool('hm-rpc.1.0001DD89AADDE7.3.STATE');   // Vitrine plug
    var am = sBool('hue.0.TV-Bereich.on');               // Ambiente light (not a scene)
    var ta = sBool('javascript.0.tuer_arm');             // Tür confirm armed? (drives the red "bestätigen" look)
    var ON = '#F1BE3D', OFF = '#8A8A8A', ALERT = '#d8536f';
    var icTV = '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2" fill="none" stroke="#5080AC" stroke-width="1.6"/><line x1="8" y1="20" x2="16" y2="20" stroke="#5080AC" stroke-width="1.6" stroke-linecap="round"/></svg>';
    var icAmb = '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + (am ? ON : OFF) + '" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M12 3 v2 M12 19 v2 M3 12 h2 M19 12 h2 M5.6 5.6 l1.4 1.4 M17 17 l1.4 1.4 M18.4 5.6 l-1.4 1.4 M7 17 l-1.4 1.4"/><circle cx="12" cy="12" r="3.4" fill="' + (am ? ON : OFF) + '" stroke="none"/></g></svg>';
    var icDruck = '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + (dr ? ON : OFF) + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="6" rx="1"/><path d="M4 9 h16 v7 h-4 v5 H8 v-5 H4 Z"/><line x1="8" y1="13" x2="16" y2="13"/></g></svg>';
    var icCouch = '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + (co ? ON : OFF) + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13 v-2 a3 3 0 0 1 3 -3 h8 a3 3 0 0 1 3 3 v2"/><rect x="3" y="13" width="18" height="5" rx="1.5"/><line x1="6" y1="18" x2="6" y2="20"/><line x1="18" y1="18" x2="18" y2="20"/></g></svg>';
    var icVit = '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + (vi ? ON : OFF) + '" stroke-width="1.6" fill="none"><rect x="6" y="3" width="12" height="18" rx="1.5"/><line x1="6" y1="9" x2="18" y2="9"/><line x1="6" y1="15" x2="18" y2="15"/></g></svg>';
    var tc = ta ? ALERT : OFF;  // door icon grey → red when armed (mirrors the other tiles' grey→amber)
    var icTuer = '<svg width="24" height="24" viewBox="0 0 24 24"><g stroke="' + tc + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21 V4 a1 1 0 0 1 1 -1 h8 a1 1 0 0 1 1 1 v17"/><path d="M4 21 h14"/><circle cx="13" cy="12" r="1" fill="' + tc + '" stroke="none"/></g></svg>';
    var h = '<div class="card steuerung"><div class="eyebrow">Steuerung<span class="status" style="color:' + MUTE + '">Mehr …</span></div><div class="card-body"><div class="controls">';
    h += tile('tv', 'scene', 'TV', 'Szene', icTV);
    h += tile('ambiente', am ? 'on' : '', 'Ambiente', am ? 'an' : 'aus', icAmb);
    h += tile('drucker', dr ? 'on' : '', 'Drucker', dr ? 'an' : 'aus', icDruck);
    h += tile('couch', co ? 'on' : '', 'Couch', co ? 'an' : 'aus', icCouch);
    h += tile('vitrine', vi ? 'on' : '', 'Vitrine', vi ? 'an' : 'aus', icVit);
    h += tile('tuer', ta ? 'arm' : '', 'Tür', ta ? 'öffnen bestätigen' : 'öffnen', icTuer);
    return h + '</div></div></div>';
}

// ===== HAUS status ribbon (separate widget in the bottom strip, right of the nav) =====
// Read-only door/window contacts (value.window {0:CLOSED,1:OPEN}) + the HmIP-DLD lock
// (LOCK_STATE {0:UNKNOWN,1:LOCKED,2:UNLOCKED}). Green = secure, red = open/unlocked (alarm).
var RIBBON_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&display=swap');
.mv2r{--bg:#0d0e12;--surface:#15161c;--border:#262a33;--text:#CCCCCC;--muted:#8A8A8A;--green:#b5fb5b;--red-ind:#d8536f;
  width:766px;height:87px;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:16px;
  padding:12px 16px;display:flex;align-items:center;font-family:'Archivo',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased}
.mv2r *{margin:0;padding:0;box-sizing:border-box}
.mv2r .inds{flex:1;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.mv2r .rind{background:var(--bg);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:8px}
.mv2r .dot{width:9px;height:9px;border-radius:50%;flex:none}
.mv2r .tx{display:flex;flex-direction:column;line-height:1.15;min-width:0}
.mv2r .nm{font-size:14px;font-weight:600;white-space:nowrap}
.mv2r .stt{font-size:12px;color:var(--muted)}
`;
function indDot(name, col, word, wordCol) {
    return '<div class="rind"><span class="dot" style="background:' + col + '"></span><span class="tx"><span class="nm">' + esc(name)
        + '</span><span class="stt"' + (wordCol ? ' style="color:' + wordCol + '"' : '') + '>' + word + '</span></span></div>';
}
function contactInd(name, oid) {
    var v = sNum(oid);
    if (v == null) return indDot(name, 'var(--muted)', 'unbekannt');
    return v === 1 ? indDot(name, 'var(--red-ind)', 'offen', 'var(--red-ind)') : indDot(name, 'var(--green)', 'geschlossen');
}
function buildRibbon() {
    var inds = ''
        + contactInd('Terrasse', 'hm-rpc.1.0007DD8996AFD3.1.STATE')
        + contactInd('Schuppen', 'hm-rpc.1.00155D89A38D55.1.STATE')
        + contactInd('Haustür', 'hm-rpc.1.0023DD89A5152D.1.STATE');
    var lock = sNum('hm-rpc.1.002A226996B89C.1.LOCK_STATE');  // 0 UNKNOWN, 1 LOCKED, 2 UNLOCKED
    inds += (lock === 1) ? indDot('Türschloss', 'var(--green)', 'verriegelt')
        : (lock === 2) ? indDot('Türschloss', 'var(--red-ind)', 'entriegelt', 'var(--red-ind)')
        : indDot('Türschloss', 'var(--muted)', 'unbekannt');
    inds += contactInd('Bad', 'hm-rpc.1.0007DD89B41FD4.1.STATE');
    var inner = '<div class="mv2r"><style>' + RIBBON_CSS + '</style><div class="inds">' + inds + '</div></div>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 766 87" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'
        + '<foreignObject x="0" y="0" width="766" height="87"><div xmlns="http://www.w3.org/1999/xhtml">' + inner + '</div></foreignObject></svg>';
}
var RIBBON_OIDS = ['hm-rpc.1.0007DD8996AFD3.1.STATE', 'hm-rpc.1.00155D89A38D55.1.STATE', 'hm-rpc.1.0023DD89A5152D.1.STATE', 'hm-rpc.1.0007DD89B41FD4.1.STATE', 'hm-rpc.1.002A226996B89C.1.LOCK_STATE'];

// ===== assemble =====
function renderMainV2() {
    var inner = '<div class="mv2"><style>' + CSS + '</style>'
        + buildHero()
        + '<div class="zones">'
        + '<div class="col">' + buildKlima() + '</div>'
        + '<div class="col mid">' + buildWoche() + buildTanken() + '</div>'
        + '<div class="col right">' + buildEnergie() + buildSteuerung() + '</div>'
        + '</div></div>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1170 676" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'
        + '<foreignObject x="0" y="0" width="1170" height="676">'
        + '<div xmlns="http://www.w3.org/1999/xhtml">' + inner + '</div>'
        + '</foreignObject></svg>';
}

function publish() { setState('main_v2_card', renderMainV2()); }
function publishRibbon() { setState('main_v2_ribbon', buildRibbon()); }

createState('main_v2_card', '', { desc: 'Main-Redesign Prototyp (HTML)', type: 'string', role: 'html' }, function () { publish(); });
createState('main_v2_ribbon', '', { desc: 'Neu HAUS-Statusleiste (HTML)', type: 'string', role: 'html' }, function () { publishRibbon(); });

// ===== subscriptions =====
ROOMS.forEach(function (r) {
    ['.Temperature.Temperature', '.Humidity.Humidity', '.CO2.CO2', '.LastUpdate', '.BatteryStatus'].forEach(function (s) {
        on({ id: r[1] + s, change: 'ne' }, publish);
    });
});
[OUTDOOR + '.Temperature.Temperature', OUTDOOR + '.Humidity.Humidity', FCMIN, FCMAX,
 NB + '.Pressure.Pressure', NB + '.Pressure.PressureTrend',
 EN + 'sunrise', EN + 'sunset', EN + 'moonrise', EN + 'moonset', EN + 'moon_phase',
 'tankerkoenig.0.stations.1.diesel.feed', 'tankerkoenig.0.stations.1.e5.feed', 'ical.0.data.table'].forEach(function (id) {
    on({ id: id, change: 'ne' }, publish);
});
['power_production', 'power_maxxisun', 'power_feedin', 'power_purchased', 'power_consumption', 'rate_autarky', 'rate_selfconsumption', 'power_data_stale'].forEach(function (s) {
    on({ id: EN + s, change: 'ne' }, publish);
});
[EN + 'tibber_states.energy_price_euro', EN + 'tibber_states.energy_price_euro_p20', EN + 'tibber_states.energy_price_euro_p80'].forEach(function (id) {
    on({ id: id, change: 'ne' }, publish);
});
['diesel', 'e5'].forEach(function (f) {
    ['_p20', '_p80', '_min', '_max'].forEach(function (q) {
        on({ id: 'javascript.0.tankerkoenig_quantiles.' + f + q, change: 'ne' }, publish);
    });
});
// Steuerung plug tiles (Drucker/Couch/Vitrine) react to their real on/off state
STEUER_OIDS.forEach(function (id) { on({ id: id, change: 'ne' }, publish); });
// weather symbol updates with the forecast
on({ id: 'daswetter.0.NextDays.Location_1.Day_1.Wetter_Symbol_id', change: 'ne' }, publish);
// Tür tile flips to the red "öffnen bestätigen" look while the guard is armed
on({ id: 'javascript.0.tuer_arm', change: 'ne' }, publish);
RIBBON_OIDS.forEach(function (id) { on({ id: id, change: 'ne' }, publishRibbon); });
schedule('*/20 * * * * *', function () { publish(); publishRibbon(); });
