// Unit tests for the shared vis_card.js helpers. vis_card.js is an ioBroker *global* script (no
// module exports), so it is evaluated in a vm sandbox and its top-level functions read back.
// Run: make check-iobroker
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'integrations', 'iobroker', 'vis_card.js'), 'utf8');
const ctx = { console: { log() {} } };
vm.createContext(ctx);
vm.runInContext(src, ctx);

const PAL = { good: 'G', warn: 'W', alarm: 'R' };
const EVEN = 'linear-gradient(90deg,G 0%,W 50%,R 100%)';
// skewed 7-day distribution: cheap hours are clustered low, a few expensive spikes stretch max.
const Q = { min: 0.20, p20: 0.24, p50: 0.28, p80: 0.30, max: 0.40 };

// ---- vcSpectrumGradient: colour transitions sit at p20/p80, amber peak at the median ----
test('gradient: transitions at p20/p80 and amber at p50, as % of the min→max axis', () => {
    assert.equal(ctx.vcSpectrumGradient(PAL, Q), 'linear-gradient(90deg,G 0%,20%,W 40%,50%,R 100%)');
});
test('gradient: any missing quantile → even fallback (no invented distribution)', () => {
    for (const k of ['min', 'max', 'p20', 'p50', 'p80']) {
        const q = Object.assign({}, Q, { [k]: null });
        assert.equal(ctx.vcSpectrumGradient(PAL, q), EVEN, 'missing ' + k);
    }
});
test('gradient: no quantile object at all → even fallback', () => {
    assert.equal(ctx.vcSpectrumGradient(PAL, undefined), EVEN);
});
test('gradient: flat window (min == max) → even fallback, no divide-by-zero', () => {
    assert.equal(ctx.vcSpectrumGradient(PAL, { min: 0.3, p20: 0.3, p50: 0.3, p80: 0.3, max: 0.3 }), EVEN);
});
test('gradient: quantiles outside min..max are clamped to the bar', () => {
    const g = ctx.vcSpectrumGradient(PAL, { min: 0.20, p20: 0.10, p50: 0.30, p80: 0.50, max: 0.40 });
    assert.equal(g, 'linear-gradient(90deg,G 0%,0%,W 50%,100%,R 100%)');
});
test('gradient: out-of-order quantiles still yield monotonic stops', () => {
    // p50 < p20 (stale/partial update) must not produce a backwards gradient
    const g = ctx.vcSpectrumGradient(PAL, { min: 0, p20: 0.5, p50: 0.3, p80: 0.8, max: 1 });
    assert.equal(g, 'linear-gradient(90deg,G 0%,50%,W 50%,80%,R 100%)');
});

// ---- vcSpectrumKnobPct: where the current price sits on the min→max axis ----
test('knob: price position as % of min→max', () => {
    assert.ok(Math.abs(ctx.vcSpectrumKnobPct(0.30, Q) - 50) < 1e-9);
});
test('knob: missing price or range → centred 50 %', () => {
    assert.equal(ctx.vcSpectrumKnobPct(null, Q), 50);
    assert.equal(ctx.vcSpectrumKnobPct(0.3, { min: null, max: 0.4 }), 50);
    assert.equal(ctx.vcSpectrumKnobPct(0.3, { min: 0.3, max: 0.3 }), 50);
    assert.equal(ctx.vcSpectrumKnobPct(0.3, undefined), 50);
});
test('knob: price beyond the window range is clamped to the bar ends', () => {
    assert.equal(ctx.vcSpectrumKnobPct(0.10, Q), 0);
    assert.equal(ctx.vcSpectrumKnobPct(0.90, Q), 100);
});

// ---- vcSpectrum: the component carries the quantile gradient itself ----
test('vcSpectrum: renders quantile gradient, knob and min/max labels', () => {
    const h = ctx.vcSpectrum(PAL, 0.30, Q);
    assert.ok(h.includes('background:linear-gradient(90deg,G 0%,20%,W 40%,50%,R 100%)'), h);
    assert.ok(h.includes('left:50%'), h);
    assert.ok(h.includes('>0,20<') && h.includes('>0,40<'), h);
});
test('vcSpectrum: missing quantiles → even gradient, "–" labels, no throw', () => {
    const h = ctx.vcSpectrum(PAL, null, {});
    assert.ok(h.includes(EVEN.replace('linear-gradient', 'background:linear-gradient')), h);
    assert.ok(h.includes('left:50%'), h);
    assert.ok(h.includes('>–<'), h);
});
