// Unit tests for the shared outdoor-climate cluster — the hero's top-left corner (big outdoor
// temp + today's min/max, weather symbol + humidity/pressure, last-update caption). Übersicht and
// Klima both render it through vcClimCluster so the corner cannot drift apart again; before this,
// Klima carried its own copy that lost the weather column and the freshness greying.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const ctx = { console: { log() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
const MIN = 60 * 1000, H = 60 * MIN;
const P = ctx.VC_PAL;

function fresh(over) {
    return Object.assign({
        temp: 22.5, min: 7, max: 21, hum: 51, pres: 1036, wsym: 3,
        outdoorAgeMs: 13 * MIN, baseAgeMs: 5 * MIN, forecastAgeMs: 10 * MIN
    }, over || {});
}
// colour of the element whose class list starts with `cls` (first style colour after it)
function colourAfter(html, marker) {
    const i = html.indexOf(marker);
    assert.ok(i >= 0, 'marker not found: ' + marker);
    const m = html.slice(i).match(/color:(#[0-9A-Fa-f]{6})/);
    return m && m[1];
}

// ---- comfort bands (outside temperature colour) ----
test('comfort: 15 °C sits in the comfortable band', () => {
    assert.equal(ctx.vcComfortSem(15), 'good');
});
test('comfort: band edges — ≤3 muted, <12 cold, <20 good, <27 warn, else alarm', () => {
    assert.equal(ctx.vcComfortSem(3), 'muted');
    assert.equal(ctx.vcComfortSem(3.1), 'cold');
    assert.equal(ctx.vcComfortSem(12), 'good');
    assert.equal(ctx.vcComfortSem(20), 'warn');
    assert.equal(ctx.vcComfortSem(27), 'alarm');
});
test('comfort: missing temperature is muted, never a verdict', () => {
    assert.equal(ctx.vcComfortSem(null), 'muted');
    assert.equal(ctx.vcComfortSem(undefined), 'muted');
});

// ---- age caption ----
test('ago: seconds, minutes, hours', () => {
    assert.equal(ctx.vcAgo(40 * 1000), '40 s');
    assert.equal(ctx.vcAgo(13 * MIN), '13 min');
    assert.equal(ctx.vcAgo(7 * H), '7 h');
});
test('ago: unknown age gives null, future timestamps clamp to 0 s', () => {
    assert.equal(ctx.vcAgo(null), null);
    assert.equal(ctx.vcAgo(NaN), null);
    assert.equal(ctx.vcAgo(-5000), '0 s');
});

// ---- the cluster markup ----
test('cluster: fresh data shows every reading, comfort-coloured temp and a muted caption', () => {
    const h = ctx.vcClimCluster(P, fresh());
    assert.match(h, /class="h-clim"/);
    assert.match(h, /22,5/);
    assert.match(h, />7<.*>min</s);
    assert.match(h, />21<.*>max</s);
    assert.match(h, />51<\/b>/);
    assert.match(h, />1036<\/b>/);
    assert.match(h, /galeria1\/3\.png/);
    assert.equal(colourAfter(h, 'otemp'), P.warn);          // 22,5 °C → warm band
    assert.equal(colourAfter(h, 'h-age'), P.muted);
    assert.match(h, /vor 13 min</);
    assert.doesNotMatch(h, /Prognose/);
});
test('cluster: outdoor module silent > 6 h → temp and humidity grey, caption red', () => {
    const h = ctx.vcClimCluster(P, fresh({ outdoorAgeMs: 7 * H }));
    assert.equal(colourAfter(h, 'otemp'), P.muted);
    assert.equal(colourAfter(h, 'h-age'), P.alarm);
    assert.match(h, /vor 7 h/);
});
test('cluster: forecast frozen > 6 h → min/max grey, symbol dimmed, caption names the forecast age', () => {
    const h = ctx.vcClimCluster(P, fresh({ forecastAgeMs: 8 * H }));
    assert.equal(colourAfter(h, '<div class="mm">'), P.muted);
    assert.match(h, /h-wxcol dead/);
    assert.match(h, /Prognose vor 8 h/);
    assert.equal(colourAfter(h, 'h-age'), P.alarm);
});
test('cluster: stale but not dead (2 h) keeps colours, only the caption turns red', () => {
    const h = ctx.vcClimCluster(P, fresh({ outdoorAgeMs: 2 * H }));
    assert.equal(colourAfter(h, 'otemp'), P.warn);
    assert.equal(colourAfter(h, 'h-age'), P.alarm);
});
test('cluster: all readings missing → dashes, weather slot kept, no crash', () => {
    const h = ctx.vcClimCluster(P, {});
    assert.match(h, /class="h-wx"><\/div>/);
    assert.ok((h.match(/–/g) || []).length >= 5, 'expected dashes for temp, min, max, hum, pres');
    assert.equal(colourAfter(h, 'otemp'), P.muted);
});
test('cluster: out-of-range weather symbol leaves an empty slot, never a broken image', () => {
    assert.doesNotMatch(ctx.vcClimCluster(P, fresh({ wsym: 0 })), /<img/);
    assert.doesNotMatch(ctx.vcClimCluster(P, fresh({ wsym: 23 })), /<img/);
});

// ---- reading the states ----
test('read: pulls outdoor, base station and forecast states into one snapshot', () => {
    const now = Date.parse('2026-09-26T12:00:00Z');
    const S = {};
    S[ctx.VC_CLIM.outdoor + '.Temperature.Temperature'] = { val: 18.2 };
    S[ctx.VC_CLIM.outdoor + '.Humidity.Humidity'] = { val: 60 };
    S[ctx.VC_CLIM.outdoor + '.LastUpdate'] = { val: '2026-09-26T11:50:00Z' };
    S[ctx.VC_CLIM.base + '.Pressure.Pressure'] = { val: 1012 };
    S[ctx.VC_CLIM.base + '.LastUpdate'] = { val: '2026-09-26T11:55:00Z' };
    S[ctx.VC_CLIM.fcMin] = { val: 9, ts: now - 20 * MIN };
    S[ctx.VC_CLIM.fcMax] = { val: 19 };
    S[ctx.VC_CLIM.wsym] = { val: 4 };
    const d = ctx.vcClimRead(function (id) { return S[id] || null; }, now);
    assert.equal(d.temp, 18.2); assert.equal(d.hum, 60); assert.equal(d.pres, 1012);
    assert.equal(d.min, 9); assert.equal(d.max, 19); assert.equal(d.wsym, 4);
    assert.equal(d.outdoorAgeMs, 10 * MIN); assert.equal(d.baseAgeMs, 5 * MIN); assert.equal(d.forecastAgeMs, 20 * MIN);
});
test('read: absent states give nulls and unknown ages (→ dead), never throw', () => {
    const d = ctx.vcClimRead(function () { return null; }, Date.now());
    assert.equal(d.temp, null); assert.equal(d.min, null); assert.equal(d.wsym, null);
    assert.equal(d.outdoorAgeMs, null); assert.equal(d.forecastAgeMs, null);
    assert.equal(ctx.vcFreshness(d.outdoorAgeMs), 'dead');
});
test('read: non-numeric values and an unparsable LastUpdate are treated as missing', () => {
    const d = ctx.vcClimRead(function (id) {
        return id.endsWith('LastUpdate') ? { val: 'gestern' } : { val: 'n/a' };
    }, Date.now());
    assert.equal(d.temp, null); assert.equal(d.pres, null);
    assert.equal(d.outdoorAgeMs, null); assert.equal(d.baseAgeMs, null);
});
test('triggers: every state the cluster reads is in the re-render trigger list', () => {
    const ids = ctx.VC_CLIM.triggers;
    [ctx.VC_CLIM.outdoor + '.Temperature.Temperature', ctx.VC_CLIM.outdoor + '.Humidity.Humidity',
     ctx.VC_CLIM.base + '.Pressure.Pressure', ctx.VC_CLIM.fcMin, ctx.VC_CLIM.fcMax, ctx.VC_CLIM.wsym]
        .forEach(function (id) { assert.ok(ids.indexOf(id) >= 0, 'missing trigger ' + id); });
});

// ---- both tabs reference the one component (the regression the user hit) ----
['main_v2.js', 'klima_v2.js'].forEach(function (f) {
    test(f + ': hero renders the shared cluster and its shared CSS, no local copy', () => {
        const src = fs.readFileSync(path.join(IOB, f), 'utf8');
        assert.match(src, /vcClimCluster\(/);
        assert.match(src, /VC_CLIM_CSS/);
        assert.doesNotMatch(src, /class="h-clim"|class="h-tempcol"|\.h-tempcol\{/);
    });
});
