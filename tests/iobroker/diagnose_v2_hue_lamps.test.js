// Hue lamps unreachable for a long time (owner, 2026-11-12). A lamp switched off at the wall is just as
// unreachable for the bridge as one that lost its pairing, so only duration tells them apart: the Büro
// lamp shone for ~140 days without any connection to the bridge (the Hue app still said "on") and no one
// noticed. After 30 days unreachable a lamp is a device issue: an amber "offline seit N Tg" row (the word the Steuerung tiles use)
// in the Geräte card and one Telegram message, "wieder ok" when it is back. Only light channels count —
// remotes and switches (ZLLSwitch) carry a reachable flag too, but are watched by battery.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const DAY = 86400000;
const RealDate = Date;
const BUERO = 'hue.0.Arbeitszimmerlicht';

// objects: {id: {name, role}}; states: {id: val}, stamped with ts = lc = load time.
// ctx.advance(ms) moves the script's clock forward, so a state set at load "changed" ms ago.
function loadDiagnose(objects, states) {
    let offset = 0;
    class FakeDate extends RealDate {
        constructor(...args) { if (args.length) super(...args); else super(RealDate.now() + offset); }
        static now() { return RealDate.now() + offset; }
    }
    const now = Date.now();
    const st = {};
    Object.keys(states).forEach((id) => { st[id] = { val: states[id], ts: now, lc: now }; });
    const sent = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => st[id] || null,
        existsState: (id) => id in st,
        getObject: (id) => (id in objects ? { common: { name: objects[id].name, role: objects[id].role } } : null),
        getEnums: () => [],
        $: (sel) => {
            const glob = sel.match(/id=([^\]]+)\]/)[1];
            const re = new RegExp('^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            return { each: (fn) => Object.keys(st).filter((id) => re.test(id)).forEach(fn) };
        },
        sendTo: (inst, cmd, msg) => sent.push({ inst, cmd, msg }),
        setState: (id, val) => { st[id] = { val, ts: RealDate.now() + offset, lc: RealDate.now() + offset }; },
        createState() {}, on() {}, schedule() {}, setTimeout() {},
        Date: FakeDate
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'diagnose_v2.js'), 'utf8'), ctx);
    ctx.sent = sent;
    ctx.st = st;
    ctx.advance = (ms) => { offset += ms; };
    return ctx;
}
const texts = (ctx) => ctx.sent.map((s) => s.msg.text);
const buero = () => loadDiagnose({ [BUERO]: { name: 'Arbeitszimmerlicht', role: 'light.color' } }, { [BUERO + '.reachable']: false });

test('hue lamps: a lamp unreachable for over a month shows an amber row and sends one message', () => {
    const ctx = buero();
    ctx.advance(31 * DAY);
    ctx.publish();
    ctx.publish();
    assert.match(card(ctx), /<span class="nm">Arbeitszimmerlicht<\/span><span class="ag" style="color:[^"]+">offline seit 31 Tg</);
    assert.deepEqual(texts(ctx), ['Diagnose: Arbeitszimmerlicht – offline seit 31 Tg']);
});

test('hue lamps: a lamp unreachable for less than a month (off at the wall) stays quiet', () => {
    const ctx = buero();
    ctx.advance(29 * DAY);
    ctx.publish();
    assert.doesNotMatch(card(ctx), /Arbeitszimmerlicht/);
    assert.equal(ctx.sent.length, 0);
});

test('hue lamps: a reachable lamp is fine however long ago it last changed', () => {
    const ctx = loadDiagnose({ [BUERO]: { name: 'Arbeitszimmerlicht', role: 'light.color' } }, { [BUERO + '.reachable']: true });
    ctx.advance(400 * DAY);
    ctx.publish();
    assert.doesNotMatch(card(ctx), /Arbeitszimmerlicht/);
    assert.equal(ctx.sent.length, 0);
});

test('hue lamps: a remote or switch with a reachable flag is not a lamp', () => {
    const ctx = loadDiagnose({ 'hue.0.Hue_dimmer_switch_1': { name: 'Hue dimmer switch 1', role: 'ZLLSwitch' } },
        { 'hue.0.Hue_dimmer_switch_1.reachable': false });
    ctx.advance(60 * DAY);
    ctx.publish();
    assert.doesNotMatch(card(ctx), /dimmer/);
    assert.equal(ctx.sent.length, 0);
});

test('hue lamps: a reachable flag without its lamp object is ignored', () => {
    const ctx = loadDiagnose({}, { [BUERO + '.reachable']: false });
    ctx.advance(60 * DAY);
    ctx.publish();
    assert.equal(ctx.sent.length, 0);
});

// ghost lamps left over in the hue adapter have a reachable object but no state; ioBroker logs a warning
// for every getState on a missing state, once a minute per ghost (2026-11-20)
test('hue lamps: a reachable object without a state is never read', () => {
    const ctx = loadDiagnose({ 'hue.0.Hue_white_lamp_1': { name: 'Hue white lamp 1', role: 'light.dimmer' } }, {});
    const read = [];
    const getState = ctx.getState;
    ctx.getState = (id) => { read.push(id); return getState(id); };
    ctx.$ = () => ({ each: (fn) => fn('hue.0.Hue_white_lamp_1.reachable') });
    ctx.publish();
    assert.deepEqual(read.filter((id) => id.startsWith('hue.0.')), []);
});

test('hue lamps: a lamp that is reachable again sends "wieder ok"', () => {
    const ctx = buero();
    ctx.advance(31 * DAY);
    ctx.publish();
    ctx.setState(BUERO + '.reachable', true);
    ctx.publish();
    assert.deepEqual(texts(ctx), ['Diagnose: Arbeitszimmerlicht – offline seit 31 Tg', 'Diagnose: Arbeitszimmerlicht – wieder ok']);
});

test('hue lamps: the summary asks to check a device', () => {
    const ctx = buero();
    ctx.advance(31 * DAY);
    ctx.publish();
    assert.match(ctx.buildSummary(ctx.refreshDevices()), /Gerät prüfen/);
});

// the Geräte card as publish renders it: devices found afresh, then drawn
function card(ctx) { return ctx.buildDevices(ctx.refreshDevices()); }
