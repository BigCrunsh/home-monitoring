// Guards for the Energie tab's use of the Maxxisun sign convention.
//
// energy_tab_v2.js cannot be unit-tested wholesale: it is an ioBroker script whose builders read
// live states through getState() and emit SVG. What CAN be pinned is the part that actually broke
// — that the file defers to the shared vis_card helpers instead of re-deriving the sign, and that
// the ±lane's geometry agrees with the axis labels printed beside it. Both checks below target
// the specific defect that shipped: the tab rendered "Maxxisun · liefert" and drew charging
// upward while the battery was charging at +730 W.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOBROKER = path.resolve(__dirname, '..', '..', 'integrations', 'iobroker');
const SRC = fs.readFileSync(path.join(IOBROKER, 'energy_tab_v2.js'), 'utf8');

function loadVisCard() {
    const ctx = { console };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOBROKER, 'vis_card.js'), 'utf8'), ctx);
    return ctx;
}
const vc = loadVisCard();


// Evaluate the real INTEGRALS table with sNum() stubbed, so each daily-kWh extractor can be run
// for a given power_maxxisun reading. This exercises the actual deployed wiring rather than
// pattern-matching it — the counters were swapped in exactly this table.
function runIntegrals(powerMaxxisun) {
    const start = SRC.indexOf('var INTEGRALS = [');
    assert.notStrictEqual(start, -1, 'INTEGRALS table not found in energy_tab_v2.js');
    const open = SRC.indexOf('[', start);
    let depth = 0, end = -1;
    for (let i = open; i < SRC.length; i++) {
        if (SRC[i] === '[') depth++;
        else if (SRC[i] === ']' && --depth === 0) { end = i + 1; break; }
    }
    assert.notStrictEqual(end, -1, 'unbalanced brackets in the INTEGRALS table');

    const ctx = {
        EN: 'javascript.0.',
        // only the Maxxisun reading matters here; the other series resolve to 0
        sNum: (id) => (id === 'javascript.0.power_maxxisun' ? powerMaxxisun : 0),
        Math,
        vcMaxxiSplit: vc.vcMaxxiSplit,
    };
    vm.createContext(ctx);
    vm.runInContext(SRC.slice(start, end) + '; this.INTEGRALS = INTEGRALS;', ctx);

    const out = {};
    for (const entry of ctx.INTEGRALS) out[entry[0]] = entry[1]();
    return out;
}

// ===== the tab must not re-derive the sign =====

// since 2026-10-31 the curve shows the battery without words (a blue line on the shared scale, its
// sign pinned by energy_tab_v2_layout.test.js); the flow row is the one place that names the direction
test('the flow row takes its direction word from vcMaxxiWord', () => {
    const calls = SRC.match(/vcMaxxiWord\(/g) || [];
    assert.ok(calls.length >= 1, `expected the flow row to call vcMaxxiWord, found ${calls.length}`);
});

test('the inverted ternary that shipped the bug is gone', () => {
    // The literal defect: negative (delivering) mapped to "lädt".
    assert.ok(!/maxxi\s*<\s*0\s*\?\s*'\s*·\s*lädt'/.test(SRC),
        'the flow row still maps negative power to "lädt"');
    assert.ok(!/lastM\.v\s*<\s*0\s*\?\s*'lädt'/.test(SRC),
        'the lane endpoint still maps negative power to "lädt"');
});

test('no site hand-rolls the direction word instead of asking vis_card', () => {
    // 'liefert' was the old, inverted vocabulary. It may survive in explanatory comments, but
    // never as a rendered string literal or SVG text node.
    assert.ok(!/'liefert'/.test(SRC), "'liefert' is still used as a string literal");
    assert.ok(!/>liefert/.test(SRC), "'liefert' is still rendered as SVG text");
});

// ===== the daily kWh counters must not cross-feed =====

test('charging power accumulates into maxxicharge, not maxxidischarge', () => {
    // The live reading that exposed the bug: +730 W charging, while the counter named
    // maxxidischarge was the one growing.
    const r = runIntegrals(730.1);
    assert.strictEqual(r.maxxicharge, 730.1);
    assert.strictEqual(r.maxxidischarge, 0, 'charging must not feed the discharge counter');
});

test('delivering power accumulates into maxxidischarge, not maxxicharge', () => {
    const r = runIntegrals(-730.1);
    assert.strictEqual(r.maxxidischarge, 730.1);
    assert.strictEqual(r.maxxicharge, 0, 'delivering must not feed the charge counter');
});

test('exactly one counter moves for any non-zero reading', () => {
    for (const w of [1, 75, 546.5, 730.1, 5000, -1, -75, -546.5, -730.1, -5000]) {
        const r = runIntegrals(w);
        const moved = [r.maxxicharge, r.maxxidischarge].filter((v) => v > 0);
        assert.strictEqual(moved.length, 1, `${w} W moved ${moved.length} counters, expected 1`);
        assert.strictEqual(w > 0 ? r.maxxicharge : r.maxxidischarge, Math.abs(w),
            `${w} W accumulated into the wrong counter`);
    }
});

test('an absent reading moves neither counter', () => {
    // sNum() returns null when the state is missing or non-numeric; a stale plug makes the
    // producer skip the write entirely. Neither may be integrated as energy in some direction.
    for (const bad of [null, undefined, NaN]) {
        const r = runIntegrals(bad);
        assert.strictEqual(r.maxxicharge, 0, `${bad} moved the charge counter`);
        assert.strictEqual(r.maxxidischarge, 0, `${bad} moved the discharge counter`);
    }
});

test('the counters agree with the word shown on the flow row', () => {
    // If the row says "lädt", the charge counter must be the one accumulating. This is the
    // cross-check that was missing: the label and the kWh came from separate sign derivations.
    for (const w of [100, 730.1, -100, -730.1]) {
        const word = vc.vcMaxxiWord(w);
        const r = runIntegrals(w);
        if (word === 'lädt') {
            assert.ok(r.maxxicharge > 0 && r.maxxidischarge === 0,
                `row says "lädt" at ${w} W but the discharge counter moved`);
        } else {
            assert.ok(r.maxxidischarge > 0 && r.maxxicharge === 0,
                `row says "speist" at ${w} W but the charge counter moved`);
        }
    }
});
