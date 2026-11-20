// ioBroker JavaScript: the kids' room wall buttons switch their Hue lamps over HTTPS.
// Since the Hue bridge firmware of 2026-11-17 blocks plain HTTP ("HTTP access is blocked"), the CCU's
// built-in Hue integration, which only speaks HTTP, cannot switch any Hue lamp: the CCU programs
// LICHT_Clara/Spielzimmer/Carlotta Decke|Steh an|aus still run on every press, but nothing reaches the
// lamp, and eQ-3 ships no fix. The hue adapter talks to the bridge over HTTPS.
//
//   upper rocker (channel 2) = on, lower rocker (channel 1) = off
//   Clara, Spielzimmer   short press → ceiling lamp
//   Carlotta             short press → ceiling lamp, long press → floor lamp
//
// A press that the bridge has not confirmed after REACTION_MS is a fault, published for Diagnose
// (red row + Telegram) until a press on that light works again. A lamp without power (unreachable) is
// no button fault; Diagnose watches lamp reachability on its own.

var UPPER = '.2', LOWER = '.1';
var LIGHTS = [
    { name: 'Clara Decke', button: 'hm-rpc.1.0019E2698C76C8', press: 'PRESS_SHORT', lamp: 'hue.0.Claras_Deckenlampe' },
    { name: 'Spielzimmer Decke', button: 'hm-rpc.1.0019E2698C76E3', press: 'PRESS_SHORT', lamp: 'hue.0.Deckenlampe_' },
    { name: 'Carlotta Decke', button: 'hm-rpc.1.00085D899DB3AB', press: 'PRESS_SHORT', lamp: 'hue.0.Carlottas_Deckenlampe' },
    // PRESS_LONG repeats while the rocker is held; PRESS_LONG_START fires once
    { name: 'Carlotta Stehlampe', button: 'hm-rpc.1.00085D899DB3AB', press: 'PRESS_LONG_START', lamp: 'hue.0.Carlottas_Stehlampe' }
];
// the hue adapter polls the bridge every 10 s; one poll plus margin
var REACTION_MS = 15000;
var FAULTS_ID = 'javascript.0.light_button_faults';

function loadFaults() {
    var s = getState(FAULTS_ID);
    try { return JSON.parse((s && s.val) || '{}'); } catch (e) { return {}; }
}
function setFault(name, faulty) {
    var faults = loadFaults();
    if (faulty) faults[name] = faults[name] || Date.now();
    else delete faults[name];
    setState(FAULTS_ID, JSON.stringify(faults), true);
}
function reacted(light, on) {
    var s = getState(light.lamp + '.on');
    return !!(s && s.ack && s.val === on);
}
function checkReaction(light, on) {
    var power = getState(light.lamp + '.reachable');
    if (power && power.val === false) return;
    setFault(light.name, !reacted(light, on));
}
function press(light, on) {
    setState(light.lamp + '.on', on);
    setTimeout(function () { checkReaction(light, on); }, REACTION_MS);
}

createState(FAULTS_ID, '{}', { type: 'string', role: 'json', desc: 'Kinderzimmer-Taster: Lichter, die auf den letzten Tastendruck nicht reagiert haben' });
// press events repeat the same value (true) on every press: change 'any', or only the first would count
LIGHTS.forEach(function (light) {
    on({ id: light.button + UPPER + '.' + light.press, change: 'any', ack: true }, function () { press(light, true); });
    on({ id: light.button + LOWER + '.' + light.press, change: 'any', ack: true }, function () { press(light, false); });
});

console.log('[kids_room_lights] initialized');
