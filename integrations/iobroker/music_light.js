// ioBroker JavaScript: music light (openspec add-music-ambient-light). While the "Musiklicht" switch in
// the Musik band is on and the ground floor plays music (javascript.0.music_ground_floor, published by
// musik_v2.js without TV sound), the ambient lamps downstairs go to a music scene; the moment the music
// stops or the switch goes off, every lamp returns exactly to its state before the music.
//
// Stage 1 scene: warm and dimmed. Later stages derive it from genre, cover colours and tempo.
//
// The hue adapter takes a JSON command per lamp: bri 0-254 (>0 switches on), ct in Kelvin, xy as
// "x,y", on:false switches off, transitiontime in tenths of a second.

var ENABLED_ID = 'javascript.0.music_light_enabled';
var MUSIC_ID = 'javascript.0.music_ground_floor';
// lamp → state before the music, persisted so a restart during a song still restores afterwards;
// '' while no scene is active
var SNAPSHOT_ID = 'javascript.0.music_light_snapshot';
var LAMPS = [
    { id: 'hue.0.Küchenlicht', colour: true },
    { id: 'hue.0.Hue_Play_wall_washer_1', colour: true },
    { id: 'hue.0.Hue_Play_wall_washer_2', colour: true },
    { id: 'hue.0.Esstischlicht_hinten' },
    { id: 'hue.0.Esstischlicht_mitte' },
    { id: 'hue.0.Esstischlicht_vorne' }
];
var FADE = 20;
var SCENE_COLOUR = { bri: 90, ct: 2200, transitiontime: FADE };
var SCENE_WHITE = { bri: 70, transitiontime: FADE };

// existsState first: getState on a missing state logs a warning (createState is asynchronous, so on
// the first start the snapshot state does not exist yet)
function val(id) {
    if (!existsState(id)) return null;
    var s = getState(id);
    return s ? s.val : null;
}
function enabled() { return val(ENABLED_ID) !== false; }
function musicPlaying() {
    try { return JSON.parse(val(MUSIC_ID) || '{}').playing === true; } catch (e) { return false; }
}
function loadSnapshot() {
    try { return JSON.parse(val(SNAPSHOT_ID) || 'null'); } catch (e) { return null; }
}
function command(id, cmd) { setState(id + '.command', JSON.stringify(cmd)); }

function lampState(id) {
    return { on: val(id + '.on') === true, bri: val(id + '.bri'), ct: val(id + '.ct'), xy: val(id + '.xy'), colormode: val(id + '.colormode') };
}
function restoreCommand(s) {
    if (!s.on) return { on: false, transitiontime: FADE };
    var cmd = { bri: s.bri, transitiontime: FADE };
    if (s.colormode === 'ct' && s.ct != null) cmd.ct = s.ct;
    else if (s.xy != null) cmd.xy = s.xy;
    return cmd;
}

function startScene() {
    var snapshot = {};
    LAMPS.forEach(function (l) {
        if (val(l.id + '.reachable') !== true) return;   // no power at the wall switch
        snapshot[l.id] = lampState(l.id);
    });
    setState(SNAPSHOT_ID, JSON.stringify(snapshot), true);
    LAMPS.forEach(function (l) {
        if (snapshot[l.id]) command(l.id, l.colour ? SCENE_COLOUR : SCENE_WHITE);
    });
}
function restore(snapshot) {
    Object.keys(snapshot).forEach(function (id) { command(id, restoreCommand(snapshot[id])); });
    setState(SNAPSHOT_ID, '', true);
}
function evaluate() {
    var want = enabled() && musicPlaying(), snapshot = loadSnapshot();
    if (want && !snapshot) startScene();
    else if (!want && snapshot) restore(snapshot);
}

createState(SNAPSHOT_ID, '', { type: 'string', role: 'json', desc: 'Musiklicht: Lampenzustand vor der Musik' });
on({ id: MUSIC_ID, change: 'ne' }, evaluate);
on({ id: ENABLED_ID, change: 'ne' }, evaluate);
evaluate();

console.log('[music_light] initialized');
