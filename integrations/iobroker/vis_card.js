// vis_card.js — shared GLOBAL script for the .mv2 dashboard tabs.
// Place in ioBroker's script.js.global folder: its source is prepended to every other JS
// script, so every declaration here is in scope for main_v2 / energy_tab_v2 / klima_v2 /
// diagnose_v2 / steuerung_v2 / musik_v2. This is the single source DESIGN_SYSTEM.md calls for.
//
// DESIGN RULES that make this safe to introduce incrementally:
//  1. Every name is vc-prefixed → purely additive. It cannot collide with, or shadow, any
//     helper a not-yet-migrated script still defines locally. Migrate one script at a time.
//  2. Colour is NOT baked in. main_v2 renders colours as CSS vars ('var(--green)'); the other
//     tabs use hex ('#b5fb5b'). Both are correct in their own <style> scope but are DIFFERENT
//     LITERAL STRINGS. So the classifiers here return SEMANTIC TOKENS
//     ('good'|'warn'|'alarm'|'cold'|'muted') exactly as DESIGN_SYSTEM.md prescribes, and each
//     script maps sem→its own palette via vcSemColor(PAL, sem). Thresholds live here ONCE;
//     representation stays each script's own.
//  3. Thresholds are named constants on VC.* so a rule change is one line, board-wide.

// Canonical palette (ground truth). The ONE place data-driven colour values live. Per
// DESIGN_SYSTEM.md's two-layer rule, data-driven colour is hex in JS (not a CSS var — vis
// bindings can't read those, and hex is browser-agnostic on the wall); the CSS custom
// properties in each widget's <style> are the SEPARATE static-chrome layer, defined from the
// same values. Every tab derives its GREEN/AMBER/… constants from this so they can't diverge.
var VC_PAL = {
    good: '#b5fb5b',   // lime — PV/supply/saving, cheap tier
    warn: '#F1BE3D',   // amber — attention/mid tier, import (not alarm)
    alarm: '#A00629',  // red — ALARM ONLY / top tier
    cold: '#5080AC',   // blue — grid-import & cold & consumption series
    muted: '#8A8A8A',  // grey — unknown / low / caption
    mute: '#7F8A99',   // secondary grey
    text: '#CCCCCC',
    surf: '#15161c', inset: '#1c1f28', border: '#262a33', bg: '#0d0e12'
};

var VC = {
    // role/consumption ladder (enRoleCol): favourable ≥75 W = good; consumption ≥150 W = warn,
    // ≥2 kW = alarm; otherwise muted. Battery high-threshold overridable per call.
    roleGoodMin: 75, consWarnMin: 150, consAlarmMin: 2000,
    // net €/h neutral band (energyFrame): |net| ≤ 0,05 €/h reads as break-even.
    costNeutral: 0.05,
    // autarky verdict: ≥75 % good, ≥40 % warn, else muted (never alarm — low autarky isn't an error).
    autarkGoodMin: 0.75, autarkWarnMin: 0.40,
    // data freshness (vcFreshness): >60 min stale (caption red), >6 h dead (values greyed).
    staleAfterMs: 3600000, deadAfterMs: 21600000
};

// ===== pure formatters (representation-independent) =====
function vcComma(v, d) { return (typeof v === 'number') ? v.toFixed(d == null ? 1 : d).replace('.', ',') : '–'; }
function vcClamp01(x) { return Math.max(0, Math.min(1, x)); }
function vcPad2(n) { return ('0' + n).slice(-2); }
// power with adaptive unit: ≥1 kW → "1,8 kW", else "620 W". Unit wrapped in .u (class-based, so
// representation-independent). Overview + Energie both render this identically.
function vcWatts(v) { var a = Math.abs(v || 0); return a >= 1000 ? vcComma(a / 1000, 1) + '<span class="u"> kW</span>' : Math.round(a) + '<span class="u"> W</span>'; }
function vcKwh1(v) { return v == null ? '–' : vcComma(v, 1); }
function vcEur2(v) { return v == null ? '–' : vcComma(v, 2) + ' €'; }
function vcEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ===== Berlin time (Pi OS runs Europe/London; the household clock is Europe/Berlin) =====
function vcBerlinNow() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })); }
function vcDayKey(dt) { return (dt || new Date()).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }); }
function vcBerlinParts(ts) {
    var d = new Date(new Date(ts).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    return { h: d.getHours(), m: d.getMinutes(), frac: d.getHours() + d.getMinutes() / 60, dow: d.getDay(), date: d.getDate() };
}
var VC_DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
var VC_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// ===== semantic classifiers (return a token; caller maps to its palette) =====
// enRoleCol logic → sem. favourable flows (PV/feed-in/charge) are good once meaningful, else muted;
// consumption/import flows escalate muted→warn→alarm by magnitude.
function vcRoleSem(val, favourable, high) {
    var m = Math.abs(val || 0);
    if (favourable) return m < VC.roleGoodMin ? 'muted' : 'good';
    if (m < VC.consWarnMin) return 'muted';
    return m < (high || VC.consAlarmMin) ? 'warn' : 'alarm';
}
// age of a reading (ms) → 'fresh' | 'stale' | 'dead'. Netatmo + DasWetter freeze during an internet
// outage; a frozen value must not keep its fresh comfort colour. Unknown age → dead (never fresh).
function vcFreshness(ageMs) {
    if (typeof ageMs !== 'number' || isNaN(ageMs)) return 'dead';
    return ageMs > VC.deadAfterMs ? 'dead' : (ageMs > VC.staleAfterMs ? 'stale' : 'fresh');
}
// price position vs 7-day p20/p80 → {sem, word}. Missing data → muted, no false verdict.
function vcPriceSem(price, p20, p80) {
    if (price == null || p20 == null || p80 == null) return { band: -1, sem: 'muted', word: '–' };
    var band = price <= p20 ? 0 : (price >= p80 ? 2 : 1);
    return { band: band, sem: ['good', 'warn', 'alarm'][band], word: ['günstig', 'mittel', 'teuer'][band] };
}
// energy card verdict by net €/h (net>0 = importing/cost, net<0 = exporting/income):
// income > 0,05 → good; |net| ≤ 0,05 → muted; cost → alarm when price is "teuer" (≥p80) else warn.
function vcEnergyFrameSem(net, price, p80) {
    if (-net > VC.costNeutral) return 'good';
    if (Math.abs(net) <= VC.costNeutral) return 'muted';
    return (price != null && p80 != null && price >= p80) ? 'alarm' : 'warn';
}
// autarky/self-sufficiency ratio (0..1) → sem. Never alarm.
function vcAutarkSem(frac) {
    if (frac == null) return 'muted';
    return frac >= VC.autarkGoodMin ? 'good' : (frac >= VC.autarkWarnMin ? 'warn' : 'muted');
}

// ===== Maxxisun sign convention (the ONE place the dashboard layer decides direction) =====
// javascript.0.power_maxxisun is SIGNED, defined by the producer solaredge_power.js:84 as
// 'Maxxisun AC-Leistung (negativ = Einspeisung, positiv = Laden)' — so negative = the battery
// delivers into the house, positive = it charges. Re-deriving that per call site is what
// inverted the Energie tab ("Maxxisun · liefert" while charging at +730 W) and cross-fed the
// daily kWh counters; both helpers below exist so there is nothing left to re-derive.
//
// The word only — colour stays the caller's business via vcRoleSem/vcSemColor, because the
// charging side has its own magnitude ladder (muted → warn → alarm above a per-call `high`)
// that a flat verdict here would flatten. Vocabulary matches maxxisun_status
// (Speist | Lädt | Bereit) so the tab and the ribbon chip never disagree. Below the
// VC.roleGoodMin band the flow is negligible and the row stays a plain "Maxxisun".
function vcMaxxiWord(w) {
    var v = (typeof w === 'number' && isFinite(w)) ? w : 0;
    if (Math.abs(v) < VC.roleGoodMin) return '';
    return v < 0 ? 'speist' : 'lädt';
}
// Signed power → the two non-negative contributions the daily kWh integrators accumulate.
// Mirrors solaredge_power.js:438 (maxxiCharge = Math.max(0, apower)). Deliberately has NO
// deadband: the 75 W band above suppresses a label, but energy accounting must integrate every
// watt or the day's kWh silently under-reports trickle charging. A non-numeric reading (sNum()
// returns null for an absent state) contributes nothing rather than guessing a direction.
function vcMaxxiSplit(w) {
    var v = (typeof w === 'number' && isFinite(w)) ? w : 0;
    return { charge: Math.max(0, v), discharge: Math.max(0, -v) };
}

// ===== sem → presentation =====
// PAL maps the five sems to a script's own colour representation, e.g.
//   var PAL = { good: GREEN, warn: AMBER, alarm: RED, cold: BLUE, muted: LBL, text: TEXT };
function vcSemColor(PAL, sem) { return PAL[sem] || PAL.muted; }
// green/amber/red accent frame (the liked .card--accent look). rgba literals are fixed (identical
// in every script's CSS), so this is representation-independent and keyed by sem.
function vcFrameStyle(sem) {
    if (sem === 'good') return 'border-color:rgba(181,251,91,.55);box-shadow:0 0 0 1px rgba(181,251,91,.16)';
    if (sem === 'warn') return 'border-color:rgba(241,190,61,.6);box-shadow:0 0 0 1px rgba(241,190,61,.16)';
    if (sem === 'alarm') return 'border-color:rgba(160,6,41,.85);box-shadow:0 0 0 1px rgba(160,6,41,.22)';
    return '';
}

// ===== shared SVG snippets =====
// energy-flow node glyphs (sun/battery/grid/house), colour passed in — representation-independent.
function vcEnIco(kind, col, sz) {
    sz = sz || 22;
    var g = '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 18 18"><g stroke="' + col + '" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">';
    if (kind === 'sun') g += '<circle cx="9" cy="9" r="3.4"/><line x1="9" y1="1.5" x2="9" y2="3.4"/><line x1="9" y1="14.6" x2="9" y2="16.5"/><line x1="1.5" y1="9" x2="3.4" y2="9"/><line x1="14.6" y1="9" x2="16.5" y2="9"/><line x1="4" y1="4" x2="5.3" y2="5.3"/><line x1="12.7" y1="12.7" x2="14" y2="14"/><line x1="14" y1="4" x2="12.7" y2="5.3"/><line x1="5.3" y1="12.7" x2="4" y2="14"/>';
    else if (kind === 'battery') g += '<rect x="2" y="5" width="13" height="8" rx="1.6"/><line x1="15.5" y1="7.5" x2="15.5" y2="10.5" stroke-width="2.4"/>';
    else if (kind === 'grid') g += '<line x1="3" y1="15" x2="6" y2="3"/><line x1="15" y1="15" x2="12" y2="3"/><line x1="6" y1="3" x2="12" y2="3"/><line x1="4.5" y1="9" x2="13.5" y2="9"/>';
    else if (kind === 'house') g += '<path d="M2 8 L9 2 L16 8"/><rect x="4.5" y="8" width="9" height="7" rx="1"/>';
    return g + '</g></svg>';
}
// ===== SPECTRUM (price position within its window) =====
// q = {min, max, p20, p50, p80} of the price window (Strom 7 d, Tanken 14 d). The bar spans
// min→max; its green→amber and amber→red transitions (CSS colour hints) sit where p20/p80 fall on
// that axis, amber peaks at the median — so the gradient shows the distribution and always agrees
// with vcPriceSem's verdict colour. Missing/flat quantiles → even gradient (no invented shape).
function vcSpectrumPct(v, q) { return vcClamp01((v - q.min) / (q.max - q.min)) * 100; }
function vcSpectrumGradient(PAL, q) {
    var ok = q && [q.min, q.max, q.p20, q.p50, q.p80].every(function (v) { return typeof v === 'number'; }) && q.max > q.min;
    if (!ok) return 'linear-gradient(90deg,' + PAL.good + ' 0%,' + PAL.warn + ' 50%,' + PAL.alarm + ' 100%)';
    var a = vcSpectrumPct(q.p20, q), m = Math.max(a, vcSpectrumPct(q.p50, q)), b = Math.max(m, vcSpectrumPct(q.p80, q));
    return 'linear-gradient(90deg,' + PAL.good + ' 0%,' + a.toFixed(0) + '%,' + PAL.warn + ' ' + m.toFixed(0) + '%,'
        + b.toFixed(0) + '%,' + PAL.alarm + ' 100%)';
}
function vcSpectrumKnobPct(price, q) {
    return (typeof price === 'number' && q && typeof q.min === 'number' && typeof q.max === 'number' && q.max > q.min)
        ? vcSpectrumPct(price, q) : 50;
}
// bar + knob + actual min/max labels. Colours via PAL so it matches the host tab's representation.
function vcSpectrum(PAL, price, q) {
    q = q || {};
    return '<div class="spec"><div class="bar" style="background:' + vcSpectrumGradient(PAL, q) + '"><div class="knob" style="left:' + vcSpectrumKnobPct(price, q).toFixed(0) + '%"></div></div>'
        + '<div class="mm"><span style="color:' + PAL.good + '">' + vcComma(q.min, 2) + '</span><span style="color:' + PAL.alarm + '">' + vcComma(q.max, 2) + '</span></div></div>';
}

// ===== OUTDOOR CLIMATE CLUSTER (hero top-left: Übersicht + Klima) =====
// ONE component, referenced by both tabs so the corner can't drift apart again (Klima's copy had
// lost the weather column and the freshness greying). Layout: temp column (big outdoor temp top /
// today's min·max on the metadata baseline, last-update caption hanging below) + weather column
// (symbol top / humidity · pressure baseline). vcClimRead takes the states → plain numbers;
// vcClimCluster is pure (numbers → markup); the host puts VC_CLIM_CSS into its widget <style>.

// comfort band of an air temperature → sem (outside temp + rooms): ≤3 °C muted (frost range reads
// as "nothing to do"), <12 cold, <20 good, <27 warn, else alarm. Missing → muted.
function vcComfortSem(t) {
    if (typeof t !== 'number' || isNaN(t)) return 'muted';
    return t <= 3 ? 'muted' : (t < 12 ? 'cold' : (t < 20 ? 'good' : (t < 27 ? 'warn' : 'alarm')));
}
// age (ms) → "40 s" | "13 min" | "7 h"; unknown → null. Clock skew (future) clamps to 0 s.
function vcAgo(ms) {
    if (typeof ms !== 'number' || isNaN(ms)) return null;
    var s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? s + ' s' : (s < 3600 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h');
}

var VC_NB = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';   // Netatmo base station (pressure)
var VC_CLIM = {
    base: VC_NB,
    outdoor: VC_NB + '.02-00-00-32-ae-a4',                            // outdoor module (temp, humidity)
    fcMin: 'daswetter.0.NextDays.Location_1.Day_1.Minimale_Temperatur_value',
    fcMax: 'daswetter.0.NextDays.Location_1.Day_1.Maximale_Temperatur_value',
    wsym: 'daswetter.0.NextDays.Location_1.Day_1.Wetter_Symbol_id'
};
// the states whose change should re-render the cluster (hosts subscribe to exactly this list)
VC_CLIM.triggers = [VC_CLIM.outdoor + '.Temperature.Temperature', VC_CLIM.outdoor + '.Humidity.Humidity',
    VC_CLIM.base + '.Pressure.Pressure', VC_CLIM.fcMin, VC_CLIM.fcMax, VC_CLIM.wsym];

// states → snapshot. get = ioBroker getState (injected so this stays testable). Netatmo stamps each
// module's LastUpdate; DasWetter rewrites its states every 15 min, so the min state's .ts is its heartbeat.
function vcClimRead(get, now) {
    now = now || Date.now();
    function num(id) { var s = get(id); return (s && typeof s.val === 'number' && !isNaN(s.val)) ? s.val : null; }
    function luAge(mod) {
        var s = get(mod + '.LastUpdate'); if (!s || s.val == null) return null;
        var t = new Date(s.val).getTime(); return isNaN(t) ? null : now - t;
    }
    var fc = get(VC_CLIM.fcMin);
    return {
        temp: num(VC_CLIM.outdoor + '.Temperature.Temperature'), hum: num(VC_CLIM.outdoor + '.Humidity.Humidity'),
        pres: num(VC_CLIM.base + '.Pressure.Pressure'),
        min: num(VC_CLIM.fcMin), max: num(VC_CLIM.fcMax), wsym: num(VC_CLIM.wsym),
        outdoorAgeMs: luAge(VC_CLIM.outdoor), baseAgeMs: luAge(VC_CLIM.base),
        forecastAgeMs: (fc && typeof fc.ts === 'number') ? now - fc.ts : null
    };
}

function vcIcoDrop(col, sz) { sz = sz || 16; return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24"><path d="M12 2.5 C12 2.5 5.5 10.5 5.5 15.2 a6.5 6.5 0 0 0 13 0 C18.5 10.5 12 2.5 12 2.5 Z" fill="' + col + '"/><ellipse cx="9.6" cy="15.2" rx="1.6" ry="2.4" fill="#ffffff" opacity="0.35"/></svg>'; }
function vcIcoGauge(col, sz) { sz = sz || 16; return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24"><g fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><line x1="12" y1="7.5" x2="12" y2="9.2"/><line x1="16.5" y1="12" x2="14.8" y2="12"/><line x1="7.5" y1="12" x2="9.2" y2="12"/><line x1="12" y1="12" x2="15.4" y2="9.2"/></g><circle cx="12" cy="12" r="1.6" fill="' + col + '"/></svg>'; }
// DasWetter symbol 1..22; anything else keeps the (empty) slot so the column doesn't collapse.
function vcWxImg(id) {
    if (typeof id !== 'number' || isNaN(id) || id < 1 || id > 22) return '<div class="h-wx"></div>';
    return '<div class="h-wx"><img src="/daswetter.admin/icons/tiempo-weather/galeria1/' + Math.round(id) + '.png" alt=""/></div>';
}
// the Metric component: value + top-aligned °C + optional bottom-aligned label (min/max).
function vcTempMetric(val, dec, label, cls, col) {
    return '<span class="metric ' + (cls || '') + '"><span class="mval num" style="color:' + col + '">' + vcComma(val, dec)
        + '</span><span class="mu"><span class="uu">°C</span>' + (label ? '<span class="ll">' + label + '</span>' : '') + '</span></span>';
}
// d = vcClimRead(...). Freshness (vcFreshness) per source: outdoor module → temp + humidity; base
// station → pressure; DasWetter → min/max + symbol. Dead → grey; any source not fresh → red caption.
function vcClimCluster(PAL, d) {
    d = d || {};
    var oF = vcFreshness(d.outdoorAgeMs), bF = vcFreshness(d.baseAgeMs), fcF = vcFreshness(d.forecastAgeMs);
    var oDead = oF === 'dead', fcDead = fcF === 'dead';
    var mut = PAL.muted;
    var fcCol = function (v) { return fcDead ? mut : vcSemColor(PAL, vcComfortSem(v)); };
    var cap = 'vor ' + (vcAgo(d.outdoorAgeMs) || '–');
    if (fcF !== 'fresh') cap += ' · Prognose vor ' + (vcAgo(d.forecastAgeMs) || '–');
    var capCol = (oF !== 'fresh' || fcF !== 'fresh') ? PAL.alarm : mut;
    function r0(v) { return (typeof v === 'number' && !isNaN(v)) ? Math.round(v) : '–'; }
    return '<div class="h-clim">'
        + '<div class="h-tempcol">'
        +   vcTempMetric(d.temp, 1, null, 'otemp', oDead ? mut : vcSemColor(PAL, vcComfortSem(d.temp)))
        +   '<div class="mm">' + vcTempMetric(d.min, 0, 'min', null, fcCol(d.min)) + vcTempMetric(d.max, 0, 'max', null, fcCol(d.max)) + '</div>'
        +   '<div class="h-age" style="color:' + capCol + '">' + vcEsc(cap) + '</div>'
        + '</div>'
        + '<div class="h-wxcol' + (fcDead ? ' dead' : '') + '">' + vcWxImg(d.wsym)
        +   '<div class="h-metrics">'
        +     '<div class="line"' + (oDead ? ' style="color:' + mut + '"' : '') + '>' + vcIcoDrop(oDead ? mut : PAL.cold, 18) + '<b class="num">' + r0(d.hum) + '</b><span class="u">%</span></div>'
        +     '<div class="line"' + (bF === 'dead' ? ' style="color:' + mut + '"' : '') + '>' + vcIcoGauge(mut, 18) + '<b class="num">' + r0(d.pres) + '</b><span class="u">mbar</span></div>'
        +   '</div></div>'
        + '</div>';
}
// the cluster's CSS (needs the .mv2 token block: --s*, --t-*, --sym-wx, --muted, --text).
var VC_CLIM_CSS = `
.mv2 .h-clim{justify-self:start; display:flex; align-items:center; gap:var(--s6)}
/* the Metric component — value + top-aligned unit (uu) + optional bottom-aligned label (ll) */
.mv2 .metric{display:inline-flex; align-items:stretch; gap:3px; white-space:nowrap}
.mv2 .metric .mval{font-weight:600; line-height:.82}
.mv2 .metric .mu{display:flex; flex-direction:column; justify-content:space-between; padding:.1em 0 .02em; color:var(--muted); font-weight:500; line-height:1; font-size:13px}
/* temp column + weather column, each glyph-top / metadata-baseline-bottom.
   align-items:stretch + .mm space-between makes min/max span the temp's width → left+right aligned. */
.mv2 .h-tempcol{position:relative; display:flex; flex-direction:column; align-items:stretch; justify-content:center; gap:var(--s1)}
.mv2 .otemp{align-self:flex-start}
.mv2 .otemp .mval{font-size:var(--t-hero); letter-spacing:-.03em}
.mv2 .otemp .mu{font-size:26px; padding-top:.16em}
.mv2 .mm{display:flex; justify-content:space-between; align-items:flex-end}
.mv2 .mm .metric .mval{font-size:50px}
.mv2 .mm .metric .mu{font-size:15px}
/* last-update caption hangs BELOW the temp column (out of flow) so min/max keep the shared metadata
   baseline with humidity · pressure; it sits in the hero's bottom padding. */
.mv2 .h-age{position:absolute; left:0; top:100%; margin-top:2px; font-size:var(--t-cap); line-height:1; color:var(--muted); white-space:nowrap}
.mv2 .h-wxcol{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:var(--s1)}
.mv2 .h-wxcol.dead .h-wx img{filter:grayscale(1); opacity:.45}
.mv2 .h-wx{display:flex; align-items:center; justify-content:center; min-height:var(--sym-wx)}
.mv2 .h-wx img{height:var(--sym-wx); width:auto; display:block}
.mv2 .h-metrics{display:flex; flex-direction:row; align-items:center; gap:var(--s4)}
.mv2 .h-metrics .line{display:flex; align-items:center; gap:var(--s2); font-size:var(--t-label); color:var(--muted)}
.mv2 .h-metrics .line b{color:var(--text); font-weight:600; font-size:var(--t-sub)}
`;

console.log('[vis_card] shared helpers loaded');