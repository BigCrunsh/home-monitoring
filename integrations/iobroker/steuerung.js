// Steuerung confirm-guard for the Main2 "Neu" dashboard.
// Maxxisun's wall plug (HmIP "Steckdose Maxxisun Akku", writable channel .3) feeds the battery
// inverter — switching it OFF stops charge AND feed-in, so a stray tap must not do it. The
// Steuerung tile is therefore two-step: tapping the "Maxxisun" tile ARMS it (mx_arm=true), which
// reveals the real plug switch for a few seconds; the second tap (on the revealed switch) toggles
// the plug. It re-secures automatically after 5 s and immediately after any switch.
var MX_PLUG = 'hm-rpc.1.0001DD89A46CA5.3.STATE';
var mxTimer = null;

function disarm() {
    if (mxTimer) { clearTimeout(mxTimer); mxTimer = null; }
    var s = getState('mx_arm');
    if (s && s.val) setState('mx_arm', false, true);
}

createState('mx_arm', false, { name: 'Maxxisun-Schalter entsichert', type: 'boolean', role: 'switch', def: false }, function () {
    setState('mx_arm', false, true);
});

// arming starts the auto-re-secure timer
on({ id: 'javascript.0.mx_arm', change: 'any' }, function (obj) {
    if (obj.state && obj.state.val === true) {
        if (mxTimer) clearTimeout(mxTimer);
        mxTimer = setTimeout(disarm, 5000);
    }
});

// re-secure the moment the plug is actually switched (via the revealed confirm button)
on({ id: MX_PLUG, change: 'any' }, disarm);

// --- Türöffner confirm-guard (same pattern) ---
// The front door is an HmIP-DLD lock; "öffnen" = writing LOCK_TARGET_LEVEL='OPEN' (retracts the
// latch). A stray tap on the wall must not open the door, so the Steuerung "Tür" tile is two-step:
// tap ARMS it (tuer_arm=true) → reveals the red confirm for 5 s → second tap writes OPEN. It
// re-secures after 5 s and immediately after any lock-target change.
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
