// Dead man's switch for the Bungalow Lübkowsee. When the bungalow loses internet or power it cannot
// raise an alarm itself, so the home Pi watches for silence and messages via Telegram.
//
// Signal: the Netatmo stations' LastUpdate (the measurement time Netatmo reports, so an ioBroker or
// adapter restart does not fake an outage). The home station is the control: if it is silent too,
// the Netatmo cloud / adapter / home internet is down and the watcher is blind — no bungalow verdict.
//
//   home silent                      → blind    (frozen: bungalow incidents neither alert nor recover)
//   bungalow base silent             → offline  (internet or power out at the bungalow)
//   only the bungalow outdoor module → outdoor  (sensor battery or radio)
//
// Each incident alerts once after FAIL_LIMIT consecutive silent checks, reminds every REMINDER_HOURS,
// and reports its duration on recovery. Incident state persists in 0_userdata so a restart neither
// re-alerts nor forgets an ongoing outage. Homematic IP (bungalow access point) joins as a second
// signal once those devices are installed.

var CHECK_CRON = '*/5 * * * *';
var STALE_MIN = 40;          // no Netatmo update for this long = silent (Netatmo updates ~every 10 min)
var FAIL_LIMIT = 3;          // consecutive silent checks before alerting
var REMINDER_HOURS = 12;
var TELEGRAM = 'telegram.0';

var BUNGALOW_BASE = 'netatmo.0.6ac096020a296fac710a1287.70-ee-50-c3-9e-84';
var BUNGALOW_OUTDOOR = BUNGALOW_BASE + '.02-00-00-c3-99-18';
var HOME_BASE = 'netatmo.0.5eafe7e5e6268b245ee4d8ae.70-ee-50-32-c3-4c';

var OUT = '0_userdata.0.bungalow.';
var MIN_MS = 60 * 1000;

// ===== pure logic =====
function observe(ages) {
    function silent(age) { return age == null || age > STALE_MIN; }
    var blind = silent(ages.homeBase);
    var offline = !blind && silent(ages.bungalowBase);
    return { blind: blind, offline: offline, outdoor: !blind && !offline && silent(ages.bungalowOutdoor) };
}

function newIncident() { return { active: false, count: 0, since: null, alertedAt: null }; }
function initialState() { return { blind: newIncident(), offline: newIncident(), outdoor: newIncident() }; }

// advance one incident by one check → its next state + the event to announce (or null)
function track(inc, failing, now) {
    var next = { active: inc.active, count: inc.count, since: inc.since, alertedAt: inc.alertedAt };
    if (!failing) {
        var recovered = inc.active;
        return { inc: newIncident(), event: recovered ? 'recovery' : null, since: inc.since };
    }
    next.count++;
    // silence started at least STALE_MIN before the first check that saw it
    if (next.count === 1) next.since = now - STALE_MIN * MIN_MS;
    if (!next.active && next.count >= FAIL_LIMIT) {
        next.active = true; next.alertedAt = now;
        return { inc: next, event: 'alert', since: next.since };
    }
    if (next.active && now - next.alertedAt >= REMINDER_HOURS * 60 * MIN_MS) {
        next.alertedAt = now;
        return { inc: next, event: 'reminder', since: next.since };
    }
    return { inc: next, event: null, since: next.since };
}

function duration(ms) {
    var m = Math.max(0, Math.round(ms / MIN_MS)), h = Math.floor(m / 60);
    return h > 0 ? h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min';
}

var TEXTS = {
    offline: {
        alert: function () { return '🔴 Bungalow Lübkowsee offline: seit über ' + STALE_MIN + ' min keine Daten der Netatmo-Station, zu Hause läuft Netatmo normal → vermutlich Internet oder Strom im Bungalow ausgefallen.'; },
        reminder: function (d) { return '🔴 Bungalow Lübkowsee weiterhin offline (seit ca. ' + d + ').'; },
        recovery: function (d) { return '🟢 Bungalow Lübkowsee wieder online — Ausfall ca. ' + d + '.'; }
    },
    outdoor: {
        alert: function () { return '🟡 Bungalow Lübkowsee: das Netatmo-Außenmodul meldet seit über ' + STALE_MIN + ' min nichts (Batterie oder Funk?). Die Station selbst ist online.'; },
        reminder: function (d) { return '🟡 Bungalow-Außenmodul meldet weiterhin nichts (seit ca. ' + d + ').'; },
        recovery: function (d) { return '🟢 Bungalow-Außenmodul meldet wieder — Ausfall ca. ' + d + '.'; }
    },
    blind: {
        alert: function () { return '⚪ Bungalow-Wächter blind: auch die Netatmo-Station zu Hause liefert seit über ' + STALE_MIN + ' min keine Daten (Netatmo-Cloud, Adapter oder Internet zu Hause). Bungalow-Status unbekannt.'; },
        reminder: function (d) { return '⚪ Bungalow-Wächter weiterhin blind (seit ca. ' + d + ').'; },
        recovery: function (d) { return '🟢 Bungalow-Wächter wieder aktiv (blind für ca. ' + d + ').'; }
    }
};

// one check: advance all incidents → next state + messages. While blind the bungalow incidents are
// frozen — the silence says nothing about the bungalow.
function step(state, obs, now) {
    var next = { blind: state.blind, offline: state.offline, outdoor: state.outdoor }, messages = [];
    var keys = obs.blind ? ['blind'] : ['blind', 'offline', 'outdoor'];
    keys.forEach(function (k) {
        var r = track(state[k], obs[k], now);
        next[k] = r.inc;
        if (r.event) messages.push(TEXTS[k][r.event](duration(now - r.since)));
    });
    return { state: next, messages: messages };
}

// ===== ioBroker wiring =====
// a station's last Netatmo report (ms) or null; existsState first — a removed station must not
// warn-spam the log on every check
function lastUpdate(module) {
    var id = module + '.LastUpdate';
    var s = existsState(id) ? getState(id) : null;
    var t = s && s.val ? new Date(s.val).getTime() : NaN;
    return isNaN(t) ? null : t;
}
function ageMin(module, now) {
    var t = lastUpdate(module);
    return t == null ? null : (now - t) / MIN_MS;
}
function loadState() {
    var s = getState(OUT + 'state');
    try { return s && s.val ? JSON.parse(s.val) : initialState(); } catch (e) { return initialState(); }
}

function check(now) {
    now = now || Date.now();
    var obs = observe({ bungalowBase: ageMin(BUNGALOW_BASE, now), bungalowOutdoor: ageMin(BUNGALOW_OUTDOOR, now), homeBase: ageMin(HOME_BASE, now) });
    var r = step(loadState(), obs, now);
    r.messages.forEach(function (text) { log(text); sendTo(TELEGRAM, 'send', { text: text }); });
    var st = r.state, seen = lastUpdate(BUNGALOW_BASE);
    setState(OUT + 'state', JSON.stringify(st), true);
    setState(OUT + 'online', !st.offline.active, true);
    setState(OUT + 'status', st.blind.active ? 'blind' : (st.offline.active ? 'offline' : (st.outdoor.active ? 'outdoor' : 'online')), true);
    setState(OUT + 'lastSeen', seen != null ? new Date(seen).toISOString() : '', true);
    setState(OUT + 'outageSince', st.offline.active ? new Date(st.offline.since).toISOString() : '', true);
}

var STATES = [
    ['state', '', 'string', 'Wächter-Zustand (intern, JSON)'],
    ['online', true, 'boolean', 'Bungalow online'],
    ['status', 'online', 'string', 'online | offline | outdoor | blind'],
    ['lastSeen', '', 'string', 'letzte Netatmo-Meldung der Bungalow-Station (ISO)'],
    ['outageSince', '', 'string', 'Ausfall seit (ISO), leer wenn online']
];
var _pending = STATES.length;
STATES.forEach(function (s) {
    createState(OUT + s[0], s[1], { type: s[2], name: s[3], read: true, write: false }, function () {
        if (--_pending === 0) schedule(CHECK_CRON, function () { check(); });
    });
});
