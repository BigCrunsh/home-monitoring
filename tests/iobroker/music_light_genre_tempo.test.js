// Music light stages 2 and 4 (openspec add-music-ambient-light). The genre (the album's genres on Deezer,
// looked up once per track; MusicBrainz was unreachable from the Pi and throttled hard) sets the character: calm genres dimmer and slower, lively ones brighter and
// faster, spoken word or audiobooks no music light at all. The track's tempo (Deezer BPM, looked up once
// per track) sets the pace of the colour steps; the volume sets the intensity (quiet = dimmer). The next
// track's cover is fetched ahead, so its colours are ready at the switch. Without data: neutral, 15 s.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');
const ZONES_CFG = 'javascript.0.music_light_zones', MUSIC = 'javascript.0.music_zones';
const SNAPSHOT = 'javascript.0.music_light_snapshot';
const L1 = 'hue.0.Lamp_1', L2 = 'hue.0.Lamp_2';
const CONFIG = JSON.stringify([{ key: 'eg', label: 'EG', rooms: ['Wohnzimmer'], lamps: [L1, L2] }]);
const COVER = 'https://img/cover.jpg', NEXT = 'https://img/next.jpg';

function image(rgb, n) {
    const px = [];
    for (let i = 0; i < n; i++) px.push(rgb[0], rgb[1], rgb[2], 255);
    return { width: n, height: 1, data: Uint8Array.from(px) };
}
// artist → Deezer album genres; "artist|title" → Deezer bpm
const TAGS = { 'Calm Trio': ['Jazz', 'Soul & Funk'], 'Club Act': ['Techno/House', 'Electro'], 'Story Teller': ['Kids', 'Hörbücher'] };
const BPM = { 'Club Act|Night': 128, 'Calm Trio|Slow': 60 };

function load(opts) {
    const st = Object.assign({ [ZONES_CFG]: CONFIG }, (opts && opts.states) || {});
    [L1, L2].forEach((l) => Object.assign(st, { [l + '.reachable']: true, [l + '.on']: false, [l + '.bri']: 0 }));
    const handlers = [], commands = [], ticks = [], fetched = [];
    const down = opts && opts.down;
    function respond(url) {
        if (down) return null;
        if (url === COVER || url === NEXT) return { image: image(url === COVER ? [230, 20, 20] : [20, 40, 230], 50) };
        const q = decodeURIComponent(url);
        if (url.indexOf('https://api.deezer.com/search') === 0) {
            const q2 = q.slice(q.indexOf('q=') + 2).replace(/&limit=1$/, '');
            const artist = Object.keys(TAGS).find((a) => q2.indexOf(a) === 0);
            return { json: { data: artist ? [{ id: q2.replace(artist + ' ', artist + '|'), album: { id: artist } }] : [] } };
        }
        if (url.indexOf('https://api.deezer.com/track/') === 0) return { json: { bpm: BPM[q.slice('https://api.deezer.com/track/'.length)] || 0 } };
        if (url.indexOf('https://api.deezer.com/album/') === 0) {
            const tags = TAGS[q.slice('https://api.deezer.com/album/'.length)] || [];
            return { json: { genres: { data: tags.map((name) => ({ name })) } } };
        }
        return null;
    }
    const net = {
        get: (url, o, cb) => {
            fetched.push(url);
            const r = respond(url), listeners = {};
            const res = { statusCode: r ? 200 : 503, on: (ev, fn) => { listeners[ev] = fn; return res; }, resume() {} };
            cb(res);
            if (r) listeners.data && listeners.data(Buffer.from(r.image ? url : JSON.stringify(r.json)));
            listeners.end && listeners.end();
            return { on() { return this; }, destroy() {} };
        }
    };
    const jpeg = { decode: (buf) => respond(buf.toString()).image };
    const ctx = {
        console: { log() {}, warn() {} },
        getState: (id) => (id in st ? { val: st[id] } : null),
        existsState: (id) => id in st,
        setState: (id, val) => { if (/\.command$/.test(id)) commands.push([id.replace(/\.command$/, ''), JSON.parse(val)]); st[id] = val; },
        createState: (id, def) => { if (!(id in st)) st[id] = def; },
        on: (o, fn) => handlers.push({ opts: o, fn }),
        setInterval: (fn) => ticks.push(fn),
        Buffer, encodeURIComponent,
        require: (m) => (m === 'jpeg-js' ? jpeg : net)
    };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(IOB, 'music_light.js'), 'utf8'), ctx);
    ctx.change = (id, val) => { st[id] = val; handlers.filter((h) => h.opts.id === id).forEach((h) => h.fn({ id, state: { val } })); };
    ctx.seconds = (n) => { for (let i = 0; i < n; i++) ticks.forEach((fn) => fn()); };
    Object.assign(ctx, { commands, fetched, st });
    return ctx;
}
const play = (artist, title, extra) => JSON.stringify({ eg: Object.assign({ playing: true, artist, title, art: COVER, vol: 50 }, extra) });
const colourCmds = (ctx) => ctx.commands.filter(([, c]) => c.xy);
// seconds between the first two colour steps of the first lamp (one lamp, the shade changes every step)
function stepSeconds(ctx) {
    const times = [];
    for (let s = 1; s <= 60 && times.length < 3; s++) {
        const before = colourCmds(ctx).filter(([id]) => id === L1).length;
        ctx.seconds(1);
        if (colourCmds(ctx).filter(([id]) => id === L1).length > before) times.push(s);
    }
    return times[2] - times[1];
}

test('character: calm genres are dimmer and slower, lively ones brighter and faster', () => {
    const ctx = load();
    const calm = ctx.genreCharacter(['jazz', 'soul']), lively = ctx.genreCharacter(['techno']);
    assert.ok(calm.bri < 1 && lively.bri > 1);
    assert.ok(calm.pace > lively.pace);
});

test('character: the album\'s first genre decides', () => {
    assert.ok(load().genreCharacter(['Jazz', 'Rock']).bri < 1);
    assert.ok(load().genreCharacter(['Electro', 'Pop']).bri > 1);
});

test('character: film music is calm, kids music is bright', () => {
    assert.ok(load().genreCharacter(['Filme/Videospiele', 'Filmmusik']).bri < 1);
    assert.ok(load().genreCharacter(['Kids']).bri > 1);
});

test('character: unknown or missing genres are neutral', () => {
    const ctx = load();
    assert.equal(ctx.genreCharacter(undefined).bri, 1);
    assert.equal(ctx.genreCharacter(['polka-fusion']).bri, 1);
    assert.equal(ctx.genreCharacter([]).bri, 1);
});

test('spoken word: an album with only music genres is not spoken word', () => {
    assert.equal(load().isSpokenWord(['Kids', 'Pop']), false);
    assert.equal(load().isSpokenWord(undefined), false);
});

test('character: audiobooks mean no music light, even when listed after another genre', () => {
    assert.equal(load().isSpokenWord(['Hörbücher']), true);
    assert.equal(load().isSpokenWord(['Kids', 'Hörbücher']), true);
    assert.equal(load().isSpokenWord(['spoken word']), true);
});

test('artist: only the first of several artists is looked up', () => {
    const ctx = load();
    assert.equal(ctx.firstArtist('Club Act, Someone & Other feat. Guest'), 'Club Act');
    assert.equal(ctx.firstArtist('Club Act feat. Guest'), 'Club Act');
});

test('tempo: the pace follows the beats per minute within 4 to 25 s', () => {
    const ctx = load();
    assert.equal(ctx.paceSeconds(120, null), 10);
    assert.equal(ctx.paceSeconds(60, null), 20);
    assert.equal(ctx.paceSeconds(400, null), 4);
    assert.equal(ctx.paceSeconds(20, null), 25);
});

test('tempo: without a tempo the genre pace applies, without both 15 s', () => {
    const ctx = load();
    assert.equal(ctx.paceSeconds(0, ctx.genreCharacter(['techno'])), ctx.genreCharacter(['techno']).pace);
    assert.equal(ctx.paceSeconds(0, ctx.genreCharacter([])), 15);
});

test('volume: quiet music is dimmer than loud music', () => {
    const ctx = load();
    assert.ok(ctx.volumeFactor(10) < 1 && ctx.volumeFactor(90) > 1);
    assert.equal(ctx.volumeFactor(undefined), 1);
});

test('live: a fast track steps faster than a slow one', () => {
    const fast = load(), slow = load();
    fast.change(MUSIC, play('Club Act', 'Night'));
    slow.change(MUSIC, play('Calm Trio', 'Slow'));
    assert.equal(stepSeconds(fast), 9);
    assert.equal(stepSeconds(slow), 20);
});

test('live: lively music is brighter than calm music at the same volume', () => {
    const lively = load(), calm = load();
    lively.change(MUSIC, play('Club Act', 'Night'));
    calm.change(MUSIC, play('Calm Trio', 'Slow'));
    lively.seconds(1); calm.seconds(1);
    assert.ok(colourCmds(lively)[0][1].bri > colourCmds(calm)[0][1].bri);
});

test('live: a spoken-word artist gets no music light, the lamps return', () => {
    const ctx = load();
    ctx.change(MUSIC, play('Story Teller', 'Kapitelanfang'));
    ctx.seconds(30);
    assert.deepEqual(colourCmds(ctx), []);
    assert.deepEqual(JSON.parse(ctx.st[SNAPSHOT]), {});
});

test('live: each track is looked up once', () => {
    const ctx = load();
    ctx.change(MUSIC, play('Club Act', 'Night'));
    ctx.change(MUSIC, play('Club Act', 'Night', { vol: 60 }));
    ctx.change(MUSIC, play('Club Act', 'Night', { vol: 70 }));
    assert.equal(ctx.fetched.filter((u) => u.indexOf('api.deezer.com/search') >= 0).length, 1);
    assert.equal(ctx.fetched.filter((u) => u.indexOf('musicbrainz') >= 0).length, 0);
});

test('live: the next track\'s cover is fetched ahead', () => {
    const ctx = load();
    ctx.change(MUSIC, play('Club Act', 'Night', { nextArt: NEXT }));
    assert.ok(ctx.fetched.includes(NEXT));
});

test('live: with every lookup down the scene still cycles at 15 s, neutral', () => {
    const ctx = load({ down: true });
    ctx.change(MUSIC, play('Club Act', 'Night'));
    ctx.seconds(60);
    assert.deepEqual(colourCmds(ctx), [], 'no cover, so the warm scene stays');
    assert.ok(ctx.commands.length > 0, 'the warm scene was set');
});
