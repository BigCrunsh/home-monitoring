// Türöffner confirm-guard for the Main2 "Neu" dashboard.
// The front door is an HmIP-DLD lock; "öffnen" = writing LOCK_TARGET_LEVEL='OPEN' (retracts the
// latch). A stray tap on the wall must not open the door, so the Steuerung "Tür" tile is two-step:
// tap ARMS it (tuer_arm=true) → reveals the red confirm for 5 s → second tap writes OPEN. It
// re-secures after 5 s and immediately after any lock-target change.
// (The former mx_arm guard for the Maxxisun plug lived here too — removed 2026-07-19: nothing
// read or wrote it anymore after the Steuerung v2 rebuild.)
var LOCK_TARGET = 'hm-rpc.1.002A226996B89C.1.LOCK_TARGET_LEVEL';
var tuerTimer = null;

function disarmTuer() {
    if (tuerTimer) { clearTimeout(tuerTimer); tuerTimer = null; }
    var s = getState('tuer_arm');
    if (s && s.val) setState('tuer_arm', false, true);
}

createState('tuer_arm', false, { name: 'Türöffner entsichert', type: 'boolean', role: 'switch', def: false }, function () {
    setState('tuer_arm', false, true);
});

on({ id: 'javascript.0.tuer_arm', change: 'any' }, function (obj) {
    if (obj.state && obj.state.val === true) {
        if (tuerTimer) clearTimeout(tuerTimer);
        tuerTimer = setTimeout(disarmTuer, 5000);
    }
});

on({ id: LOCK_TARGET, change: 'any' }, disarmTuer);
