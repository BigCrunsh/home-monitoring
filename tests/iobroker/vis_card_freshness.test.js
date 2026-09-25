// Unit tests for vcFreshness — the one rule for "how old may a reading be before the dashboard
// stops presenting it as current". Netatmo and DasWetter both need the internet: during an outage
// their values freeze, and a frozen value in fresh comfort colours is a false statement.
// Rule (room tiles, now also the hero's outdoor + forecast): ≤ 60 min fresh, > 60 min stale
// (last-update caption turns red), > 6 h or unknown age dead (values greyed).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { console: { log() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'integrations', 'iobroker', 'vis_card.js'), 'utf8'), ctx);
const MIN = 60 * 1000, H = 60 * MIN;

test('freshness: a reading from a few minutes ago is fresh', () => {
    assert.equal(ctx.vcFreshness(7 * MIN), 'fresh');
});
test('freshness: exactly 60 min is still fresh, just over is stale', () => {
    assert.equal(ctx.vcFreshness(H), 'fresh');
    assert.equal(ctx.vcFreshness(H + 1), 'stale');
});
test('freshness: exactly 6 h is stale, just over is dead', () => {
    assert.equal(ctx.vcFreshness(6 * H), 'stale');
    assert.equal(ctx.vcFreshness(6 * H + 1), 'dead');
});
test('freshness: unknown age (missing / unparsable timestamp) is dead, never fresh', () => {
    assert.equal(ctx.vcFreshness(null), 'dead');
    assert.equal(ctx.vcFreshness(undefined), 'dead');
    assert.equal(ctx.vcFreshness(NaN), 'dead');
});
test('freshness: a timestamp slightly in the future (clock skew) counts as fresh', () => {
    assert.equal(ctx.vcFreshness(-30 * 1000), 'fresh');
});
test('freshness: thresholds are the named VC constants', () => {
    assert.equal(ctx.VC.staleAfterMs, H);
    assert.equal(ctx.VC.deadAfterMs, 6 * H);
});
