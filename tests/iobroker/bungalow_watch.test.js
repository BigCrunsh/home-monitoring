// Dead man's switch for the Bungalow Lübkowsee (bungalow_watch.js). The bungalow cannot report its
// own outage, so the home Pi watches for silence: the bungalow's Netatmo base station stops updating
// → bungalow internet/power is out. The home station is the control: if it is silent too, the
// problem is the Netatmo cloud/adapter/home internet and the watcher is blind, not the bungalow down.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const MIN = 60 * 1000, H = 60 * MIN;
const T0 = Date.parse('2026-10-05T12:00:00Z');
const plain = (o) => JSON.parse(JSON.stringify(o));

function load(states) {
    const sent = [], written = {};
    const st = states || {};
    const ctx = {
        console: { log() {} },
        getState: (id) => (id in st ? { val: st[id] } : null),
        existsState: (id) => id in st,
        setState: (id, val) => { written[id] = val; st[id] = val; },
        createState: (id, def, common, cb) => { if (!(id in st)) st[id] = def; if (cb) cb(); },
        sendTo: (inst, cmd, msg) => sent.push({ inst, cmd, text: msg.text }),
        on() {}, schedule() {}, setTimeout() {}, log() {}
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'bungalow_watch.js'), 'utf8'), ctx);
    ctx.sent = sent; ctx.written = written; ctx.st = st;
    return ctx;
}
const fresh = { bungalowBase: 12, bungalowOutdoor: 12, homeBase: 8 };
// run `n` checks 5 min apart starting at T0 + offset, feeding the same ages; returns messages sent
function run(ctx, state, ages, n, start) {
    const msgs = [];
    let s = state;
    for (let i = 0; i < n; i++) {
        const r = ctx.step(s, ctx.observe(ages), (start || T0) + i * 5 * MIN);
        s = r.state; msgs.push(...r.messages);
    }
    return { state: s, msgs };
}

// ---- observe: which situation do the station ages describe ----
test('observe: every station reporting recently is all clear', () => {
    assert.deepEqual(plain(load().observe(fresh)), { blind: false, offline: false, outdoor: false });
});
test('observe: bungalow base silent while home reports → bungalow offline', () => {
    assert.deepEqual(plain(load().observe({ ...fresh, bungalowBase: 95 })), { blind: false, offline: true, outdoor: false });
});
test('observe: home station silent too → watcher blind, no bungalow verdict', () => {
    assert.deepEqual(plain(load().observe({ bungalowBase: 95, bungalowOutdoor: 95, homeBase: 95 })), { blind: true, offline: false, outdoor: false });
});
test('observe: unknown bungalow age (state missing/unparsable) counts as silent', () => {
    assert.equal(load().observe({ ...fresh, bungalowBase: null }).offline, true);
});
test('observe: only the outdoor module silent → outdoor warning, bungalow still online', () => {
    assert.deepEqual(plain(load().observe({ ...fresh, bungalowOutdoor: 95 })), { blind: false, offline: false, outdoor: true });
});

// ---- step: debounce, one alert per incident, reminders, recovery ----
test('incident: bungalow offline alerts exactly once, on the third consecutive silent check', () => {
    const ctx = load();
    const { msgs } = run(ctx, ctx.initialState(), { ...fresh, bungalowBase: 50 }, 5);
    assert.equal(msgs.length, 1);
    assert.match(msgs[0], /Bungalow.*offline/);
    assert.match(msgs[0], /Internet oder Strom/);
});
test('incident: two silent checks then data again is a blip — no message at all', () => {
    const ctx = load();
    const a = run(ctx, ctx.initialState(), { ...fresh, bungalowBase: 50 }, 2);
    const b = run(ctx, a.state, fresh, 3, T0 + 10 * MIN);
    assert.deepEqual(a.msgs.concat(b.msgs), []);
});
test('incident: still offline after the reminder interval → one reminder, not one per check', () => {
    const ctx = load();
    const { msgs } = run(ctx, ctx.initialState(), { ...fresh, bungalowBase: 50 }, 12 * 12 + 4);
    assert.equal(msgs.length, 2);
    assert.match(msgs[1], /weiterhin offline/);
});
test('incident: recovery after an alert reports the outage duration once', () => {
    const ctx = load();
    const a = run(ctx, ctx.initialState(), { ...fresh, bungalowBase: 50 }, 24);   // 2 h of checks
    const b = run(ctx, a.state, fresh, 3, T0 + 24 * 5 * MIN);
    assert.equal(b.msgs.length, 1);
    assert.match(b.msgs[0], /wieder online/);
    assert.match(b.msgs[0], /2 h/);
});
test('incident: while blind, an ongoing bungalow outage is neither recovered nor re-alerted', () => {
    const ctx = load();
    const a = run(ctx, ctx.initialState(), { ...fresh, bungalowBase: 50 }, 3);
    const b = run(ctx, a.state, { bungalowBase: 50, bungalowOutdoor: 50, homeBase: 50 }, 6, T0 + 15 * MIN);
    assert.ok(b.msgs.every((m) => !/Bungalow wieder online/.test(m)));
    assert.equal(b.state.offline.active, true);
});
test('incident: watcher blind alerts once and announces when monitoring works again', () => {
    const ctx = load();
    const a = run(ctx, ctx.initialState(), { bungalowBase: 50, bungalowOutdoor: 50, homeBase: 50 }, 4);
    const b = run(ctx, a.state, fresh, 1, T0 + 20 * MIN);
    assert.equal(a.msgs.length, 1);
    assert.match(a.msgs[0], /blind/);
    assert.match(b.msgs[0], /wieder aktiv/);
});

// ---- the scheduled check against real state ids ----
function netatmo(ctx, ages, now) {
    const s = {};
    s[ctx.BUNGALOW_BASE + '.LastUpdate'] = new Date(now - ages.bungalowBase * MIN).toString();
    s[ctx.BUNGALOW_OUTDOOR + '.LastUpdate'] = new Date(now - ages.bungalowOutdoor * MIN).toString();
    s[ctx.HOME_BASE + '.LastUpdate'] = new Date(now - ages.homeBase * MIN).toString();
    Object.assign(ctx.st, s);
}
test('check: reads the Netatmo states, publishes status and sends the alert through telegram', () => {
    const ctx = load();
    for (let i = 0; i < 3; i++) {
        const now = T0 + i * 5 * MIN;
        netatmo(ctx, { ...fresh, bungalowBase: 60 + 5 * i }, now);
        ctx.check(now);
    }
    assert.equal(ctx.sent.length, 1);
    assert.equal(ctx.sent[0].inst, 'telegram.0');
    assert.equal(ctx.written['0_userdata.0.bungalow.online'], false);
    assert.equal(ctx.written['0_userdata.0.bungalow.status'], 'offline');
    assert.ok(ctx.written['0_userdata.0.bungalow.outageSince']);
});
test('check: an ongoing incident survives a script restart without a second alert', () => {
    const first = load();
    for (let i = 0; i < 3; i++) { netatmo(first, { ...fresh, bungalowBase: 60 }, T0 + i * 5 * MIN); first.check(T0 + i * 5 * MIN); }
    const restarted = load(first.st);
    netatmo(restarted, { ...fresh, bungalowBase: 80 }, T0 + 20 * MIN);
    restarted.check(T0 + 20 * MIN);
    assert.equal(restarted.sent.length, 0);
});
test('check: a corrupt persisted state starts clean instead of crashing', () => {
    const ctx = load({ '0_userdata.0.bungalow.state': '{not json' });
    netatmo(ctx, fresh, T0);
    ctx.check(T0);
    assert.equal(ctx.written['0_userdata.0.bungalow.online'], true);
});
