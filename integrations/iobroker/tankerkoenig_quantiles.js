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
 * Schedule: Runs every 30 minutes (at 1 and 31 past the hour); a 14-day quantile barely moves
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

// ============================================================================
// STATE CREATION - GAS PRICE QUANTILES
// ============================================================================

/**
 * Create states for gas price quantiles
 */
function createQuantileStates() {
    fuels.forEach(function(fuel) {
        statsConfig.stats.forEach(function(stat) {
            // No initial value: until the first query returns, main_v2 must see "no data", not a 0 price band
            createState(`${stateBasePath}.${fuel.name}_${stat}`, undefined, {
                desc: `Tankerkoenig ${fuel.name.toUpperCase()} ${stat} over last ${statsConfig.timeWindow}`,
                type: 'number',
                role: 'value',
                unit: fuel.unit
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
    fuels.forEach(function(fuel) {
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

            statsConfig.stats.forEach(function(stat) {
                if (row[stat] !== undefined && row[stat] !== null) {
                    setState(`${stateBasePath}.${fuel.name}_${stat}`, row[stat]);
                }
            });
        });
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

createQuantileStates();

// Wait for states to be created before running first query (createState is async)
setTimeout(queryInfluxDBTankerkoenigQuantiles, 2000);

schedule("1,31 * * * *", queryInfluxDBTankerkoenigQuantiles);
