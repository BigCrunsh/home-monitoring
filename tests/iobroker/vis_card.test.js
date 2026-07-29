// Unit tests for the shared vis_card.js helpers (ioBroker GLOBAL script).
//
// Why the Maxxisun helpers are pinned here: `javascript.0.power_maxxisun` is a SIGNED reading
// whose meaning is defined exactly once, by the producer solaredge_power.js:84 —
//     desc: 'Maxxisun AC-Leistung (negativ = Einspeisung, positiv = Laden)'
// so NEGATIVE = the battery delivers into the house ("speist"), POSITIVE = it charges ("lädt").
// energy_tab_v2.js re-derived that mapping at four separate call sites and got the sign
// backwards, so the Energie tab rendered "Maxxisun · liefert" while the battery was charging at
// +730 W, and the two daily kWh counters integrated into each other. vis_card.js now owns the
// mapping; these tests fail if the convention is ever flipped again.
//
// Loading: vis_card.js is a plain global script — pure helpers, no top-level ioBroker calls
// (no createState/on/schedule/require), and no module.exports. It is therefore evaluated in a
// fresh vm context, where top-level `function` and `var` declarations become properties of the
// context object. That keeps the production file free of test-only scaffolding.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const VIS_CARD = path.resolve(__dirname, '..', '..', 'integrations', 'iobroker', 'vis_card.js');

function loadVisCard() {
    const ctx = { console };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(VIS_CARD, 'utf8'), ctx, { filename: VIS_CARD });
    return ctx;
}

const vc = loadVisCard();

// vcMaxxiSplit builds its result inside the vm context, so the object carries THAT realm's
// Object.prototype and assert.deepStrictEqual — which compares prototypes — would reject it even
// when every value matches. Copy into this realm so the assertions stay strict and readable.
function split(w) {
    const s = vc.vcMaxxiSplit(w);
    return { charge: s.charge, discharge: s.discharge };
}

// ===== vcMaxxiWord — the rendered status word =====

test('vcMaxxiWord: positive power means the battery is charging → "lädt"', () => {
    // +730 W is the real reading observed while the dashboard wrongly said "liefert".
    assert.strictEqual(vc.vcMaxxiWord(730.1), 'lädt');
});

test('vcMaxxiWord: negative power means the battery is delivering → "speist"', () => {
    assert.strictEqual(vc.vcMaxxiWord(-730.1), 'speist');
});

// --- the exact defect, asserted head-on ---

test('vcMaxxiWord: charging must NEVER read as delivering (the regression that shipped)', () => {
    for (const w of [75, 100, 546.5, 730.1, 2000]) {
        const word = vc.vcMaxxiWord(w);
        assert.strictEqual(word, 'lädt', `${w} W is charging, got "${word}"`);
        assert.notStrictEqual(word, 'speist');
        assert.notStrictEqual(word, 'liefert');   // the pre-fix vocabulary, also wrong here
    }
});

test('vcMaxxiWord: delivering must NEVER read as charging', () => {
    for (const w of [-75, -100, -546.5, -730.1, -2000]) {
        const word = vc.vcMaxxiWord(w);
        assert.strictEqual(word, 'speist', `${w} W is delivering, got "${word}"`);
        assert.notStrictEqual(word, 'lädt');
    }
});

// --- deadband: negligible flow gets no word at all, so the row reads plain "Maxxisun" ---

test('vcMaxxiWord: zero flow yields no word', () => {
    assert.strictEqual(vc.vcMaxxiWord(0), '');
});

test('vcMaxxiWord: below the VC.roleGoodMin band yields no word in either direction', () => {
    assert.strictEqual(vc.vcMaxxiWord(74), '');
    assert.strictEqual(vc.vcMaxxiWord(-74), '');
    assert.strictEqual(vc.vcMaxxiWord(0.4), '');
    assert.strictEqual(vc.vcMaxxiWord(-0.4), '');
});

test('vcMaxxiWord: the band edge itself is inclusive and uses the shared threshold', () => {
    assert.strictEqual(vc.VC.roleGoodMin, 75, 'the deadband must stay tied to the shared constant');
    assert.strictEqual(vc.vcMaxxiWord(vc.VC.roleGoodMin), 'lädt');
    assert.strictEqual(vc.vcMaxxiWord(-vc.VC.roleGoodMin), 'speist');
});

// --- missing / malformed readings: sNum() returns null when the state is absent or non-numeric,
//     and a stale plug makes the producer skip the write entirely. Never invent a verdict. ---

test('vcMaxxiWord: absent or non-numeric readings yield no word, never a false verdict', () => {
    for (const bad of [null, undefined, NaN, Infinity, -Infinity, '730', '', {}, [], true, false]) {
        assert.strictEqual(vc.vcMaxxiWord(bad), '', `${JSON.stringify(bad)} must not produce a word`);
    }
});

test('vcMaxxiWord: no argument at all yields no word', () => {
    assert.strictEqual(vc.vcMaxxiWord(), '');
});

// ===== vcMaxxiSplit — the two non-negative daily-integrator contributions =====

test('vcMaxxiSplit: positive power feeds charge, negative feeds discharge', () => {
    assert.deepStrictEqual(split(730.1), { charge: 730.1, discharge: 0 });
    assert.deepStrictEqual(split(-730.1), { charge: 0, discharge: 730.1 });
});

test('vcMaxxiSplit: the counters must never cross-feed (the swapped-kWh regression)', () => {
    // Observed live: while power was +730 W, energy_today_maxxidischarge was the counter
    // that grew. Exactly one side may be non-zero, and it must be the matching one.
    for (const w of [1, 75, 546.5, 730.1, 5000]) {
        const s = vc.vcMaxxiSplit(w);
        assert.ok(s.charge > 0 && s.discharge === 0, `+${w} W must integrate as charge only`);
        const t = vc.vcMaxxiSplit(-w);
        assert.ok(t.discharge > 0 && t.charge === 0, `-${w} W must integrate as discharge only`);
    }
});

test('vcMaxxiSplit: both contributions are non-negative so the integral cannot run backwards', () => {
    for (const w of [0, 1, -1, 730.1, -730.1, 1e6, -1e6]) {
        const s = vc.vcMaxxiSplit(w);
        assert.ok(s.charge >= 0 && s.discharge >= 0, `${w} W produced a negative contribution`);
    }
});

test('vcMaxxiSplit: zero and malformed readings contribute nothing to either counter', () => {
    const zero = { charge: 0, discharge: 0 };
    for (const bad of [0, null, undefined, NaN, Infinity, -Infinity, '730', {}, []]) {
        assert.deepStrictEqual(split(bad), zero,
            `${JSON.stringify(bad)} must not move either counter`);
    }
});

test('vcMaxxiSplit: unlike the word, it has no deadband — small flows still accumulate', () => {
    // The 75 W band only suppresses a *label*; energy accounting must integrate everything,
    // otherwise the day's kWh silently under-reports trickle charging.
    assert.deepStrictEqual(split(10), { charge: 10, discharge: 0 });
    assert.deepStrictEqual(split(-10), { charge: 0, discharge: 10 });
});

// ===== the word and the split must agree on which direction is which =====

test('vcMaxxiWord and vcMaxxiSplit agree on the sign convention', () => {
    for (const w of [100, 546.5, 730.1, -100, -546.5, -730.1]) {
        const word = vc.vcMaxxiWord(w);
        const s = vc.vcMaxxiSplit(w);
        if (word === 'lädt') {
            assert.ok(s.charge > 0 && s.discharge === 0,
                `"lädt" at ${w} W must correspond to a charge contribution`);
        } else {
            assert.ok(s.discharge > 0 && s.charge === 0,
                `"speist" at ${w} W must correspond to a discharge contribution`);
        }
    }
});
