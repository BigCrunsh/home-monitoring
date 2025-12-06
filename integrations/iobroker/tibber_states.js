/**
 * ioBroker JavaScript: Tibber Energy Data Integration
 * 
 * This script pulls Tibber electricity data from InfluxDB and creates/updates
 * ioBroker states for visualization in dashboards.
 * 
 * Data Categories:
 * - Current energy prices (with statistics)
 * - Energy consumption by period (with statistics)
 * - Energy costs by period (with statistics)
 * 
 * Schedule: Runs every 15 minutes (at 1, 16, 31, 46 minutes past the hour)
 * 
 * Dependencies:
 * - InfluxDB adapter (influxdb.0) must be configured
 * - home_monitoring database with Tibber measurements
 * 
 * @version 1.0.0
 * @author Home Monitoring System
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var stateBasePath = 'javascript.0.tibber_energy';
var statisticsTimeWindow = '7d'; // Time window for statistics (e.g., '7d', '30d', '90d')

// Periods for consumption and cost data
var periods = [
    'this_hour', 'this_day', 'this_month', 'this_year',
    'last_hour', 'last_day', 'last_month', 'last_year'
];

// Summary statistics to calculate
var summaryStatistics = ['min', 'max', 'p20', 'p50', 'p80'];

// ============================================================================
// STATE CREATION - ENERGY PRICES
// ============================================================================

/**
 * Create states for current energy price data
 */
function createPriceStates() {
    // Current price value
    createState(`${stateBasePath}.energy_price_euro`, 0, {
        desc: 'Current electricity price',
        type: 'number',
        role: 'value',
        unit: 'Euro'
    });

    // Price rank (0.0-1.0, where 0.0 is cheapest)
    createState(`${stateBasePath}.energy_price_rank`, 0, {
        desc: 'Current electricity price level compared to historical values',
        type: 'number',
        role: 'value'
    });

    // Timestamp of last price update
    createState(`${stateBasePath}.energy_price_euro_ts`, 0, {
        desc: 'Timestamp of last electricity price update',
        type: 'number',
        role: 'value'
    });

    // Price statistics over time window
    summaryStatistics.forEach(function(stat) {
        createState(`${stateBasePath}.energy_price_euro_${stat}`, 0, {
            desc: `Electricity price ${stat} over last ${statisticsTimeWindow}`,
            type: 'number',
            role: 'value',
            unit: 'Euro'
        });
    });
}

// ============================================================================
// STATE CREATION - ENERGY CONSUMPTION
// ============================================================================

/**
 * Create states for energy consumption data (grid source)
 */
function createConsumptionStates() {
    periods.forEach(function(period) {
        // Current consumption value
        createState(`${stateBasePath}.consumption_grid_${period}`, 0, {
            desc: `Energy consumption from grid (${period})`,
            type: 'number',
            role: 'value',
            unit: 'kWh'
        });

        // Timestamp of last update for this period
        createState(`${stateBasePath}.consumption_grid_${period}_ts`, 0, {
            desc: `Timestamp of last update for grid consumption (${period})`,
            type: 'number',
            role: 'value'
        });

        // Summary statistics for this period
        summaryStatistics.forEach(function(stat) {
            createState(`${stateBasePath}.consumption_grid_${period}_${stat}`, 0, {
                desc: `Grid consumption ${stat} for ${period} over last ${statisticsTimeWindow}`,
                type: 'number',
                role: 'value',
                unit: 'kWh'
            });
        });
    });
}

// ============================================================================
// STATE CREATION - ENERGY COSTS
// ============================================================================

/**
 * Create states for energy cost data
 */
function createCostStates() {
    periods.forEach(function(period) {
        // Current cost value
        createState(`${stateBasePath}.cost_${period}`, 0, {
            desc: `Energy cost (${period})`,
            type: 'number',
            role: 'value',
            unit: 'Euro'
        });

        // Timestamp of last update for this period
        createState(`${stateBasePath}.cost_${period}_ts`, 0, {
            desc: `Timestamp of last update for energy cost (${period})`,
            type: 'number',
            role: 'value'
        });

        // Summary statistics for this period
        summaryStatistics.forEach(function(stat) {
            createState(`${stateBasePath}.cost_${period}_${stat}`, 0, {
                desc: `Energy cost ${stat} for ${period} over last ${statisticsTimeWindow}`,
                type: 'number',
                role: 'value',
                unit: 'Euro'
            });
        });
    });
}

// ============================================================================
// QUERY FUNCTIONS - ENERGY PRICES
// ============================================================================

/**
 * Query current energy price and statistics from InfluxDB
 */
function queryInfluxDBTibberPrices() {
    // Query 1: Get latest energy price and rank
    sendTo('influxdb.0', 'query', 
        "SELECT * FROM home_monitoring.autogen.electricity_prices_euro ORDER BY time DESC LIMIT 1", 
        function(result) {
            if (result.error) {
                console.error('[Tibber Prices] Query error:', result.error);
                return;
            }

            if (result.result && result.result[0] && result.result[0].length > 0) {
                var row = result.result[0][0];
                
                // Update current price and rank
                setState(`${stateBasePath}.energy_price_euro`, row.total);
                setState(`${stateBasePath}.energy_price_rank`, row.rank);
                
                // Update timestamp (convert from InfluxDB timestamp to milliseconds)
                if (row.ts) {
                    var timestamp = Math.floor(new Date(row.ts).getTime());
                    setState(`${stateBasePath}.energy_price_euro_ts`, timestamp);
                }
            } else {
                console.warn('[Tibber Prices] No price data returned from InfluxDB');
            }
        }
    );

    // Query 2: Get price statistics over time window
    var statsQuery = `SELECT MIN("total"), MAX("total"), PERCENTILE("total", 20), PERCENTILE("total", 50), PERCENTILE("total", 80) FROM home_monitoring.autogen.electricity_prices_euro WHERE time > now() - ${statisticsTimeWindow}`;
    
    sendTo('influxdb.0', 'query', statsQuery, function(result) {
        if (result.error) {
            console.error('[Tibber Price Stats] Query error:', result.error);
            return;
        }

        if (result.result && result.result[0] && result.result[0].length > 0) {
            var row = result.result[0][0];
            
            // Update statistics states
            setState(`${stateBasePath}.energy_price_euro_min`, row.min);
            setState(`${stateBasePath}.energy_price_euro_max`, row.max);
            setState(`${stateBasePath}.energy_price_euro_p20`, row.percentile);
            setState(`${stateBasePath}.energy_price_euro_p50`, row.percentile_1);
            setState(`${stateBasePath}.energy_price_euro_p80`, row.percentile_2);
        } else {
            console.warn('[Tibber Price Stats] No statistics data returned from InfluxDB');
        }
    });
}

// ============================================================================
// QUERY FUNCTIONS - ENERGY CONSUMPTION
// ============================================================================

/**
 * Query energy consumption data from InfluxDB
 */
function queryInfluxDBTibberConsumption() {
    // Query 1: Get latest consumption values for all periods (grid source)
    var currentQuery = "SELECT last(*) FROM home_monitoring.autogen.electricity_consumption_kwh WHERE source = 'grid' GROUP BY period";
    
    sendTo('influxdb.0', 'query', currentQuery, function(result) {
        if (result.error) {
            console.error('[Tibber Consumption] Query error:', result.error);
            return;
        }

        if (!result.result || !result.result[0]) {
            console.warn('[Tibber Consumption] No consumption data returned from InfluxDB');
            return;
        }

        // Process each period's data
        result.result[0].forEach(function(row) {
            var period = row.period;
            var consumption = row.last_consumption;
            
            // Update consumption state for this period
            if (period && consumption !== undefined) {
                setState(`${stateBasePath}.consumption_grid_${period}`, consumption);
                
                // Update timestamp for this period
                if (row.ts) {
                    var timestamp = Math.floor(new Date(row.ts).getTime());
                    setState(`${stateBasePath}.consumption_grid_${period}_ts`, timestamp);
                }
            }
        });
    });

    // Query 2: Get consumption statistics for all periods (single query with GROUP BY)
    var statsQuery = `SELECT MIN("consumption"), MAX("consumption"), PERCENTILE("consumption", 20), PERCENTILE("consumption", 50), PERCENTILE("consumption", 80) FROM home_monitoring.autogen.electricity_consumption_kwh WHERE source = 'grid' AND time > now() - ${statisticsTimeWindow} GROUP BY period`;
    
    sendTo('influxdb.0', 'query', statsQuery, function(result) {
        if (result.error) {
            console.error('[Tibber Consumption Stats] Query error:', result.error);
            return;
        }

        if (!result.result || !result.result[0]) {
            console.warn('[Tibber Consumption Stats] No statistics data returned from InfluxDB');
            return;
        }

        // Process statistics for each period
        result.result[0].forEach(function(row) {
            var period = row.period;
            
            if (period) {
                setState(`${stateBasePath}.consumption_grid_${period}_min`, row.min);
                setState(`${stateBasePath}.consumption_grid_${period}_max`, row.max);
                setState(`${stateBasePath}.consumption_grid_${period}_p20`, row.percentile);
                setState(`${stateBasePath}.consumption_grid_${period}_p50`, row.percentile_1);
                setState(`${stateBasePath}.consumption_grid_${period}_p80`, row.percentile_2);
            }
        });
    });
}

// ============================================================================
// QUERY FUNCTIONS - ENERGY COSTS
// ============================================================================

/**
 * Query energy cost data from InfluxDB
 */
function queryInfluxDBTibberCosts() {
    // Query 1: Get latest cost values for all periods
    var currentQuery = "SELECT last(*) FROM home_monitoring.autogen.electricity_costs_euro GROUP BY period";
    
    sendTo('influxdb.0', 'query', currentQuery, function(result) {
        if (result.error) {
            console.error('[Tibber Costs] Query error:', result.error);
            return;
        }

        if (!result.result || !result.result[0]) {
            console.warn('[Tibber Costs] No cost data returned from InfluxDB');
            return;
        }

        // Process each period's data
        result.result[0].forEach(function(row) {
            var period = row.period;
            var cost = row.last_cost;
            
            // Update cost state for this period
            if (period && cost !== undefined) {
                setState(`${stateBasePath}.cost_${period}`, cost);
                
                // Update timestamp for this period
                if (row.ts) {
                    var timestamp = Math.floor(new Date(row.ts).getTime());
                    setState(`${stateBasePath}.cost_${period}_ts`, timestamp);
                }
            }
        });
    });

    // Query 2: Get cost statistics for all periods (single query with GROUP BY)
    var statsQuery = `SELECT MIN("cost"), MAX("cost"), PERCENTILE("cost", 20), PERCENTILE("cost", 50), PERCENTILE("cost", 80) FROM home_monitoring.autogen.electricity_costs_euro WHERE time > now() - ${statisticsTimeWindow} GROUP BY period`;
    
    sendTo('influxdb.0', 'query', statsQuery, function(result) {
        if (result.error) {
            console.error('[Tibber Cost Stats] Query error:', result.error);
            return;
        }

        if (!result.result || !result.result[0]) {
            console.warn('[Tibber Cost Stats] No statistics data returned from InfluxDB');
            return;
        }

        // Process statistics for each period
        result.result[0].forEach(function(row) {
            var period = row.period;
            
            if (period) {
                setState(`${stateBasePath}.cost_${period}_min`, row.min);
                setState(`${stateBasePath}.cost_${period}_max`, row.max);
                setState(`${stateBasePath}.cost_${period}_p20`, row.percentile);
                setState(`${stateBasePath}.cost_${period}_p50`, row.percentile_1);
                setState(`${stateBasePath}.cost_${period}_p80`, row.percentile_2);
            }
        });
    });
}

// ===========================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main function to query all Tibber data from InfluxDB
 */
function queryInfluxDBTibber() {
    console.log('[Tibber Integration] Starting data collection from InfluxDB');
    
    queryInfluxDBTibberPrices();
    queryInfluxDBTibberConsumption();
    queryInfluxDBTibberCosts();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Create all states on script start
createPriceStates();
createConsumptionStates();
createCostStates();

// Wait for states to be created before running first query (createState is async)
setTimeout(function() {
    queryInfluxDBTibber();
}, 2000);

// Schedule to run every 15 minutes (at 1, 16, 31, 46 minutes past the hour)
schedule("1,16,31,46 * * * *", queryInfluxDBTibber);

console.log('[Tibber Integration] Script initialized and scheduled');
