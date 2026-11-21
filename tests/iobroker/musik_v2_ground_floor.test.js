// Music light, stage 1 (openspec add-music-ambient-light, tasks 1.1-1.2). musik_v2.js owns the Sonos
// poll, so it publishes whether the ground floor (Wohnzimmer, Küche, Fernsehzimmer) plays music, for
// music_light.js. The TV soundbar reports PLAYING for TV sound too (track URI x-sonos-htastream:), and
// the Hue Sync Box already lights the TV then, so TV sound, muted rooms and other floors do not count.
// The "Musiklicht" pill in the Musik band header switches the music light on and off (amber when on,
// the colour of a lit light tile; on by default).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const ENABLED = 'javascript.0.music_light_enabled';

function loadMusik(states) {
    const st = Object.assign({}, states);
    const handlers = [];
    const ctx = {
        console: { log() {} },
        getState: (id) => (id in st ? { val: st[id] } : null), existsState: (id) => id in st,
        setState: (id, val) => { st[id.indexOf('.') < 0 ? 'javascript.0.' + id : id] = val; },
        createState() {}, on: (opts, fn) => handlers.push({ opts, fn }), schedule() {}, setTimeout() {}, setInterval() {},
        require: () => ({ get: () => ({ on() { return this; } }) })
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'vis_card.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'musik_v2.js'), 'utf8'), ctx);
    ctx.st = st;
    ctx.cmd = (v) => handlers.find((h) => h.opts.id === 'javascript.0.musik_cmd').fn({ state: { val: v } });
    return ctx;
}
// one Sonos /zones group: the coordinator's state carries the track for every member
function group(rooms, state) {
    return { coordinator: { roomName: rooms[0], state }, members: rooms.map((r) => ({ roomName: r })) };
}
function track(over) {
    return Object.assign({
        playbackState: 'PLAYING', volume: 25, mute: false,
        currentTrack: { artist: 'Artist', title: 'Song', album: 'Album', uri: 'x-sonosapi-hls-static:track', absoluteAlbumArtUri: 'http://cover/1.jpg' },
        nextTrack: { absoluteAlbumArtUri: 'http://cover/2.jpg' }
    }, over);
}
const music = (ctx, groups) => { ctx.ZONES = ctx.zonesFromSonos(groups); return ctx.groundFloorMusic(); };

test('ground floor: music in the kitchen counts, with what plays and the next cover', () => {
    const m = music(loadMusik({}), [group(['Küche'], track())]);
    assert.equal(m.playing, true);
    assert.equal(m.artist, 'Artist');
    assert.equal(m.title, 'Song');
    assert.equal(m.album, 'Album');
    assert.equal(m.art, 'http://cover/1.jpg');
    assert.equal(m.nextArt, 'http://cover/2.jpg');
    assert.equal(m.vol, 25);
});

test('ground floor: the grouped living area counts through its coordinator', () => {
    const m = music(loadMusik({}), [group(['Wohnzimmer', 'Küche', 'Fernsehzimmer'], track())]);
    assert.equal(m.playing, true);
});

test('ground floor: TV sound through the soundbar does not count', () => {
    const tv = track({ currentTrack: { uri: 'x-sonos-htastream:RINCON_123:spdif', title: '' } });
    assert.equal(music(loadMusik({}), [group(['Fernsehzimmer'], tv)]).playing, false);
});

test('ground floor: music only upstairs or in the sauna does not count', () => {
    assert.equal(music(loadMusik({}), [group(['Sauna'], track()), group(['Bad'], track())]).playing, false);
});

test('ground floor: a muted room does not count', () => {
    assert.equal(music(loadMusik({}), [group(['Küche'], track({ mute: true }))]).playing, false);
});

test('ground floor: a paused room does not count', () => {
    assert.equal(music(loadMusik({}), [group(['Küche'], track({ playbackState: 'PAUSED_PLAYBACK' }))]).playing, false);
});

test('ground floor: no Sonos answer means no music', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(music(loadMusik({}), []))), { playing: false });
});

const pill = (html) => html.match(/<div class="gbtn([^"]*)"[^>]*><span>(<svg(?:(?!gbtn).)*?<\/svg>)<\/span>Musiklicht<\/div>/);

test('pill: an enabled music light shows a lit Musiklicht pill', () => {
    const m = pill(loadMusik({ [ENABLED]: true }).build());
    assert.equal(m[1].trim(), 'lit');
    assert.match(m[2], /#F1BE3D|var\(--amber\)/i);
});

test('pill: a disabled music light shows the pill unlit', () => {
    assert.equal(pill(loadMusik({ [ENABLED]: false }).build())[1].trim(), '');
});

test('pill: without a stored setting the music light counts as enabled', () => {
    assert.equal(pill(loadMusik({}).build())[1].trim(), 'lit');
});

test('pill: a tap flips the setting', () => {
    const ctx = loadMusik({ [ENABLED]: true });
    ctx.cmd('light:toggle');
    assert.equal(ctx.st[ENABLED], false);
    ctx.cmd('light:toggle ');
    assert.equal(ctx.st[ENABLED], true);
});

// the band's HTML can only show; taps are native vis overlays placed on the logged layout, offset by the
// band widget's position. A pill without its overlay is a button that does nothing on the wall.
function musikOverlays() {
    const v = JSON.parse(fs.readFileSync(path.join(IOB, 'vis', 'main', 'vis-views.json'), 'utf8')).Steuerung.widgets;
    const bx = parseInt(v.st_musik.style.left, 10), by = parseInt(v.st_musik.style.top, 10);
    return Object.entries(v)
        .filter(([, w]) => w.tpl === 'i-vis-universal' && w.data && w.data.oid === 'javascript.0.musik_cmd')
        .map(([id, w]) => ({ id, value: w.data.iValueTrue, x: parseInt(w.style.left, 10) - bx, y: parseInt(w.style.top, 10) - by }));
}
test('overlays: every Musik tap target has a native overlay on the same spot sending the same command', () => {
    const logged = [];
    const ctx = loadMusik({});
    ctx.console.log = (l) => logged.push(l);
    ctx.build();
    const targets = JSON.parse(logged.find((l) => l.startsWith('MUSIK_LAYOUT ')).slice(13));
    const ov = musikOverlays();
    targets.forEach((t) => {
        assert.ok(ov.some((o) => o.value === t.value && o.x === t.x && o.y === t.y), 'no overlay for ' + t.value + ' at ' + t.x + ',' + t.y);
    });
});

test('pill: its tap target writes the toggle command', () => {
    const logged = [];
    const ctx = loadMusik({});
    ctx.console.log = (l) => logged.push(l);
    ctx.build();
    const targets = JSON.parse(logged.find((l) => l.startsWith('MUSIK_LAYOUT ')).slice(13));
    assert.ok(targets.some((t) => t.value === 'light:toggle' && t.oid === 'javascript.0.musik_cmd'));
});
