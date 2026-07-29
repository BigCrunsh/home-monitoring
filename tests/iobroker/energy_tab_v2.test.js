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

// Pull one named function out of the script source by brace-matching, so it can be exercised in
// isolation without booting the whole ioBroker script. Robust to reformatting of the body.
function extractFunction(src, name) {
    const start = src.indexOf('function ' + name + '(');
    assert.notStrictEqual(start, -1, `function ${name} not found in energy_tab_v2.js`);
    const open = src.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
    throw new Error(`unbalanced braces while extracting ${name}`);
}

// ===== the tab must not re-derive the sign =====

test('the flow row and the lane endpoint both take their word from vcMaxxiWord', () => {
    const calls = SRC.match(/vcMaxxiWord\(/g) || [];
    assert.ok(calls.length >= 2,
        `expected both label sites to call vcMaxxiWord, found ${calls.length}`);
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

// ===== the lane's geometry must agree with its own axis chrome =====

test('the lane axis chrome uses exactly the words vcMaxxiWord can return', () => {
    assert.ok(SRC.includes('speist ↑'), 'the lane is missing the "speist ↑" axis label');
    assert.ok(SRC.includes('lädt ↓'), 'the lane is missing the "lädt ↓" axis label');
    // If the helper's vocabulary is ever changed, this fails and forces the chrome to follow.
    assert.strictEqual(vc.vcMaxxiWord(-1000), 'speist');
    assert.strictEqual(vc.vcMaxxiWord(1000), 'lädt');
});

test('syL plots delivering ABOVE and charging BELOW the zero line', () => {
    // The chrome promises "speist ↑ / lädt ↓". SVG y grows downward, so delivering (negative
    // power) must map to a SMALLER y than charging. Before the fix the mapping was mirrored,
    // so the lane contradicted the label printed right next to it.
    const ctx = { LY: 100, LH: 38, LMAX: 1, Math };
    vm.createContext(ctx);
    vm.runInContext(extractFunction(SRC, 'syL') + '; this.syL = syL;', ctx);

    const zero = ctx.syL(0);
    const delivering = ctx.syL(-500);
    const charging = ctx.syL(500);

    assert.ok(delivering < zero, `delivering must sit above the zero line (${delivering} < ${zero})`);
    assert.ok(charging > zero, `charging must sit below the zero line (${charging} > ${zero})`);
    assert.strictEqual(zero, 100 + 38 / 2, 'the zero line must stay centred in the lane');
});

test('syL stays inside the lane band even for readings past the axis maximum', () => {
    const ctx = { LY: 100, LH: 38, LMAX: 1, Math };
    vm.createContext(ctx);
    vm.runInContext(extractFunction(SRC, 'syL') + '; this.syL = syL;', ctx);

    const top = 100, bottom = 100 + 38;
    for (const w of [-1e6, -5000, -1000, 0, 1000, 5000, 1e6]) {
        const y = ctx.syL(w);
        assert.ok(y >= top && y <= bottom, `${w} W mapped to ${y}, outside the lane [${top},${bottom}]`);
    }
});
