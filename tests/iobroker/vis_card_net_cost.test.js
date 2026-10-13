// The net €/h figure on the Übersicht energy card and the Energie tab's "Netto" stat is read as a
// COST: buying from the grid (which the owner pays for) must show "+", feeding in (income) "−".
// The earlier wallet-style convention ("−" when paying) confused the owner. vis_card.js owns the
// sign so both cards agree; these tests fail if either card re-derives it or the rule flips back.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOBROKER = path.resolve(__dirname, '..', '..', 'integrations', 'iobroker');

function loadVisCard() {
    const ctx = { console };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOBROKER, 'vis_card.js'), 'utf8'), ctx);
    return ctx;
}
const vc = loadVisCard();

test('vcNetCostSign: importing from the grid is a cost → "+"', () => {
    assert.strictEqual(vc.vcNetCostSign(0.32), '+');
});

test('vcNetCostSign: feeding in is income → "−" (minus sign, not hyphen)', () => {
    assert.strictEqual(vc.vcNetCostSign(-0.05), '−');
});

test('vcNetCostSign: amounts that round to 0,00 €/h carry no sign', () => {
    assert.strictEqual(vc.vcNetCostSign(0.004), '');
    assert.strictEqual(vc.vcNetCostSign(-0.004), '');
    assert.strictEqual(vc.vcNetCostSign(0), '');
});

for (const file of ['main_v2.js', 'energy_tab_v2.js']) {
    test(`${file} takes the net €/h sign from vcNetCostSign instead of re-deriving it`, () => {
        const src = fs.readFileSync(path.join(IOBROKER, file), 'utf8');
        assert.match(src, /netSign = vcNetCostSign\(net\)/);
        assert.doesNotMatch(src, /net < 0 \? '\+' : '−'/);
    });
}
