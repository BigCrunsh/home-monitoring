// Music light stage 3 (openspec add-music-ambient-light, tasks 3.2-3.3): while a zone's music scene runs,
// its colour lamps drift through the colours of the album cover. The palette holds up to five colours,
// each with its share of the cover (near-black, white and grey areas such as background and text do not
// count, washed-out colours get more saturation); each colour is held in proportion to its share (owner
// idea, 2026-11-21), and the zone's lamps run offset so the room shows several cover colours at once.
// Without a usable cover the warm scene stays.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const ZONES_CFG = 'javascript.0.music_light_zones', MUSIC = 'javascript.0.music_zones';
const L1 = 'hue.0.Lamp_1', L2 = 'hue.0.Lamp_2', L3 = 'hue.0.Lamp_3';
const CONFIG = JSON.stringify([{ key: 'eg', label: 'EG', rooms: ['Wohnzimmer'], lamps: [L1, L2, L3] }]);
const RED = [230, 20, 20], BLUE = [20, 40, 230], GREY = [128, 128, 128], BLACK = [5, 5, 5], WHITE = [250, 250, 250];

// an RGBA image of width × 1 made of colour runs: [[rgb, count], ...]
function image(runs) {
    const px = [];
    runs.forEach(([rgb, n]) => { for (let i = 0; i < n; i++) px.push(rgb[0], rgb[1], rgb[2], 255); });
    return { width: px.length / 4, height: 1, data: Uint8Array.from(px) };
}
const covers = {
    'https://img/redblue.jpg': image([[RED, 300], [BLUE, 100]]),
    'https://img/blue.jpg': image([[BLUE, 400]]),
    'https://img/grey.jpg': image([[GREY, 200], [BLACK, 100], [WHITE, 100]])
};

function load(states) {
    const st = Object.assign({ [ZONES_CFG]: CONFIG }, states);
    [L1, L2, L3].forEach((l) => Object.assign(st, { [l + '.reachable']: true, [l + '.on']: false, [l + '.bri']: 0 }));
    const handlers = [], commands = [], ticks = [], fetched = [];
    const net = {
        get: (url, opts, cb) => {
            fetched.push(url);
            const listeners = {};
            const res = { statusCode: covers[url] ? 200 : 404, on: (ev, fn) => { listeners[ev] = fn; return res; }, resume() {} };
            cb(res);
            if (covers[url]) listeners.data && listeners.data(Buffer.from(url));
            listeners.end && listeners.end();
            return { on() { return this; }, destroy() {} };
        }
    };
    const jpeg = { decode: (buf) => covers[buf.toString()] };
    const ctx = {
        console: { log() {}, warn() {} },
        getState: (id) => (id in st ? { val: st[id] } : null),
        existsState: (id) => id in st,
        setState: (id, val) => { if (/\.command$/.test(id)) commands.push([id.replace(/\.command$/, ''), JSON.parse(val)]); st[id] = val; },
        createState: (id, def) => { if (!(id in st)) st[id] = def; },
        on: (opts, fn) => handlers.push({ opts, fn }),
        setInterval: (fn) => ticks.push(fn),
        Buffer,
        require: (m) => (m === 'jpeg-js' ? jpeg : net)
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'music_light.js'), 'utf8'), ctx);
    ctx.change = (id, val) => { st[id] = val; handlers.filter((h) => h.opts.id === id).forEach((h) => h.fn({ id, state: { val } })); };
    ctx.tick = (n) => { for (let i = 0; i < (n || 1); i++) ticks.forEach((fn) => fn()); };
    Object.assign(ctx, { commands, fetched, st });
    return ctx;
}
const playing = (art) => JSON.stringify({ eg: { playing: true, art } });
const xyOf = (cmds) => cmds.filter(([, c]) => c.xy).map(([id, c]) => [id, c.xy]);

test('palette: each colour of the cover with its share, largest first', () => {
    const p = load({}).coverPalette(covers['https://img/redblue.jpg']);
    assert.equal(p.length, 2);
    assert.ok(Math.abs(p[0].share - 0.75) < 0.02 && Math.abs(p[1].share - 0.25) < 0.02);
    assert.ok(p[0].rgb[0] > p[0].rgb[2], 'the larger colour is the red one');
});

test('palette: near-black, white and grey areas do not count', () => {
    const p = load({}).coverPalette(image([[RED, 100], [BLACK, 100], [WHITE, 100], [GREY, 100]]));
    assert.equal(p.length, 1);
    assert.ok(Math.abs(p[0].share - 1) < 0.01);
});

test('palette: a cover without any colour gives no palette', () => {
    assert.deepEqual(Array.from(load({}).coverPalette(covers['https://img/grey.jpg'])), []);
});

test('colour: pure red becomes the Hue colour point of red', () => {
    const [x, y] = load({}).rgbToXy([255, 0, 0]).split(',').map(Number);
    assert.ok(Math.abs(x - 0.7006) < 0.002 && Math.abs(y - 0.2993) < 0.002);
});

test('weighting: a colour covering three quarters takes three quarters of the cycle', () => {
    const ctx = load({});
    const seq = ctx.weightedCycle([{ xy: 'r', share: 0.75 }, { xy: 'b', share: 0.25 }], 8);
    assert.equal(seq.filter((c) => c === 'r').length, 6);
    assert.equal(seq.filter((c) => c === 'b').length, 2);
});

test('weighting: a tiny share still gets one slot', () => {
    const seq = load({}).weightedCycle([{ xy: 'r', share: 0.97 }, { xy: 'b', share: 0.03 }], 8);
    assert.ok(seq.includes('b'));
});

test('cycling: the lamps take the cover colours, offset from each other', () => {
    const ctx = load({});
    ctx.change(MUSIC, playing('https://img/redblue.jpg'));
    ctx.commands.length = 0;
    ctx.tick(1);
    const xy = xyOf(ctx.commands);
    assert.ok(xy.length >= 2, 'at least two lamps changed colour');
    assert.ok(new Set(xy.map(([, c]) => c)).size === 2, 'red and blue are both in the room');
    ctx.commands.filter(([, c]) => c.xy).forEach(([, c]) => assert.ok(c.transitiontime >= 50, 'slow drift'));
});

test('cycling: a lamp whose colour stays the same gets no new command', () => {
    const ctx = load({});
    ctx.change(MUSIC, playing('https://img/blue.jpg'));
    ctx.tick(1);
    ctx.commands.length = 0;
    ctx.tick(3);
    assert.deepEqual(xyOf(ctx.commands), []);
});

test('cycling: a missing cover keeps the warm scene, no colours', () => {
    const ctx = load({});
    ctx.change(MUSIC, playing('https://img/missing.jpg'));
    ctx.tick(3);
    assert.deepEqual(xyOf(ctx.commands), []);
});

test('cycling: a cover without colour keeps the warm scene', () => {
    const ctx = load({});
    ctx.change(MUSIC, playing('https://img/grey.jpg'));
    ctx.tick(3);
    assert.deepEqual(xyOf(ctx.commands), []);
});

test('cycling: a new track with a new cover switches to its colours', () => {
    const ctx = load({});
    ctx.change(MUSIC, playing('https://img/redblue.jpg'));
    ctx.tick(1);
    ctx.change(MUSIC, playing('https://img/blue.jpg'));
    ctx.commands.length = 0;
    ctx.tick(1);
    const blue = ctx.rgbToXy(ctx.coverPalette(covers['https://img/blue.jpg'])[0].rgb);
    assert.ok(xyOf(ctx.commands).every(([, c]) => c === blue));
});

test('cycling: the same cover is downloaded only once', () => {
    const ctx = load({});
    ctx.change(MUSIC, playing('https://img/redblue.jpg'));
    ctx.change(MUSIC, JSON.stringify({ eg: { playing: true, art: 'https://img/redblue.jpg', title: 'next' } }));
    assert.equal(ctx.fetched.filter((u) => u === 'https://img/redblue.jpg').length, 1);
});

test('cycling: after the music stops no colour commands follow', () => {
    const ctx = load({});
    ctx.change(MUSIC, playing('https://img/redblue.jpg'));
    ctx.tick(1);
    ctx.change(MUSIC, JSON.stringify({ eg: { playing: false } }));
    ctx.commands.length = 0;
    ctx.tick(3);
    assert.deepEqual(ctx.commands, []);
});
