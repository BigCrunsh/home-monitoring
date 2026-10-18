// suncalc_phases.js: moon/sun strings for the hero. suncalc omits rise/set on the few days a month the
// moon never crosses the horizon; that used to throw and leave yesterday's moonrise/moonset in place.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPT = path.join(__dirname, '..', '..', 'integrations', 'iobroker', 'suncalc_phases.js');
// winter dates: Berlin is UTC+1
const SUNRISE = new Date('2026-12-01T06:30:00Z'), SUNSET = new Date('2026-12-01T15:05:00Z');
const MOONRISE = new Date('2026-12-01T09:15:00Z'), MOONSET = new Date('2026-12-01T18:40:00Z');

function run(moonTimes) {
    const written = {};
    let illuminationCalls = 0;
    const suncalc = {
        getTimes: () => ({ sunrise: SUNRISE, sunset: SUNSET }),
        getMoonTimes: () => moonTimes,
        getMoonIllumination: () => { illuminationCalls++; return { phase: 0.5 }; }
    };
    const ctx = {
        console: { log() {} },
        require: (name) => { assert.equal(name, 'suncalc'); return suncalc; },
        createState() {},
        schedule() {},
        setState: (id, val) => { written[id] = val; }
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), ctx);
    return { written, illuminationCalls };
}

function assertSunAndPhaseWritten(written) {
    assert.equal(written.sunrise, '07:30');
    assert.equal(written.sunset, '16:05');
    assert.equal(written.moon_phase, 4);
}

test('normal day writes sun, moon times and phase', () => {
    const { written } = run({ rise: MOONRISE, set: MOONSET });
    assertSunAndPhaseWritten(written);
    assert.equal(written.moonrise, '10:15');
    assert.equal(written.moonset, '19:40');
});

test('no moonrise: dash for moonrise, everything else still written', () => {
    const { written } = run({ set: MOONSET });
    assertSunAndPhaseWritten(written);
    assert.equal(written.moonrise, '–');
    assert.equal(written.moonset, '19:40');
});

test('no moonset: dash for moonset, everything else still written', () => {
    const { written } = run({ rise: MOONRISE });
    assertSunAndPhaseWritten(written);
    assert.equal(written.moonrise, '10:15');
    assert.equal(written.moonset, '–');
});

test('moon always up: dashes for both, everything else still written', () => {
    const { written } = run({ alwaysUp: true });
    assertSunAndPhaseWritten(written);
    assert.equal(written.moonrise, '–');
    assert.equal(written.moonset, '–');
});

test('moon always down: dashes for both, everything else still written', () => {
    const { written } = run({ alwaysDown: true });
    assertSunAndPhaseWritten(written);
    assert.equal(written.moonrise, '–');
    assert.equal(written.moonset, '–');
});

test('queries the moon illumination exactly once per run', () => {
    assert.equal(run({ rise: MOONRISE, set: MOONSET }).illuminationCalls, 1);
});
