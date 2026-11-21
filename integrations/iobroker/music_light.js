// ioBroker JavaScript: music light (openspec add-music-ambient-light). The house is split into zones
// (the ground floor and the children's rooms), each with its Sonos room(s) and its colour lamps. While a
// zone plays music (javascript.0.music_zones, published by musik_v2.js without TV sound and audiobooks)
// and its pill in the Musik band is on, its lamps go to a music scene; the moment that zone's music
// stops or its pill goes off, its lamps return exactly to their state before the music.
//
// The zones are configured privately on the Pi in ZONES_ID (label, Sonos rooms, lamps); the repo only
// holds the ground floor as a default. Only colour lamps take part (owner, 2026-11-21).
// Stage 1 scene: warm and dimmed. Later stages derive it from genre, cover colours and tempo.
//
// The hue adapter takes a JSON command per lamp: bri 0-254 (>0 switches on), ct in Kelvin, xy as
// "x,y", on:false switches off, transitiontime in tenths of a second.

var ZONES_ID = 'javascript.0.music_light_zones';
var MUSIC_ID = 'javascript.0.music_zones';
var OFF_ID = 'javascript.0.music_light_off';
// zone key → lamp → state before the music, persisted so a restart during a song still restores
var SNAPSHOT_ID = 'javascript.0.music_light_snapshot';
var DEFAULT_ZONES = [{
    key: 'eg', label: 'EG', rooms: ['Wohnzimmer', 'Küche', 'Fernsehzimmer'],
    lamps: ['hue.0.Küchenlicht', 'hue.0.Hue_Play_wall_washer_1', 'hue.0.Hue_Play_wall_washer_2']
}];
var FADE = 20;
var SCENE = { bri: 90, ct: 2200, transitiontime: FADE };

// existsState first: getState on a missing state logs a warning (createState is asynchronous, so on
// the first start the states do not exist yet)
function val(id) {
    if (!existsState(id)) return null;
    var s = getState(id);
    return s ? s.val : null;
}
function json(id, fallback) {
    try { return JSON.parse(val(id) || 'null') || fallback; } catch (e) { return fallback; }
}
function zones() { var z = json(ZONES_ID, []); return Array.isArray(z) ? z : []; }
function switchedOff(key) { var o = json(OFF_ID, []); return Array.isArray(o) && o.indexOf(key) >= 0; }
function playing(key) { var m = json(MUSIC_ID, {}); return !!(m[key] && m[key].playing === true); }
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

function startScene(zone) {
    var snapshot = {};
    (zone.lamps || []).forEach(function (id) {
        if (val(id + '.reachable') === true) snapshot[id] = lampState(id);   // no power: skip
    });
    Object.keys(snapshot).forEach(function (id) { command(id, SCENE); });
    return snapshot;
}
function restore(snapshot) {
    Object.keys(snapshot).forEach(function (id) { command(id, restoreCommand(snapshot[id])); });
}
function evaluate() {
    var snapshots = json(SNAPSHOT_ID, {}), changed = false;
    zones().forEach(function (zone) {
        var want = !switchedOff(zone.key) && playing(zone.key);
        if (want && !snapshots[zone.key]) { snapshots[zone.key] = startScene(zone); changed = true; }
        else if (!want && snapshots[zone.key]) { restore(snapshots[zone.key]); delete snapshots[zone.key]; changed = true; }
    });
    if (changed) setState(SNAPSHOT_ID, JSON.stringify(snapshots), true);
}

createState(ZONES_ID, JSON.stringify(DEFAULT_ZONES), { type: 'string', role: 'json', desc: 'Musiklicht: Zonen (Sonos-Räume, Farblampen), privat auf dem Pi' });
createState(SNAPSHOT_ID, '{}', { type: 'string', role: 'json', desc: 'Musiklicht: Lampenzustand vor der Musik je Zone' });
on({ id: MUSIC_ID, change: 'ne' }, evaluate);
on({ id: OFF_ID, change: 'ne' }, evaluate);
evaluate();

console.log('[music_light] initialized');
