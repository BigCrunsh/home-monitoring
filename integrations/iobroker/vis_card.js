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
    autarkGoodMin: 0.75, autarkWarnMin: 0.40
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
// min→max spectrum bar with a marker (price-in-range). Colours passed via PAL so the gradient +
// end labels match the host tab's representation.
function vcSpectrum(PAL, knobPct, lo, hi) {
    return '<div class="spec"><div class="bar" style="background:linear-gradient(90deg,' + PAL.good + ',' + PAL.warn + ',' + PAL.alarm + ')"><div class="knob" style="left:' + knobPct.toFixed(0) + '%"></div></div>'
        + '<div class="mm"><span style="color:' + PAL.good + '">' + lo + '</span><span style="color:' + PAL.alarm + '">' + hi + '</span></div></div>';
}

console.log('[vis_card] shared helpers loaded');
