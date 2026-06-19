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
