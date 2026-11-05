// The vis-2 layout (vis/main/vis-views.json) is hand-edited and deployed as one file: invalid JSON
// bricks every dashboard at once, and a widget bound to a javascript.0 state that no script creates
// stays blank without any error. Both only showed up on the wall before; these guards catch them here.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const IOB = path.join(__dirname, '..', '..', 'integrations', 'iobroker');

// the javascript.0 states a layout binds that none of the scripts names
function unboundStates(layoutText, scriptSources) {
    const ids = new Set(layoutText.match(/javascript\.0\.[A-Za-z0-9_.]+/g) || []);
    const src = scriptSources.join('\n');
    return [...ids].filter((id) => {
        const name = id.replace(/^javascript\.0\./, '');
        return [name, id].every((s) => !src.includes("'" + s + "'") && !src.includes('"' + s + '"'));
    });
}

function repoScripts() {
    return fs.readdirSync(IOB).filter((f) => f.endsWith('.js'))
        .map((f) => fs.readFileSync(path.join(IOB, f), 'utf8'));
}
const layoutText = () => fs.readFileSync(path.join(IOB, 'vis', 'main', 'vis-views.json'), 'utf8');

test('vis layout: the repo layout is valid JSON with views that hold widgets', () => {
    const views = JSON.parse(layoutText());
    const named = Object.keys(views).filter((k) => k !== '___settings');
    assert.ok(named.length > 0);
    named.forEach((v) => assert.equal(typeof views[v].widgets, 'object', v + ' has no widgets'));
});

test('vis layout: every javascript.0 state the layout shows is created by a repo script', () => {
    assert.deepEqual(unboundStates(layoutText(), repoScripts()), []);
});

test('vis layout: a state renamed in the script but not in the layout is reported', () => {
    const layout = '{"Energy":{"widgets":{"w1":{"data":{"html":"{javascript.0.et3_flow_old}"}}}}}';
    const scripts = ["setState('et3_flow', html, true);"];
    assert.deepEqual(unboundStates(layout, scripts), ['javascript.0.et3_flow_old']);
});

test('vis layout: a state whose name is only the start of a script state is still reported', () => {
    const layout = '{"Main":{"widgets":{"w1":{"data":{"html":"{javascript.0.diag}"}}}}}';
    const scripts = ["setState('diag_summary', html, true);"];
    assert.deepEqual(unboundStates(layout, scripts), ['javascript.0.diag']);
});

test('vis layout: a truncated layout file does not parse', () => {
    const truncated = layoutText().slice(0, -10);
    assert.throws(() => JSON.parse(truncated), SyntaxError);
});
