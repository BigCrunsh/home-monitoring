/**
 * ioBroker JavaScript: Tankerkoenig Gas Price Quantiles
 * 
 * This script calculates statistical quantiles for gas prices from InfluxDB
 * and creates/updates ioBroker states for visualization in dashboards.
 * 
 * Data Source:
 * - Star station in Siegfriedstraße, Berlin-Lichtenberg
 * - Station ID: 005056ba-7cb6-1ed2-bceb-8e5fec1a0d35
 * 
 * Statistics Calculated:
 * - Min, Max, P20, P50 (median), P80 over 14-day window
 * - Separate stats for E5 and Diesel fuel types
 * 
 * Schedule: Runs every 5 minutes (at 1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56 minutes past the hour)
 * 
 * Dependencies:
 * - InfluxDB adapter (influxdb.0) must be configured
 * - home_monitoring database with gas_prices_euro measurement
 * 
 * @version 1.0.0
 * @author Home Monitoring System
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var stateBasePath = 'javascript.0.tankerkoenig_quantiles';
var influxAdapter = 'influxdb.0';

// Star station in Siegfriedstraße, Berlin-Lichtenberg
var stationId = '005056ba-7cb6-1ed2-bceb-8e5fec1a0d35';

// Fuel types to track
var fuels = [
    { name: 'e5', field: 'e5', unit: 'Euro' },
    { name: 'diesel', field: 'diesel', unit: 'Euro' }
];

// Statistics configuration
var statsConfig = {
    stats: ['min', 'max', 'p20', 'p50', 'p80'],
    timeWindow: '14d'
};

// Current-price feed states (from the tankerkoenig adapter), per fuel.
// Used to publish a "tankstelle"-style HTML rendering of the live price.
var fuelFeedOid = {
    e5: 'tankerkoenig.0.stations.1.e5.feed',
    diesel: 'tankerkoenig.0.stations.1.diesel.feed'
};

// Tankstelle-style formatting (German filling-station price display): the third
// decimal is shown as a small raised index, the way Tankstellen do it.
// The big current price (xx-large) top-aligns at 0.72em; the small max/min values
// need a lower raise to top-align with their last digit at that size.
var SUP_PRICE = 'font-size:0.5em;vertical-align:0.72em';
var SUP_RANGE = 'font-size:0.5em;vertical-align:0.55em';

// "1.779" -> "1,77" + superscript "9"  (truncates the third decimal, never rounds)
function priceSuperHtml(v, sup) {
    var s = parseFloat(v).toFixed(3);
    return s.slice(0, 4).replace('.', ',') +
        '<sup style="' + sup + '">' + s.slice(4) + '</sup>';
}

// Current price: "1,77⁹ €/l"
function formatTankstelleHtml(v) {
    if (v === null || v === undefined || isNaN(parseFloat(v))) return '';
    return priceSuperHtml(v, SUP_PRICE) + ' €/l';
}

// 14-day range value with a dimmed label, e.g. "max 2,10⁹".
// Unit omitted on purpose — it is shown once on the current price.
function formatRangeHtml(label, v) {
    if (v === null || v === undefined || isNaN(parseFloat(v))) return '';
    return '<span style="color:#8A8A8A">' + label + '</span> ' + priceSuperHtml(v, SUP_RANGE);
}

// Recompute the current-price HTML for one fuel from its live feed value.
function updateTankstelleHtml(fuelName) {
    var feed = fuelFeedOid[fuelName];
    var st = getState(feed);
    var val = (st && st.val !== undefined && st.val !== null) ? st.val : null;
    setState(`${stateBasePath}.${fuelName}_html`, formatTankstelleHtml(val), true);
}

// Recompute the range (max/min) HTML for one fuel/stat from its quantile state.
function updateRangeHtml(fuelName, stat) {
    var src = `${stateBasePath}.${fuelName}_${stat}`;
    var st = getState(src);
    var val = (st && st.val !== undefined && st.val !== null) ? st.val : null;
    setState(`${src}_html`, formatRangeHtml(stat, val), true);
}

// ============================================================================
// STATE CREATION - GAS PRICE QUANTILES
// ============================================================================

/**
 * Create states for gas price quantiles
 */
function createQuantileStates() {
    fuels.forEach(function(fuel) {
        statsConfig.stats.forEach(function(stat) {
            createState(`${stateBasePath}.${fuel.name}_${stat}`, 0, {
                desc: `Tankerkoenig ${fuel.name.toUpperCase()} ${stat} over last ${statsConfig.timeWindow}`,
                type: 'number',
                role: 'value',
                unit: fuel.unit
            });
        });

        createState(`${stateBasePath}.${fuel.name}_ts`, 0, {
            desc: `Timestamp of last Tankerkoenig ${fuel.name.toUpperCase()} quantiles update`,
            type: 'number',
            role: 'value'
        });

        createState(`${stateBasePath}.${fuel.name}_html`, '', {
            desc: `Tankerkoenig ${fuel.name.toUpperCase()} current price, tankstelle-style HTML (1,77⁹ €/l)`,
            type: 'string',
            role: 'html'
        });

        ['max', 'min'].forEach(function(stat) {
            createState(`${stateBasePath}.${fuel.name}_${stat}_html`, '', {
                desc: `Tankerkoenig ${fuel.name.toUpperCase()} ${stat} (14d), tankstelle-style HTML with label`,
                type: 'string',
                role: 'html'
            });
        });
    });
}

// ============================================================================
// QUERY FUNCTIONS - GAS PRICE QUANTILES
// ============================================================================

/**
 * Query gas price quantiles from InfluxDB
 */
function queryInfluxDBTankerkoenigQuantiles() {
    console.log('[Tankerkoenig Quantiles] Starting quantile calculation from InfluxDB');

    fuels.forEach(function(fuel) {
        // Query 1: Get statistics over time window
        var statsQuery = `SELECT MIN("${fuel.field}") AS min, MAX("${fuel.field}") AS max, PERCENTILE("${fuel.field}", 20) AS p20, PERCENTILE("${fuel.field}", 50) AS p50, PERCENTILE("${fuel.field}", 80) AS p80 FROM home_monitoring.autogen.gas_prices_euro WHERE station_id = '${stationId}' AND time > now() - ${statsConfig.timeWindow}`;

        sendTo(influxAdapter, 'query', statsQuery, function(result) {
            if (result.error) {
                console.error(`[Tankerkoenig Quantiles ${fuel.name.toUpperCase()}] Query error:`, result.error);
                console.error(`[Tankerkoenig Quantiles ${fuel.name.toUpperCase()}] Failed query: ${statsQuery}`);
                return;
            }

            if (!result.result || !result.result[0] || result.result[0].length === 0) {
                console.warn(`[Tankerkoenig Quantiles ${fuel.name.toUpperCase()}] No data returned from InfluxDB`);
                return;
            }

            var row = result.result[0][0];

            // Update quantile states
            statsConfig.stats.forEach(function(stat) {
                if (row[stat] !== undefined && row[stat] !== null) {
                    setState(`${stateBasePath}.${fuel.name}_${stat}`, row[stat]);
                }
            });
        });

        // Query 2: Get latest timestamp
        var latestQuery = `SELECT "${fuel.field}" FROM home_monitoring.autogen.gas_prices_euro WHERE station_id = '${stationId}' ORDER BY time DESC LIMIT 1`;

        sendTo(influxAdapter, 'query', latestQuery, function(result) {
            if (result.error) {
                console.error(`[Tankerkoenig Latest ${fuel.name.toUpperCase()}] Query error:`, result.error);
                console.error(`[Tankerkoenig Latest ${fuel.name.toUpperCase()}] Failed query: ${latestQuery}`);
                return;
            }

            if (!result.result || !result.result[0] || result.result[0].length === 0) {
                console.warn(`[Tankerkoenig Latest ${fuel.name.toUpperCase()}] No data returned from InfluxDB`);
                return;
            }

            var row = result.result[0][0];

            // Update timestamp
            var ts = new Date(row.ts).getTime();
            setState(`${stateBasePath}.${fuel.name}_ts`, ts);
        });
    });
}

// ===========================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main function to query all Tankerkoenig quantiles from InfluxDB
 */
function queryInfluxDBTankerkoenig() {
    console.log('[Tankerkoenig Integration] Starting quantile calculation from InfluxDB');
    queryInfluxDBTankerkoenigQuantiles();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize script
console.log('[Tankerkoenig Integration] Initializing...');

// Create all states on script start
createQuantileStates();

// Wait for states to be created before running first query (createState is async)
setTimeout(function() {
    queryInfluxDBTankerkoenig();
}, 2000);

// Tankstelle-style HTML: refresh on every change, plus once at startup.
// Current price tracks the live feed; the max/min range tracks the quantile states.
Object.keys(fuelFeedOid).forEach(function(fuelName) {
    on({ id: fuelFeedOid[fuelName], change: 'any' }, function() {
        updateTankstelleHtml(fuelName);
    });
    ['max', 'min'].forEach(function(stat) {
        on({ id: `${stateBasePath}.${fuelName}_${stat}`, change: 'any' }, function() {
            updateRangeHtml(fuelName, stat);
        });
    });
});
setTimeout(function() {
    Object.keys(fuelFeedOid).forEach(function(fuelName) {
        updateTankstelleHtml(fuelName);
        ['max', 'min'].forEach(function(stat) { updateRangeHtml(fuelName, stat); });
    });
}, 2500);

// Schedule to run every 5 minutes, 1 minute after collection script (*/5)
schedule("1,6,11,16,21,26,31,36,41,46,51,56 * * * *", queryInfluxDBTankerkoenig);

console.log('[Tankerkoenig Integration] Script initialized and scheduled');
