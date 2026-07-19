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
// COLUMN-SPLIT: this one CSS_BASE (tokens + per-widget roots + shared component styles) is prepended
// to EVERY widget's foreignObject (each is an independent <style> scope). The four .mv2.{hw,lw,mw,rw}
// root rules size each widget to its own vis box; everything below is shared verbatim.
var CSS_BASE = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');
.mv2{
  --bg:#0d0e12; --surface:#15161c; --inset:#1c1f28; --border:#262a33;
  --text:#CCCCCC; --muted:#8A8A8A; --mute:#7F8A99;
  --green:#b5fb5b; --amber:#F1BE3D; --blue:#5080AC; --red:#A00629;
  --green-16:rgba(181,251,91,.16); --amber-16:rgba(241,190,61,.16); --blue-16:rgba(80,128,172,.16); --red-16:rgba(160,6,41,.22); --muted-16:rgba(138,138,138,.16);
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px;
  --r2:14px; --r3:10px;
  --t-hero:98px; --t-clock:126px; --t-metric:27px; --t-sub:18px; --t-date:23px; --t-label:14px; --t-cap:12px;
  --sym-wx:108px; --sym-moon:88px;     /* hero display symbols */
  --inset-x:22px;                       /* shared left/right page inset */
  box-sizing:border-box; background:var(--bg);
  font-family:'Figtree',system-ui,sans-serif; color:var(--text);
  -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums;
}
/* per-widget roots — each its own SVG/foreignObject sized to its vis box (mid+right run taller than
   the left/nav, extending down past the nav level for ~50px more calendar/Energie height). */
/* Consistent grid: 4 px outer margin, 12 px gutter everywhere. LEFT matches the nav width exactly
   (4..396) so the Klima column and the nav share both edges; MID/RIGHT (377 each) + ribbon sit across
   the continuous 12 px gutter at x≈396..408. All panels end at the same right edge as the hero. */
.mv2.hw{width:1170px; height:178px; display:grid; grid-template-rows:1fr}
.mv2.lw{width:392px;  height:487px; display:grid; grid-template-rows:1fr}
.mv2.mw{width:377px;  height:534px; display:grid; grid-template-rows:5.5fr 1fr; gap:var(--s3)}
.mv2.rw{width:377px;  height:534px; display:grid; grid-template-rows:1.3fr 1fr; gap:var(--s3)}
.mv2 *{margin:0; padding:0; box-sizing:border-box}
.mv2 .num{font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1}
.mv2 .u{font-size:max(12px,.42em); color:var(--muted); font-weight:500; letter-spacing:0; margin-left:.06em}

/* HERO — two tiers: display glyphs (top) + one metadata baseline (bottom). Each cluster is a
   full-height column (glyph top / metadata bottom), so all the small data lands on one baseline. */
.mv2 .hero{display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:var(--s3) var(--inset-x); overflow:hidden}
.mv2 .h-clim{justify-self:start; display:flex; align-items:center; gap:var(--s6)}
.mv2 .h-clock{justify-self:center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px}
.mv2 .h-moon{justify-self:end; display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:var(--s2)}

/* the Metric component — value + top-aligned unit (uu) + optional bottom-aligned label (ll) */
.mv2 .metric{display:inline-flex; align-items:stretch; gap:3px; white-space:nowrap}
.mv2 .metric .mval{font-weight:600; line-height:.82}
.mv2 .metric .mu{display:flex; flex-direction:column; justify-content:space-between; padding:.1em 0 .02em; color:var(--muted); font-weight:500; line-height:1; font-size:13px}

/* left: temp column + weather column, each glyph-top / metadata-baseline-bottom.
   align-items:stretch + .mm space-between makes min/max span the temp's width → left+right aligned. */
.mv2 .h-tempcol{display:flex; flex-direction:column; align-items:stretch; justify-content:center; gap:var(--s1)}
.mv2 .otemp{align-self:flex-start}
.mv2 .otemp .mval{font-size:var(--t-hero); letter-spacing:-.03em}
.mv2 .otemp .mu{font-size:26px; padding-top:.16em}
.mv2 .mm{display:flex; justify-content:space-between; align-items:flex-end}
.mv2 .mm .metric .mval{font-size:50px}
.mv2 .mm .metric .mu{font-size:15px}
.mv2 .h-wxcol{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--s1)}
.mv2 .h-wx{display:flex; align-items:center; justify-content:center; min-height:var(--sym-wx)}
.mv2 .h-wx img{height:var(--sym-wx); width:auto; display:block}
.mv2 .h-metrics{display:flex; flex-direction:row; align-items:center; gap:var(--s4)}
.mv2 .h-metrics .line{display:flex; align-items:center; gap:var(--s2); font-size:var(--t-label); color:var(--muted)}
.mv2 .h-metrics .line b{color:var(--text); font-weight:600; font-size:var(--t-sub)}

/* centre: clock (top) + date (baseline) */
.mv2 .m2clk{font-size:var(--t-clock); font-weight:600; line-height:.82; letter-spacing:-.02em}
.mv2 .m2clk .sep{opacity:.35}
.mv2 .m2date{font-size:var(--t-date); color:var(--muted); font-weight:500}

/* right: moon glyph (top) + sun/moon rise(↑)/set(↓) (baseline) */
.mv2 .moon{font-size:var(--sym-moon); line-height:.82; display:block}
.mv2 .alm-col{display:flex; flex-direction:column; gap:var(--s1)}
.mv2 .alm{display:flex; align-items:center; gap:var(--s3)}
.mv2 .alm .body{display:flex; align-items:center; justify-content:center; width:20px; flex:none}
.mv2 .alm .rs{display:flex; align-items:center; gap:4px}
.mv2 .alm .rs svg{flex:none}
.mv2 .alm .v{font-size:var(--t-sub); font-weight:600}

/* ZONES — column layout now lives in the .mv2.{lw,mw,rw} widget roots above (one card per grid row). */
.mv2 .card{background:var(--surface); border:1px solid var(--border); border-radius:var(--r2); padding:var(--s3) var(--s4); display:flex; flex-direction:column; gap:var(--s2); min-height:0; overflow:hidden}
.mv2 .card-body{flex:1; min-height:0; display:flex; flex-direction:column; gap:var(--s2)}

/* KLIMA — 2×3 tile grid (6 rooms); compact vertical tile, temp stays the biggest thing.
   Tile: header (thermo disc + name) → temperature → operational (age · battery) → hum · CO₂ */
.mv2 .klima .rooms{flex:1; display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(3,1fr); gap:var(--s2)}
.mv2 .ktile{background:var(--bg); border-radius:var(--r3); padding:10px 12px; display:flex; flex-direction:column; justify-content:space-between; min-width:0; overflow:hidden}
.mv2 .ktile .kh{display:flex; align-items:center; gap:8px; min-width:0}
.mv2 .ktile .th2{width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex:none}
.mv2 .ktile .th2 svg{width:16px; height:16px}
.mv2 .ktile .nm{font-size:15px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0}
.mv2 .ktile .tv{font-size:37px; font-weight:600; line-height:1; margin:3px 0 2px}
.mv2 .ktile .tv .u{font-size:15px}
.mv2 .ktile .op2{font-size:11px; color:var(--muted); white-space:nowrap}
.mv2 .ktile .env2{display:flex; align-items:center; gap:4px; font-size:13px; white-space:nowrap; margin-top:1px}
.mv2 .ktile .env2 .un{color:var(--muted); font-weight:500}

/* WOCHE */
.mv2 .woche .days{flex:1; display:flex; flex-direction:column; min-height:0}
.mv2 .drow{display:grid; grid-template-columns:58px 1fr; gap:var(--s3); align-items:start; border-top:1px solid var(--border); padding:var(--s2) 2px}
.mv2 .drow:first-child{border-top:none}
.mv2 .drow.today,.mv2 .drow.we{margin:0 calc(-1 * var(--s2)); padding-left:calc(var(--s2) + 2px); padding-right:calc(var(--s2) + 2px); border-radius:var(--r3); border-top-color:transparent}
.mv2 .drow.today{background:rgba(241,190,61,.09)}
.mv2 .drow.we{background:rgba(80,128,172,.12)}
.mv2 .drow.today .dow,.mv2 .drow.today .dnum{color:var(--amber)}
.mv2 .drow.we .dow,.mv2 .drow.we .dnum{color:var(--blue)}
.mv2 .drow .dcell{display:flex; flex-direction:row; align-items:baseline; gap:5px; line-height:1.22}
.mv2 .drow .dow{font-size:17px; font-weight:600}
.mv2 .drow .dnum{font-size:13px; color:var(--muted)}
.mv2 .drow .ev{display:flex; flex-direction:column; gap:3px; min-width:0}
.mv2 .drow .e{font-size:17px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.22}
.mv2 .drow .e .t{color:var(--muted); font-weight:600; margin-right:var(--s2)}
.mv2 .drow .none{font-size:17px; color:var(--mute)}

/* shared SPECTRUM bar (price position: Tanken + Strompreis) */
.mv2 .spectrum{display:flex; flex-direction:column; gap:var(--s1)}
.mv2 .spectrum .bar{height:5px; border-radius:3px; position:relative; background:linear-gradient(90deg,var(--green),var(--amber),var(--red)); opacity:.82}
.mv2 .spectrum .knob{position:absolute; top:50%; width:10px; height:10px; border-radius:50%; background:var(--text); border:2px solid var(--surface); transform:translate(-50%,-50%)}
.mv2 .spectrum .mmrow{display:flex; justify-content:space-between; font-size:var(--t-cap)}
.mv2 .spectrum .mmrow .lo{color:var(--green)} .mv2 .spectrum .mmrow .hi{color:var(--red)}

/* TANKEN — Diesel & E5 side by side (split by a vertical divider); per fuel: name + price on one row,
   shared spectrum bar below (same component as Strompreis). */
.mv2 .tanken{padding-top:var(--s2); padding-bottom:var(--s4)}
.mv2 .tanken .fuels{flex:1; display:grid; grid-template-columns:1fr 1fr; gap:var(--s3); align-items:stretch}
.mv2 .fuel{display:flex; flex-direction:column; gap:var(--s2)}
.mv2 .fuel + .fuel{border-left:1px solid var(--border); padding-left:var(--s3)}
.mv2 .fuel .finfo{display:flex; align-items:baseline; justify-content:space-between; gap:var(--s2); min-width:0}
.mv2 .fuel .fname{font-size:18px; font-weight:600; white-space:nowrap}
.mv2 .fuel .price{display:flex; align-items:flex-start; line-height:1; white-space:nowrap}
.mv2 .fuel .pnum{font-size:40px; font-weight:600; line-height:.85}
.mv2 .fuel .psup{display:flex; flex-direction:column; align-items:flex-start; margin-left:2px}
.mv2 .fuel .p3{font-size:18px; font-weight:600; line-height:1}
.mv2 .fuel .punit{font-size:12px; color:var(--muted); font-weight:500; margin-top:2px}

/* ENERGIE */
.mv2 .energie .price-head{display:flex; align-items:baseline; gap:var(--s2); font-size:var(--t-cap)}
.mv2 .energie .price-head .lbl{color:var(--muted)}
.mv2 .energie .price-head .val{font-size:var(--t-sub); font-weight:600}
.mv2 .energie .price-head .net{margin-left:auto; font-weight:600; font-size:var(--t-label)}
.mv2 .energie .flows{flex:1; display:grid; grid-template-rows:repeat(4,1fr)}
.mv2 .flow{display:grid; grid-template-columns:24px 84px 1fr 70px; align-items:center; gap:var(--s2)}
.mv2 .flow .fi{display:flex; align-items:center; justify-content:center}
.mv2 .flow .fl{font-size:var(--t-label); color:var(--muted)}
.mv2 .flow .track{height:6px; border-radius:3px; background:var(--inset); overflow:hidden}
.mv2 .flow .fill{display:block; height:6px; border-radius:3px; min-width:2px}
.mv2 .flow .fv{text-align:right; font-size:var(--t-sub); font-weight:600; white-space:nowrap}
.mv2 .estats{display:flex; gap:var(--s4); border-top:1px solid var(--border); padding-top:var(--s2); align-items:baseline}
.mv2 .estat{flex:1; display:flex; align-items:baseline; gap:var(--s2)}
.mv2 .estat .v{font-size:var(--t-metric); font-weight:600; line-height:1}
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

// ===== colour tokens — data-driven colour = hex from the shared canonical VC_PAL (vis_card.js).
// Per DESIGN_SYSTEM.md's two-layer rule these are hex (not CSS vars): one source, board-wide,
// works in vis bindings + any wall browser. The static-chrome CSS --green/… tokens (defined in
// CSS_BASE above) are the separate layer, set from the same values. PAL maps sem→colour. =====
var GREEN = VC_PAL.good, AMBER = VC_PAL.warn, BLUE = VC_PAL.cold, RED = VC_PAL.alarm,
    LBL = VC_PAL.muted;
var PAL = VC_PAL;

// ===== data helpers — pure formatters + Berlin time now come from the shared global vis_card.js;
// only stateful reads and markup/CSS-coupled helpers stay local. =====
function sNum(id) { var s = getState(id); return (s && typeof s.val === 'number') ? s.val : null; }
function sStr(id) { var s = getState(id); return (s && s.val != null) ? String(s.val) : null; }
function sBool(id) { var s = getState(id); return !!(s && s.val); }
var comma = vcComma;
function pad2(n) { return ('0' + n).slice(-2); }
function hhmmBerlin(dt) { return dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }); }
var berlinNow = vcBerlinNow;
function dayKey(dt) { return vcDayKey(dt); }
function ageMs(luVal) { if (!luVal) return null; var t = new Date(luVal).getTime(); return isNaN(t) ? null : (Date.now() - t); }
function agoStr(luVal) {
    var ms = ageMs(luVal); if (ms == null) return null;
    var s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? s + ' s' : (s < 3600 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h');
}
function comfortCol(t) { return t == null ? LBL : (t <= 3 ? LBL : (t < 12 ? BLUE : (t < 20 ? GREEN : (t < 27 ? AMBER : RED)))); }
function comfortTint(t) { return t == null ? 'var(--muted-16)' : (t <= 3 ? 'var(--muted-16)' : (t < 12 ? 'var(--blue-16)' : (t < 20 ? 'var(--green-16)' : (t < 27 ? 'var(--amber-16)' : 'var(--red-16)')))); }
function co2Col(c) { return c == null ? LBL : (c < 1000 ? GREEN : (c < 1400 ? AMBER : RED)); }
function humCol(h) { return h == null ? LBL : (h < 40 ? AMBER : (h <= 60 ? GREEN : BLUE)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function clip(s, n) { s = String(s == null ? '' : s); return esc(s.length > n ? s.slice(0, n - 1) + '…' : s); }
// calendar event symbols — verbatim from the old ical_events.js (gift/ring/worker + kids' hearts).
// First decode HTML entities the ical feed pre-encodes (e.g. "Ina &amp; Dirk"), so the later esc()
// in clip() re-encodes once instead of showing a literal "&amp;".
function calSym(s) {
    return String(s == null ? '' : s)
        .split('&amp;').join('&').split('&lt;').join('<').split('&gt;').join('>')
        .split('&#039;').join("'").split('&#39;').join("'").split('&quot;').join('"')
        .split('[Geburtstag]').join('🎁').split('[Hochzeitstag]').join('💍')
        .split('[Müllabfuhr]').join('👷').split('Abholung').join('👷')
        .split('[Carlotta]').join('🩵').split('[Clara]').join('💜').split('[Clea]').join('🧡');
}
var clamp01 = vcClamp01;
function watts(v) { var a = Math.abs(v || 0); return a >= 1000 ? comma(a / 1000, 1) + '<span class="u">kW</span>' : Math.round(a) + '<span class="u">W</span>'; }

// fuel price 1,65 with the raised 3rd decimal (⁹) and the €/l unit stacked beneath it, left-aligned —
// keeps the price compact so the bar gets a clear margin to the card boundary.
function priceSuper(v) {
    if (v == null) return '<span class="pnum num">–</span>';
    var s = v.toFixed(3);
    return '<span class="pnum num">' + s.slice(0, 4).replace('.', ',') + '</span>'
        + '<span class="psup"><span class="p3 num">' + s.slice(4) + '</span><span class="punit">€/l</span></span>';
}

// ===== state IDs =====
var NB = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';
// second base station (NAMain "Studio", mains-powered — no BatteryStatus state)
var NB2 = 'netatmo.0.6a48fde5178fa8d8cd09bd27.70-ee-50-c2-86-aa';
var OUTDOOR = NB + '.02-00-00-32-ae-a4';
var FCMIN = 'daswetter.0.NextDays.Location_1.Day_1.Minimale_Temperatur_value';
var FCMAX = 'daswetter.0.NextDays.Location_1.Day_1.Maximale_Temperatur_value';
// Klima: Außen lives in the hero now; 6 rooms fill the 2×3 tile grid.
// Kids' rooms use short labels — the half-width tile can't fit "Carlottas Zimmer".
// Dachterrasse is the outdoor module on the Studio base station (no CO₂ — env line shows –).
var ROOMS = [
    ['Wohnzimmer', NB],
    ['Carlotta', NB + '.03-00-00-0e-16-36'],
    ['Clara', NB + '.03-00-00-0f-01-6e'],
    ['Clea', NB + '.03-00-00-10-e5-42'],
    ['Studio', NB2],
    ['Dachterrasse', NB2 + '.02-00-00-c2-7e-7c']
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
function icoGauge(sz) { sz = sz || 16; return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24"><g fill="none" stroke="' + LBL + '" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><line x1="12" y1="7.5" x2="12" y2="9.2"/><line x1="16.5" y1="12" x2="14.8" y2="12"/><line x1="7.5" y1="12" x2="9.2" y2="12"/><line x1="12" y1="12" x2="15.4" y2="9.2"/></g><circle cx="12" cy="12" r="1.6" fill="' + LBL + '"/></svg>'; }
function icoSunSmall() { return '<svg width="18" height="18" viewBox="0 0 22 22"><g stroke="#F1BE3D" stroke-width="1.5" fill="none" stroke-linecap="round"><circle cx="11" cy="11" r="3.4" fill="#F1BE3D" stroke="none"/><line x1="11" y1="2.5" x2="11" y2="4.6"/><line x1="11" y1="17.4" x2="11" y2="19.5"/><line x1="2.5" y1="11" x2="4.6" y2="11"/><line x1="17.4" y1="11" x2="19.5" y2="11"/><line x1="5" y1="5" x2="6.5" y2="6.5"/><line x1="15.5" y1="15.5" x2="17" y2="17"/><line x1="17" y1="5" x2="15.5" y2="6.5"/><line x1="6.5" y1="15.5" x2="5" y2="17"/></g></svg>'; }
// small crescent for the moon rise/set row (the big phase emoji is the hero symbol)
function icoMoonMini(col) { return '<svg width="15" height="15" viewBox="0 0 16 16"><path d="M12.2 2.6 A6.6 6.6 0 1 0 12.8 13.4 A5.2 5.2 0 0 1 12.2 2.6 Z" fill="' + col + '"/></svg>'; }
// rise (auf) = arrow up over the horizon · set (unter) = arrow down to the horizon — replaces the "auf/unter" words
function icoRise(col) { return '<svg width="15" height="15" viewBox="0 0 16 16"><g stroke="' + col + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 13.5 H13.5"/><path d="M8 10.5 V3.5"/><path d="M5 6.5 L8 3.5 L11 6.5"/></g></svg>'; }
function icoSet(col) { return '<svg width="15" height="15" viewBox="0 0 16 16"><g stroke="' + col + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 13.5 H13.5"/><path d="M8 3 V10"/><path d="M5 7 L8 10 L11 7"/></g></svg>'; }
// moon = the original dashboard's phase emoji (driven by moon_phase 0..7); New=0, Full=4 (N. hemisphere).
// Sized to match the weather symbol (see .moon CSS). Owner-agreed symbol set — not a drawn glyph.
function moonEmoji(phase) {
    if (phase == null || isNaN(phase)) phase = 6;
    phase = ((Math.round(phase) % 8) + 8) % 8;
    return ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][phase];
}
// Weather symbol = the native daswetter art (galeria1, ids 1..22), embedded inline as a same-origin
// <img> beside the big temp (the foreignObject HTML rebuild makes the old native-overlay widget
// unnecessary; this auto-aligns + scales + survives the Neu→Main move). Falls back to nothing if the id is out of range.
function wxImg(id) {
    if (id == null || isNaN(id) || id < 1 || id > 22) return '<div class="h-wx"></div>';  // keep the slot so the column doesn't collapse
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
// price-position classifier shared by Tanken + Strompreis — logic now in vis_card (vcPriceSem);
// this wrapper binds our palette. Missing data → muted "–" (no false verdict).
function priceBand(price, p20, p80) {
    var s = vcPriceSem(price, p20, p80);
    return { band: s.band, col: vcSemColor(PAL, s.sem), word: s.word };
}
function spectrum(knobPct, loStr, hiStr) {
    return '<div class="spectrum"><div class="bar"><div class="knob" style="left:' + knobPct.toFixed(0) + '%"></div></div>'
        + '<div class="mmrow"><span class="lo num">' + loStr + '</span><span class="hi num">' + hiStr + '</span></div></div>';
}

// ===== HERO =====
// the Metric component: value (comfort-coloured) + °C top-aligned + optional bottom-aligned label.
// cls='otemp' selects the hero-temp size; min/max metrics live inside .mm.
function tempMetric(val, dec, label, cls) {
    return '<span class="metric ' + (cls || '') + '"><span class="mval num" style="color:' + comfortCol(val) + '">' + comma(val, dec)
        + '</span><span class="mu"><span class="uu">°C</span>' + (label ? '<span class="ll">' + label + '</span>' : '') + '</span></span>';
}
function buildHero() {
    var b = berlinNow();
    var sr = sStr(EN + 'sunrise'), ss = sStr(EN + 'sunset');
    var mr = sStr(EN + 'moonrise'), ms = sStr(EN + 'moonset'), mph = sNum(EN + 'moon_phase');
    var ot = sNum(OUTDOOR + '.Temperature.Temperature'), mn = sNum(FCMIN), mx = sNum(FCMAX);
    var oh = sNum(OUTDOOR + '.Humidity.Humidity');
    var pr = sNum(NB + '.Pressure.Pressure');
    var wsym = sNum('daswetter.0.NextDays.Location_1.Day_1.Wetter_Symbol_id');
    var RS = '#8A8A8A';

    var h = '<div class="hero">';
    // LEFT: temp column (temp top / min-max baseline) + weather column (symbol top / hum-pres baseline)
    h += '<div class="h-clim">'
        + '<div class="h-tempcol">'
        +   tempMetric(ot, 1, null, 'otemp')
        +   '<div class="mm">' + tempMetric(mn, 0, 'min') + tempMetric(mx, 0, 'max') + '</div>'
        + '</div>'
        + '<div class="h-wxcol">' + wxImg(wsym)
        +   '<div class="h-metrics">'
        +     '<div class="line">' + icoDrop('#5080AC', 18) + '<b class="num">' + (oh != null ? Math.round(oh) : '–') + '</b><span class="u">%</span></div>'
        +     '<div class="line">' + icoGauge(18) + '<b class="num">' + (pr != null ? Math.round(pr) : '–') + '</b><span class="u">mbar</span></div>'
        +   '</div></div>'
        + '</div>';
    // CENTRE: clock (top) + date (baseline)
    h += '<div class="h-clock"><div class="m2clk num">' + pad2(b.getHours()) + '<span class="sep">:</span>' + pad2(b.getMinutes()) + '</div>'
        + '<div class="m2date">' + DAYS_FULL[b.getDay()] + ', ' + b.getDate() + '. ' + MONTHS[b.getMonth()] + '</div></div>';
    // RIGHT: moon glyph (top) + sun/moon rise(↑)/set(↓) on the baseline (icon = which body, arrow = auf/unter)
    h += '<div class="h-moon"><span class="moon">' + moonEmoji(mph) + '</span><div class="alm-col">'
        + '<div class="alm"><span class="body">' + icoSunSmall() + '</span>'
        +   '<span class="rs">' + icoRise(RS) + '<span class="v num">' + esc(sr || '–') + '</span></span>'
        +   '<span class="rs">' + icoSet(RS) + '<span class="v num">' + esc(ss || '–') + '</span></span></div>'
        + '<div class="alm"><span class="body">' + icoMoonMini('#9aa3b2') + '</span>'
        +   '<span class="rs">' + icoRise(RS) + '<span class="v num">' + esc(mr || '–') + '</span></span>'
        +   '<span class="rs">' + icoSet(RS) + '<span class="v num">' + esc(ms || '–') + '</span></span></div>'
        + '</div></div>';
    return h + '</div>';
}

// ===== KLIMA =====
function buildRoom(name, module) {
    var t = sNum(module + '.Temperature.Temperature'), hh = sNum(module + '.Humidity.Humidity'),
        c = sNum(module + '.CO2.CO2');
    // base stations (Wohnzimmer, Studio) are mains-powered and have no BatteryStatus state —
    // an unguarded getState would warn-spam the log on every publish
    var bs = existsState(module + '.BatteryStatus') ? sNum(module + '.BatteryStatus') : null;
    var lu = getState(module + '.LastUpdate'), luv = lu && lu.val ? lu.val : null, ago = agoStr(luv);
    var luMs = ageMs(luv), stale = luMs != null && luMs > 3600000;  // >60 min = stale sensor (alarm)
    // >6 h without an update (typically a dead battery): the readings are history, not truth —
    // grey the whole tile instead of presenting stale values in fresh comfort colours.
    var dead = luMs == null || luMs > 21600000;
    var cc = dead ? LBL : comfortCol(t);
    var h = '<div class="ktile">';
    h += '<div class="kh"><span class="th2" style="background:' + (dead ? 'rgba(138,138,138,.14)' : comfortTint(t)) + '">' + icoThermo(cc) + '</span><span class="nm">' + esc(name) + '</span></div>';
    h += '<div class="tv num" style="color:' + cc + '">' + comma(t, 1) + '<span class="u">°C</span></div>';
    // operational: last-update (red when stale) · battery % (base stations have none)
    h += '<div class="op2"' + (stale ? ' style="color:' + RED + '"' : '') + '>vor ' + (ago || '–')
        + (bs != null ? ' · ' + Math.round(bs) + '%' : '') + '</div>';
    // environmental: humidity · CO2 on one line
    h += '<div class="env2">' + icoDrop('#5080AC', 13) + '<span style="color:' + (dead ? LBL : humCol(hh)) + '">' + (hh != null ? Math.round(hh) : '–') + '</span><span class="un">%</span>'
        + '<span class="un">·</span>' + (c != null
            ? '<span style="color:' + (dead ? LBL : co2Col(c)) + '">' + Math.round(c) + '</span><span class="un">ppm</span>'
            : '<span class="un">–</span>') + '</div>';
    return h + '</div>';
}
function buildKlima() {
    var h = '<div class="card klima"><div class="card-body"><div class="rooms">';
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
    // Px-budget fit guard (the card height isn't measurable server-side): estimate each day's height
    // and fill the LAST day partially, so the list fills the card without clipping and with no "+N"
    // clutter. PX_BUDGET ≈ the calendar card body; DAY_PAD = row padding, ROW_PX ≈ one event line.
    // The date sits inline with the weekday (one-line label), so a 0–1-event day is a single line:
    // MIN_DAY (empty/1-event cost) ≈ one line, which lets more days fit on a busy week (e.g. Sat survives).
    // COLUMN-SPLIT: PX_BUDGET is hand-synced to the mid widget's Woche row (mw 534 px, 5.5fr of
    // 5.5fr+1fr). Re-tune if the .mv2.mw height or that ratio changes (server-side height isn't measurable).
    var PX_BUDGET = 416, DAY_PAD = 16, ROW_PX = 24, MIN_DAY = 22, DAY_CAP = 4, used = 0, rows = '';
    for (var i = 0; i < 7; i++) {
        var dd = new Date(b.getFullYear(), b.getMonth(), b.getDate() + i);
        var dow = dd.getDay(), weekend = (dow === 0 || dow === 6), today = (i === 0);
        var evs = (byDay[dayKey(dd)] || []).sort(function (a, c) { return a.dt - c.dt; });
        // dedup repeated events (same time + title), as the old calendar did
        var seen = {}, ded = [];
        evs.forEach(function (ev) { var k = (ev.allDay ? 'gz' : hhmmBerlin(ev.dt)) + '|' + ev.title; if (!seen[k]) { seen[k] = 1; ded.push(ev); } });
        evs = ded;
        var avail = PX_BUDGET - used - DAY_PAD;
        if (i > 0 && avail < MIN_DAY) break;  // no room for a further day
        var cap = Math.min(DAY_CAP, Math.max(1, Math.floor(avail / ROW_PX)));  // events that still fit
        var shown = evs.slice(0, cap);
        used += DAY_PAD + Math.max(MIN_DAY, (shown.length || 1) * ROW_PX);
        var cls = today ? ' today' : (weekend ? ' we' : '');
        rows += '<div class="drow' + cls + '"><div class="dcell"><span class="dow">' + DAYS_SHORT[dow] + '</span><span class="dnum">' + dd.getDate() + '.</span></div><div class="ev">';
        if (!evs.length) { rows += '<div class="none">—</div>'; }
        else {
            shown.forEach(function (ev) {
                // allDay events drop the "ganztägig" label entirely (owner request) — title only.
                if (ev.allDay) { rows += '<div class="e">' + clip(calSym(ev.title), 30) + '</div>'; }
                else { rows += '<div class="e"><span class="t num">' + esc(hhmmBerlin(ev.dt)) + '</span>' + clip(calSym(ev.title), 26) + '</div>'; }
            });
        }
        rows += '</div></div>';
    }
    return '<div class="card woche"><div class="card-body"><div class="days">' + rows + '</div></div></div>';
}

// ===== TANKEN =====
function buildFuel(name, feedOid, base) {
    var price = sNum(feedOid), p20 = sNum(base + '_p20'), p80 = sNum(base + '_p80'),
        mn = sNum(base + '_min'), mx = sNum(base + '_max');
    var pb = priceBand(price, p20, p80), col = pb.col;
    // knob: low price = left/green, high = right/red. Labels show actual 14-day min/max.
    var pos = (mn != null && mx != null && mx > mn && price != null) ? clamp01((price - mn) / (mx - mn)) * 100 : 50;
    var h = '<div class="fuel">';
    h += '<div class="finfo"><span class="fname">' + name + '</span>'
        + '<div class="price" style="color:' + col + '">' + priceSuper(price) + '</div></div>';
    h += spectrum(pos, comma(mn, 2), comma(mx, 2));
    return h + '</div>';
}
function buildTanken() {
    return '<div class="card tanken"><div class="card-body"><div class="fuels">'
        + buildFuel('Diesel', 'tankerkoenig.0.stations.1.diesel.feed', 'javascript.0.tankerkoenig_quantiles.diesel')
        + buildFuel('E5', 'tankerkoenig.0.stations.1.e5.feed', 'javascript.0.tankerkoenig_quantiles.e5')
        + '</div></div></div>';
}

// ===== ENERGIE — verdict logic now lives in vis_card (single source; thresholds in VC.*).
// enRoleCol/energyFrame/frameStyle are thin wrappers binding our palette; the owner's €/h frame
// scale (income>0,05 → green; |net|≤0,05 → grey; cost → red when price≥p80 else amber) is
// vcEnergyFrameSem. buildEnergie computes the sem once (see below). =====
function enRoleCol(val, favourable, high) { return vcSemColor(PAL, vcRoleSem(val, favourable, high)); }
function buildEnergie() {
    var prodTotal = sNum(EN + 'power_production'), maxxi = sNum(EN + 'power_maxxisun'),
        feedin = sNum(EN + 'power_feedin'), purchased = sNum(EN + 'power_purchased'),
        haus = sNum(EN + 'power_consumption'), autark = sNum(EN + 'rate_autarky'),
        eigen = sNum(EN + 'rate_selfconsumption'),
        price = sNum(EN + 'tibber_states.energy_price_euro'),
        p20 = sNum(EN + 'tibber_states.energy_price_euro_p20'),
        p80 = sNum(EN + 'tibber_states.energy_price_euro_p80'),
        pMin = sNum(EN + 'tibber_states.energy_price_euro_min'),
        pMax = sNum(EN + 'tibber_states.energy_price_euro_max');
    var staleS = getState(EN + 'power_data_stale'), stale = !!(staleS && staleS.val === true);
    var se = prodTotal != null ? Math.max(0, prodTotal - Math.max(0, -(maxxi || 0))) : null;  // SolarEdge-only
    var grid = (purchased || 0) - (feedin || 0);
    var gridCol = enRoleCol(grid, grid < 0);
    var net = grid > 0 ? grid / 1000 * (price || 0) : grid / 1000 * 0.1048;
    // net>0 = importing (a cost, "−"); net<0 = exporting (income, "+")
    var netZero = Math.abs(net) < 0.005, netSign = netZero ? '' : (net < 0 ? '+' : '−');
    var pb = priceBand(price, p20, p80), priceCol = pb.col;
    var hasPrice = price != null && price > 0;
    var fcSem = vcEnergyFrameSem(net, price, p80);
    // importing with no price → net coerces to 0; don't paint the grey "break-even" frame (there IS a cost).
    if (grid > 50 && !hasPrice) fcSem = 'warn';
    var fc = vcSemColor(PAL, fcSem);
    // €/h headline shares the card-frame colour, so the two always agree (same cost/income verdict).
    var netCol = netZero ? LBL : fc;

    var h = '<div class="card energie" style="' + vcFrameStyle(fcSem) + '"><div class="card-body">';
    // price head + spectrum bar — only when a real price exists. The price colour (green/amber/red)
    // + the spectrum-bar position carry the günstig/mittel/teuer verdict, so the word is dropped (owner).
    if (hasPrice) {
        h += '<div class="price-head"><span class="lbl">Strompreis</span><span class="val num" style="color:' + priceCol + '">' + comma(price, 2) + '<span class="u">€/kWh</span></span>'
            + '<span class="net" style="color:' + netCol + '">' + netSign + comma(Math.abs(net), 2) + '<span class="u">€/h</span></span></div>';
        // bar spans the 7-day min–max range; labels show actual min/max (quantiles drive colour only).
        if (pMin != null && pMax != null && pMax > pMin) {
            var pf = clamp01((price - pMin) / (pMax - pMin)) * 100;
            h += '<div class="pricebar">' + spectrum(pf, comma(pMin, 2), comma(pMax, 2)) + '</div>';
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
    // Netz is the headline flow (owner) → first; then Haus, SolarEdge, Maxxisun.
    h += '<div class="flows">'
        + frow('grid', 'Netz', grid, gridCol)
        + frow('house', 'Haus', haus, stale ? LBL : enRoleCol(haus, false), stale)
        + frow('sun', 'SolarEdge', se, enRoleCol(se, true))
        + frow('battery', 'Maxxisun', maxxi, enRoleCol(maxxi, maxxi < 0, 500))
        + '</div>';
    // ratios — distinct stat treatment. Autarkie colour tracks the value (green=high/favourable,
    // amber=mid, grey=low) so it can't read "all good" in green at 0–18 % autark.
    var akCol = autark == null ? LBL : (autark >= 0.75 ? GREEN : (autark >= 0.4 ? AMBER : LBL));
    h += '<div class="estats">'
        + '<div class="estat"><span class="v num" style="color:' + akCol + '">' + Math.round((autark || 0) * 100) + '<span class="u">%</span></span><span class="l">autark' + (stale ? ' (≈)' : '') + '</span></div>'
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
    var h = '<div class="card steuerung"><div class="card-body"><div class="controls">';
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
// COLUMN-SPLIT: now the slim bottom-right strip (774×40) beside the nav, so each indicator is one
// horizontal row (dot · name · optional alarm word · battery) — a 2-line pill can't fit 40 px.
var RIBBON_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&display=swap');
.mv2r{--bg:#0d0e12;--surface:#15161c;--border:#262a33;--text:#CCCCCC;--muted:#8A8A8A;--green:#b5fb5b;--red-ind:#d8536f;
  width:766px;height:40px;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:12px;
  padding:5px 10px;display:flex;align-items:center;font-family:'Figtree',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased}
.mv2r *{margin:0;padding:0;box-sizing:border-box}
.mv2r .inds{flex:1;display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.mv2r .rind{background:var(--bg);border-radius:8px;padding:0 9px;height:28px;display:flex;align-items:center;gap:8px;overflow:hidden}
.mv2r .dot{width:10px;height:10px;border-radius:50%;flex:none}
.mv2r .nm{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0}
.mv2r .bat{margin-left:auto;align-self:center;display:flex;flex:none;padding-left:6px}
.mv2r .bat svg{width:22px;height:auto;display:block}
.mv2r .bat.sm{padding-left:4px}
.mv2r .bat.sm svg{width:16px}
`;
// HmIP maintenance read. An unreachable battery sensor has stopped communicating, so its STATE and
// LOW_BAT freeze at their last values — a dead-battery contact then reads a stale "closed" (false green)
// and a stale LOW_BAT=false (false "full battery"). So derive UNREACH (same channel-0 group as LOW_BAT)
// and treat it as BOTH "status unknown" and "battery flat" (HmIP voltages aren't comparable across
// device types, but a battery device that has gone offline is almost always dead).
function maint(batOid) {
    var lb = getState(batOid);
    var ur = batOid ? getState(batOid.replace('.LOW_BAT', '.UNREACH')) : null;
    var unreach = !!(ur && ur.val === true);
    return { unreach: unreach, low: unreach || !!(lb && lb.val === true) };
}
// battery symbol on EVERY indicator: a muted full battery when ok, a red near-empty one when low or
// offline — so a dying/dead door/window/lock sensor is visible at a glance. Sized readably via
// `.mv2r .bat svg` (22 px) so it isn't squashed in the 40 px row.
function lowbatIco(batOid) {
    var low = maint(batOid).low;
    if (_ribCompact && !low) return '';   // compact mode: healthy batteries yield their 28 px to the name
    return '<span class="bat' + (_ribCompact ? ' sm' : '') + '">'
        + icoBatt(low ? 12 : 100, low ? 'var(--red-ind)' : 'var(--muted)') + '</span>';
}
// At 40 px × 6-across the dot colour alone carries the verdict (green=secure / red=alarm / grey=unknown),
// so each row is just dot + name + battery — no status word, which kept truncating long names.
function indDot(name, col, batOid) {
    return '<div class="rind"' + (_ribCompact ? ' style="padding:0 6px;gap:6px"' : '') + '>'
        + '<span class="dot" style="background:' + col + '"></span><span class="nm">' + esc(name) + '</span>'
        + (batOid ? lowbatIco(batOid) : '') + '</div>';
}
function contactInd(name, oid, batOid) {
    if (maint(batOid).unreach) return indDot(name, 'var(--muted)', batOid);  // offline → unknown, never a stale green
    var v = sNum(oid);
    var col = v == null ? 'var(--muted)' : (v === 1 ? 'var(--red-ind)' : 'var(--green)');
    return indDot(name, col, batOid);
}
// Alarm-grade sensors: Rauchmelder / Wassersensor join the ribbon ONLY when they demand
// attention: red chip on alarm, muted chip on fault (offline / low battery / degraded smoke chamber) —
// a dead safety sensor must not be silently green-by-absence. The Sirene is different (owner call
// 2026-07-19): the house alarm's health is permanently interesting, so it holds a fixed 6th chip —
// green = connected & quiet, red = firing, muted = offline. Routine health lives on Diagnose.
var SMOKE = 'hm-rpc.1.000A5D89B45113', WATER = 'hm-rpc.1.00189D899BEABF', SIREN = 'hm-rpc.1.00245D898FEEF1';
function sTrue(id) { var s = getState(id); return !!(s && s.val === true); }
// compact mode (>5 chips): tighter chip chrome + battery icon only when it is actually low,
// so the extra alarm chips don't crush every name to one letter.
var _ribCompact = false;
function buildRibbon() {
    // decide the conditional alarm chips FIRST so chip chrome can adapt to the final count
    var extras = [];
    function extra(name, dev, alarmed, fault) {
        var m = maint(dev + '.0.LOW_BAT');
        if (alarmed) extras.push({ name: name, col: 'var(--red-ind)', bat: dev + '.0.LOW_BAT' });
        else if (m.unreach || m.low || fault) extras.push({ name: name, col: 'var(--muted)', bat: dev + '.0.LOW_BAT' });
    }
    extra('Rauch', SMOKE, (sNum(SMOKE + '.1.SMOKE_DETECTOR_ALARM_STATUS') || 0) > 0,   // 0=IDLE_OFF
        sTrue(SMOKE + '.1.ERROR_DEGRADED_CHAMBER'));
    extra('Wasser', WATER, sTrue(WATER + '.1.MOISTURE_DETECTED') || sTrue(WATER + '.1.WATERLEVEL_DETECTED'), false);
    // six permanent chips since the Sirene joined — always use the tight chrome
    // (battery icons only when low), otherwise names like Türschloss truncate
    _ribCompact = true;

    var lockBat = 'hm-rpc.1.002A226996B89C.0.LOW_BAT';
    var inds = ''
        + contactInd('Terrasse', 'hm-rpc.1.0007DD8996AFD3.1.STATE', 'hm-rpc.1.0007DD8996AFD3.0.LOW_BAT')
        + contactInd('Schuppen', 'hm-rpc.1.00155D89A38D55.1.STATE', 'hm-rpc.1.00155D89A38D55.0.LOW_BAT')
        + contactInd('Haustür', 'hm-rpc.1.0023DD89A5152D.1.STATE', 'hm-rpc.1.0023DD89A5152D.0.LOW_BAT');
    var lock = sNum('hm-rpc.1.002A226996B89C.1.LOCK_STATE');  // 0 UNKNOWN, 1 LOCKED, 2 UNLOCKED
    inds += maint(lockBat).unreach ? indDot('Türschloss', 'var(--muted)', lockBat)
        : (lock === 1) ? indDot('Türschloss', 'var(--green)', lockBat)
        : (lock === 2) ? indDot('Türschloss', 'var(--red-ind)', lockBat)
        : indDot('Türschloss', 'var(--muted)', lockBat);
    inds += contactInd('Bad', 'hm-rpc.1.0007DD89B41FD4.1.STATE', 'hm-rpc.1.0007DD89B41FD4.0.LOW_BAT');
    var sirenAlarm = sTrue(SIREN + '.3.ACOUSTIC_ALARM_ACTIVE') || sTrue(SIREN + '.3.OPTICAL_ALARM_ACTIVE');
    inds += maint(SIREN + '.0.LOW_BAT').unreach ? indDot('Sirene', 'var(--muted)', SIREN + '.0.LOW_BAT')
        : indDot('Sirene', sirenAlarm ? 'var(--red-ind)' : 'var(--green)', SIREN + '.0.LOW_BAT');
    extras.forEach(function (e) { inds += indDot(e.name, e.col, e.bat); });
    var n = 6 + extras.length;
    var inner = '<div class="mv2r"><style>' + RIBBON_CSS + '</style>'
        + '<div class="inds" style="grid-template-columns:repeat(' + n + ',1fr)' + (_ribCompact ? ';gap:5px' : '') + '">' + inds + '</div></div>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 766 40" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'
        + '<foreignObject x="0" y="0" width="766" height="40"><div xmlns="http://www.w3.org/1999/xhtml">' + inner + '</div></foreignObject></svg>';
}
var RIBBON_OIDS = ['hm-rpc.1.0007DD8996AFD3.1.STATE', 'hm-rpc.1.00155D89A38D55.1.STATE', 'hm-rpc.1.0023DD89A5152D.1.STATE', 'hm-rpc.1.0007DD89B41FD4.1.STATE', 'hm-rpc.1.002A226996B89C.1.LOCK_STATE',
    'hm-rpc.1.0007DD8996AFD3.0.LOW_BAT', 'hm-rpc.1.00155D89A38D55.0.LOW_BAT', 'hm-rpc.1.0023DD89A5152D.0.LOW_BAT', 'hm-rpc.1.0007DD89B41FD4.0.LOW_BAT', 'hm-rpc.1.002A226996B89C.0.LOW_BAT',
    'hm-rpc.1.0007DD8996AFD3.0.UNREACH', 'hm-rpc.1.00155D89A38D55.0.UNREACH', 'hm-rpc.1.0023DD89A5152D.0.UNREACH', 'hm-rpc.1.0007DD89B41FD4.0.UNREACH', 'hm-rpc.1.002A226996B89C.0.UNREACH',
    SMOKE + '.1.SMOKE_DETECTOR_ALARM_STATUS', SMOKE + '.1.ERROR_DEGRADED_CHAMBER', SMOKE + '.0.LOW_BAT', SMOKE + '.0.UNREACH',
    WATER + '.1.MOISTURE_DETECTED', WATER + '.1.WATERLEVEL_DETECTED', WATER + '.0.LOW_BAT', WATER + '.0.UNREACH',
    SIREN + '.3.ACOUSTIC_ALARM_ACTIVE', SIREN + '.3.OPTICAL_ALARM_ACTIVE', SIREN + '.0.LOW_BAT', SIREN + '.0.UNREACH'];

// ===== assemble — COLUMN-SPLIT: four independent widgets (hero + 3 columns), each its own
// <svg><foreignObject> sized to its vis box and carrying the shared CSS_BASE. The mid/right
// widgets run taller than the left/nav so the calendar + Energie gain height beside the nav. =====
function widgetSvg(rootCls, w, h, body) {
    var inner = '<div class="mv2 ' + rootCls + '"><style>' + CSS_BASE + '</style>' + body + '</div>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'
        + '<foreignObject x="0" y="0" width="' + w + '" height="' + h + '">'
        + '<div xmlns="http://www.w3.org/1999/xhtml">' + inner + '</div></foreignObject></svg>';
}
function renderHero()  { return widgetSvg('hw', 1170, 178, buildHero()); }
function renderLeft()  { return widgetSvg('lw', 392, 487, buildKlima()); }
function renderMid()   { return widgetSvg('mw', 377, 534, buildWoche() + buildTanken()); }
function renderRight() { return widgetSvg('rw', 377, 534, buildEnergie() + buildSteuerung()); }

// Re-point (simplest): any data change republishes all four columns — cheap for a 20 s wall and
// four small HTML strings, and keeps the subscription list below untouched.
function publish() {
    setState('main_v2_hero', renderHero());
    setState('main_v2_left', renderLeft());
    setState('main_v2_mid', renderMid());
    setState('main_v2_right', renderRight());
}
function publishRibbon() { setState('main_v2_ribbon', buildRibbon()); }

// Create all five states first; only render once every state object exists (publish() writes all
// four columns, so firing it from an early per-state callback would setState a not-yet-created id).
var _statesReady = 0;
function _onStateReady() { if (++_statesReady >= 5) { publish(); publishRibbon(); } }
createState('main_v2_hero',   '', { desc: 'Neu Glance-Band (HTML)',         type: 'string', role: 'html' }, _onStateReady);
createState('main_v2_left',   '', { desc: 'Neu Klima-Spalte (HTML)',        type: 'string', role: 'html' }, _onStateReady);
createState('main_v2_mid',    '', { desc: 'Neu Kalender + Tanken (HTML)',   type: 'string', role: 'html' }, _onStateReady);
createState('main_v2_right',  '', { desc: 'Neu Energie + Steuerung (HTML)', type: 'string', role: 'html' }, _onStateReady);
createState('main_v2_ribbon', '', { desc: 'Neu HAUS-Statusleiste (HTML)',   type: 'string', role: 'html' }, _onStateReady);

// ===== subscriptions =====
ROOMS.forEach(function (r) {
    ['.Temperature.Temperature', '.Humidity.Humidity', '.CO2.CO2', '.LastUpdate', '.BatteryStatus'].forEach(function (s) {
        on({ id: r[1] + s, change: 'ne' }, publish);
    });
});
[OUTDOOR + '.Temperature.Temperature', OUTDOOR + '.Humidity.Humidity', FCMIN, FCMAX,
 NB + '.Pressure.Pressure',
 EN + 'sunrise', EN + 'sunset', EN + 'moonrise', EN + 'moonset', EN + 'moon_phase',
 'tankerkoenig.0.stations.1.diesel.feed', 'tankerkoenig.0.stations.1.e5.feed', 'ical.0.data.table'].forEach(function (id) {
    on({ id: id, change: 'ne' }, publish);
});
['power_production', 'power_maxxisun', 'power_feedin', 'power_purchased', 'power_consumption', 'rate_autarky', 'rate_selfconsumption', 'power_data_stale'].forEach(function (s) {
    on({ id: EN + s, change: 'ne' }, publish);
});
[EN + 'tibber_states.energy_price_euro', EN + 'tibber_states.energy_price_euro_p20', EN + 'tibber_states.energy_price_euro_p80',
 EN + 'tibber_states.energy_price_euro_min', EN + 'tibber_states.energy_price_euro_max'].forEach(function (id) {
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