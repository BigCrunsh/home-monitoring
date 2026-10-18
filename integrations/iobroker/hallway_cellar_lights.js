// ioBroker JavaScript: hallway + cellar lights straight from the HomeMatic events, in under a second.
// Mirrors the CCU programs LICHT_Kellervorraum bei Bewegung an/aus, LICHT_Eingang bei Bewegung aus,
// LICHT_Eingang an/aus and LICHT_Eingang alles an/aus. Those stay active on the CCU as a fallback (both
// paths set the same target state), but take ~10 s and stop entirely when the CCU's program engine dies
// (2026-10-18 02:48: buttons reached the CCU, no light switched until a reboot).
//
//   Keller motion        on → Kellervorraumlicht on      off → Kellervorraumlicht off
//   Flur motion          off → Eingangslampe off          (switching on stays with the buttons)
//   Eingang button ×2    upper short → Eingangslampe on   lower short → Eingangslampe off
//                        upper long  → Vitrine + Couch on lower long  → Eingangslampe + Vitrine + Couch off

var CELLAR_MOTION = 'hm-rpc.1.00091BE9910C5B.1.MOTION';
var HALL_MOTION = 'hm-rpc.1.00091A4996315B.1.MOTION';
var CELLAR_LAMP = 'hue.0.Kellervorraumlicht.on';
var ENTRANCE_LAMP = 'hue.0.Eingangslampe.on';
var ENTRANCE_BUTTONS = ['hm-rpc.1.0019DD8989C5B8', 'hm-rpc.1.0019DD8989C615'];   // vorne, hinten
var LIVING_ROOM_PLUGS = ['hm-rpc.1.0001DD89AADDE7.3.STATE', 'hm-rpc.1.0001DD89A46CAD.3.STATE'];   // Vitrine, Couchlampe
var UPPER = '.2', LOWER = '.1';

// plugs are radio actuators: skip a command that changes nothing, it only costs CCU duty cycle
function switchPlug(id, on) {
    var s = getState(id);
    if (s && s.val === on) return;
    setState(id, on);
}
function switchPlugs(on) { LIVING_ROOM_PLUGS.forEach(function (id) { switchPlug(id, on); }); }

on({ id: CELLAR_MOTION, change: 'ne', ack: true }, function (obj) { setState(CELLAR_LAMP, obj.state.val === true); });
on({ id: HALL_MOTION, change: 'ne', ack: true }, function (obj) { if (obj.state.val === false) setState(ENTRANCE_LAMP, false); });

// press events repeat the same value (true) on every press — change 'any', or only the first would count.
// Long presses use PRESS_LONG_START: PRESS_LONG repeats for as long as the rocker is held.
ENTRANCE_BUTTONS.forEach(function (btn) {
    on({ id: btn + UPPER + '.PRESS_SHORT', change: 'any', ack: true }, function () { setState(ENTRANCE_LAMP, true); });
    on({ id: btn + LOWER + '.PRESS_SHORT', change: 'any', ack: true }, function () { setState(ENTRANCE_LAMP, false); });
    on({ id: btn + UPPER + '.PRESS_LONG_START', change: 'any', ack: true }, function () { switchPlugs(true); });
    on({ id: btn + LOWER + '.PRESS_LONG_START', change: 'any', ack: true }, function () {
        setState(ENTRANCE_LAMP, false);
        switchPlugs(false);
    });
});

console.log('[hallway_cellar_lights] initialized');
