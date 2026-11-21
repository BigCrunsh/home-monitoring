// Music light zones (openspec add-music-ambient-light, stages 1 and 1b). musik_v2.js owns the Sonos poll,
// so it publishes per zone whether that zone plays music (javascript.0.music_zones), for music_light.js.
// The zones (label, Sonos rooms, lamps) come from javascript.0.music_light_zones, configured privately on
// the Pi. Not music: TV sound through the soundbar (track URI x-sonos-htastream:; the Hue Sync Box
// lights the TV then), muted rooms, paused rooms, and audiobooks (owner, 2026-11-21: no light while a
// "Folge 4" plays at bedtime). The Musik band header shows one pill per zone (up to four) that switches
// that zone's music light; a zone is on unless switched off. An active pill uses the design system's
// "Effekt aktiv" state (owner choice B, 2026-11-21): a sparkle and frame in the VC_PAL.effect colour
// gradient, distinct from amber (a lamp is on) and green (music plays).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const ZONES_CFG = 'javascript.0.music_light_zones', OFF = 'javascript.0.music_light_off';
const ARTISTS = 'javascript.0.music_light_audiobook_artists';
const CONFIG = JSON.stringify([
    { key: 'eg', label: 'EG', rooms: ['Wohnzimmer', 'Küche', 'Fernsehzimmer'], lamps: [] },
    { key: 'k1', label: 'Kind 1', rooms: ['Studio'], lamps: [] }
]);

function loadMusik(states) {
    const st = Object.assign({ [ZONES_CFG]: CONFIG }, states);
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
function track(over, trackOver) {
    return Object.assign({
        playbackState: 'PLAYING', volume: 25, mute: false,
        currentTrack: Object.assign({ artist: 'Artist', title: 'Song', album: 'Album', uri: 'https://stream/1', absoluteAlbumArtUri: 'http://cover/1.jpg' }, trackOver),
        nextTrack: { absoluteAlbumArtUri: 'http://cover/2.jpg' }
    }, over);
}
// publish the given Sonos answer and read back the per-zone music state
function zones(ctx, groups) {
    ctx.ZONES = ctx.zonesFromSonos(groups);
    ctx.publish();
    return JSON.parse(ctx.st['javascript.0.music_zones']);
}

test('zones: music in the kitchen plays in the ground-floor zone, with what plays and the next cover', () => {
    const z = zones(loadMusik({}), [group(['Küche'], track())]);
    assert.equal(z.eg.playing, true);
    assert.equal(z.eg.artist, 'Artist');
    assert.equal(z.eg.title, 'Song');
    assert.equal(z.eg.album, undefined, 'nothing reads the album, so it is not published');
    assert.equal(z.eg.art, 'http://cover/1.jpg');
    assert.equal(z.eg.nextArt, 'http://cover/2.jpg');
    assert.equal(z.eg.vol, 25);
    assert.equal(z.k1.playing, false);
});

// with the household's streaming service Sonos puts the track's audio file into absoluteAlbumArtUri (a
// 23 MB FLAC download, 2026-11-21); the real cover is the JPEG in albumArtUri
test('zones: the cover is the image in albumArtUri, never the audio file', () => {
    const audio = 'https://cdn/track.flac?Expires=1';
    const z = zones(loadMusik({}), [group(['Küche'], track({ nextTrack: { albumArtUri: 'https://img/next.jpg', absoluteAlbumArtUri: 'https://cdn/next.flac' } },
        { uri: audio, absoluteAlbumArtUri: audio, albumArtUri: 'https://img/cover.jpg' }))]);
    assert.equal(z.eg.art, 'https://img/cover.jpg');
    assert.equal(z.eg.nextArt, 'https://img/next.jpg');
});

test('zones: a cover that is only the track address counts as no cover', () => {
    const audio = 'https://cdn/track.flac';
    const z = zones(loadMusik({}), [group(['Küche'], track({ nextTrack: {} }, { uri: audio, absoluteAlbumArtUri: audio, albumArtUri: '' }))]);
    assert.equal(z.eg.art, undefined);
});

test('zones: a relative albumArtUri falls back to the absolute cover address', () => {
    const z = zones(loadMusik({}), [group(['Küche'], track({}, { albumArtUri: '/getaa?s=1&u=x', absoluteAlbumArtUri: 'http://speaker:1400/getaa?s=1&u=x' }))]);
    assert.equal(z.eg.art, 'http://speaker:1400/getaa?s=1&u=x');
});

test('zones: each zone follows only its own rooms', () => {
    const z = zones(loadMusik({}), [group(['Studio'], track())]);
    assert.equal(z.k1.playing, true);
    assert.equal(z.eg.playing, false);
});

test('zones: the grouped living area plays through its coordinator', () => {
    assert.equal(zones(loadMusik({}), [group(['Wohnzimmer', 'Küche', 'Fernsehzimmer'], track())]).eg.playing, true);
});

test('zones: TV sound through the soundbar is not music', () => {
    const z = zones(loadMusik({}), [group(['Fernsehzimmer'], track({}, { uri: 'x-sonos-htastream:RINCON_1:spdif', title: '' }))]);
    assert.equal(z.eg.playing, false);
});

test('zones: a muted or paused room is not music', () => {
    assert.equal(zones(loadMusik({}), [group(['Küche'], track({ mute: true }))]).eg.playing, false);
    assert.equal(zones(loadMusik({}), [group(['Küche'], track({ playbackState: 'PAUSED_PLAYBACK' }))]).eg.playing, false);
});

test('zones: a room outside every zone changes nothing', () => {
    const z = zones(loadMusik({}), [group(['Sauna'], track())]);
    assert.equal(z.eg.playing, false);
    assert.equal(z.k1.playing, false);
});

// audiobooks: episode, chapter or part naming, the words Hörspiel/Hörbuch, or a listed artist
test('audiobooks: an album named after an episode is not music', () => {
    const z = zones(loadMusik({}), [group(['Studio'], track({}, { title: 'Titellied', album: 'Folge 4: Der Bankräuber' }))]);
    assert.equal(z.k1.playing, false);
});

test('audiobooks: chapter or part titles and the words Hörspiel or Hörbuch are not music', () => {
    [{ title: 'Kapitel 12' }, { title: 'Teil 3 - Im Wald' }, { album: 'Das große Hörspiel' }, { album: 'Märchen (Hörbuch)' }].forEach((t) => {
        assert.equal(zones(loadMusik({}), [group(['Studio'], track({}, t))]).k1.playing, false, JSON.stringify(t));
    });
});

test('audiobooks: an artist on the private list is not music', () => {
    const ctx = loadMusik({ [ARTISTS]: JSON.stringify(['Hexe Lilli']) });
    assert.equal(zones(ctx, [group(['Studio'], track({}, { artist: 'Hexe Lilli', album: 'Best of' }))]).k1.playing, false);
});

test('audiobooks: music with a number in its title still counts as music', () => {
    assert.equal(zones(loadMusik({}), [group(['Küche'], track({}, { title: 'Symphony No. 5', album: 'Greatest Hits Vol 2' }))]).eg.playing, true);
});

test('zones: without a zone config nothing is published as playing', () => {
    const ctx = loadMusik({ [ZONES_CFG]: '{broken' });
    assert.deepEqual(zones(ctx, [group(['Küche'], track())]), {});
});

const pills = (html) => [...html.matchAll(/<div class="gbtn([^"]*)"[^>]*><span>(<svg(?:(?!gbtn).)*?<\/svg>)<\/span>([^<]+)<\/div>/g)]
    .map((m) => ({ cls: m[1].trim(), icon: m[2], label: m[3] }))
    .filter((p) => !['Alle', 'Wohnen', 'Einzeln'].includes(p.label));

test('pills: one pill per zone, labelled from the config, shown as an active effect while on', () => {
    const ctx = loadMusik({});
    const p = pills(ctx.build());
    assert.deepEqual(p.map((x) => x.label), ['EG', 'Kind 1']);
    assert.deepEqual(p.map((x) => x.cls), ['fx', 'fx']);
    assert.match(p[0].icon, /linearGradient/);
    ctx.VC_PAL.effect.forEach((c) => assert.ok(p[0].icon.includes(c), 'icon lacks ' + c));
});

test('pills: a switched-off zone shows a plain grey sparkle, no gradient', () => {
    const p = pills(loadMusik({ [OFF]: JSON.stringify(['eg']) }).build());
    assert.doesNotMatch(p[0].icon, /linearGradient/);
});

test('pills: a zone switched off shows its pill unlit', () => {
    const p = pills(loadMusik({ [OFF]: JSON.stringify(['k1']) }).build());
    assert.deepEqual(p.map((x) => x.cls), ['fx', '']);
});

test('pills: a tap switches only its own zone, a second tap switches it back', () => {
    const ctx = loadMusik({});
    ctx.cmd('light:toggle:1');
    assert.deepEqual(JSON.parse(ctx.st[OFF]), ['k1']);
    ctx.cmd('light:toggle:1 ');
    assert.deepEqual(JSON.parse(ctx.st[OFF]), []);
});

test('pills: a tap on an empty slot changes nothing', () => {
    const ctx = loadMusik({});
    ctx.cmd('light:toggle:3');
    assert.equal(ctx.st[OFF], undefined);
});

test('pills: never more than four, however many zones are configured', () => {
    const many = JSON.stringify([1, 2, 3, 4, 5].map((i) => ({ key: 'z' + i, label: 'Z' + i, rooms: [], lamps: [] })));
    assert.equal(pills(loadMusik({ [ZONES_CFG]: many }).build()).length, 4);
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
    const four = JSON.stringify([1, 2, 3, 4].map((i) => ({ key: 'z' + i, label: 'Z' + i, rooms: [], lamps: [] })));
    const ctx = loadMusik({ [ZONES_CFG]: four });
    ctx.console.log = (l) => logged.push(l);
    ctx.build();
    const targets = JSON.parse(logged.find((l) => l.startsWith('MUSIK_LAYOUT ')).slice(13));
    const ov = musikOverlays();
    targets.forEach((t) => {
        assert.ok(ov.some((o) => o.value === t.value && o.x === t.x && o.y === t.y), 'no overlay for ' + t.value + ' at ' + t.x + ',' + t.y);
    });
});
