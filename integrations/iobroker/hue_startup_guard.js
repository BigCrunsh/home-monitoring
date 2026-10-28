// ioBroker JavaScript: switches the non-Hue lamps on the Hue bridge back off when they come up on by
// themselves after the bridge restarts or the power returns. The Hue lamps restore their last state
// (startup mode "powerfail", set 2026-09-26); these IKEA/Tuya lamps reject that setting and power up on.
// On 2026-10-27 14:18 a bridge firmware update left Carlottas Deckenlampe on for 19 h with nobody home.
//
// Only a bridge reconnect opens the window, not the lamp itself becoming reachable: Vitrine and Flurlampe
// hang off switched sockets, and powering them up there is meant to switch them on.

var BRIDGE = 'hue.0.info.connection';
var GUARDED_LAMPS = [
    'hue.0.Carlottas_Deckenlampe.on',   // IKEA FLOALT
    'hue.0.Vitinenlicht.on',            // IKEA TRADFRI driver
    'hue.0.Flurlampe.on',               // IKEA FLOALT
    'hue.0.Wohnzimmertischlampe.on'     // Tuya TS0502B
];
// the lamps report in within a minute of the reconnect (2026-10-27: 3 s); a deliberate switch-on this
// close to a bridge restart is rare enough to lose
var WINDOW_MS = 3 * 60 * 1000;

// starting after a Pi reboot, the reconnect may already have happened: its last change is the reconnect
var bridge = getState(BRIDGE);
var reconnectedAt = bridge && bridge.val === true ? bridge.lc : 0;

on({ id: BRIDGE, change: 'ne', ack: true }, function (obj) {
    if (obj.state.val === true) reconnectedAt = Date.now();
});

GUARDED_LAMPS.forEach(function (id) {
    on({ id: id, change: 'ne', ack: true }, function (obj) {
        if (obj.state.val !== true || obj.oldState.val !== false) return;
        if (Date.now() - reconnectedAt > WINDOW_MS) return;
        console.log('[hue_startup_guard] ' + id + ' came up on after the bridge reconnected, switching it off');
        setState(id, false);
    });
});

console.log('[hue_startup_guard] initialized');
