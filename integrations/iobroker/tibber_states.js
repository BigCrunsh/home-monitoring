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

var stateBasePath = 'javascript.0.tibber_states';

// Periods for consumption and cost data
var periods = [
    'this_hour', 'this_day', 'this_month', 'this_year',
    'last_hour', 'last_day', 'last_month', 'last_year'
];

// Summary statistics to calculate
var summaryStatistics = ['min', 'max', 'p20', 'p50', 'p80'];

// Statistics configuration per period
var periodStatsConfig = {
    'this_hour': { stats: ['max'], timeWindow: '24h' },
    'this_day': { stats: ['max'], timeWindow: '30d' },
    'this_month': { stats: ['max'], timeWindow: '12M' },
    'this_year': { stats: ['max'], timeWindow: '12M' },
    'last_hour': { stats: ['min', 'max', 'p20', 'p50', 'p80'], timeWindow: '24h' },
    'last_day': { stats: ['min', 'max', 'p20', 'p50', 'p80'], timeWindow: '30d' },
    'last_month': { stats: ['min', 'max', 'p20', 'p50', 'p80'], timeWindow: '12M' },
    'last_year': { stats: [], timeWindow: null }
};

// Price statistics configuration
var priceStatsConfig = {
    stats: ['min', 'max', 'p20', 'p50', 'p80'],
    timeWindow: '7d'
};

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
    priceStatsConfig.stats.forEach(function(stat) {
        createState(`${stateBasePath}.energy_price_euro_${stat}`, 0, {
            desc: `Electricity price ${stat} over last ${priceStatsConfig.timeWindow}`,
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

        // Summary statistics for this period (based on period configuration)
        var config = periodStatsConfig[period];
        if (config && config.stats.length > 0) {
            config.stats.forEach(function(stat) {
                var timeDesc = config.timeWindow ? ` over last ${config.timeWindow}` : '';
                createState(`${stateBasePath}.consumption_grid_${period}_${stat}`, 0, {
                    desc: `Grid consumption ${stat} for ${period}${timeDesc}`,
                    type: 'number',
                    role: 'value',
                    unit: 'kWh'
                });
            });
        }
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

        // Summary statistics for this period (based on period configuration)
        var config = periodStatsConfig[period];
        if (config && config.stats.length > 0) {
            config.stats.forEach(function(stat) {
                var timeDesc = config.timeWindow ? ` over last ${config.timeWindow}` : '';
                createState(`${stateBasePath}.cost_${period}_${stat}`, 0, {
                    desc: `Energy cost ${stat} for ${period}${timeDesc}`,
                    type: 'number',
                    role: 'value',
                    unit: 'Euro'
                });
            });
        }
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
    var statsQuery = `SELECT MIN("total"), MAX("total"), PERCENTILE("total", 20), PERCENTILE("total", 50), PERCENTILE("total", 80) FROM home_monitoring.autogen.electricity_prices_euro WHERE time > now() - ${priceStatsConfig.timeWindow}`;
    
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

    // Query 2: Get consumption statistics for each period with appropriate time windows
    periods.forEach(function(period) {
        var config = periodStatsConfig[period];
        
        // Skip periods without statistics
        if (!config || config.stats.length === 0) {
            return;
        }
        
        // Build query based on period type
        var statsQuery;
        if (period.startsWith('this_')) {
            // For this_* periods, just get MAX from current period within time window
            var timeWindow = config.timeWindow;
            statsQuery = `SELECT MAX("consumption") FROM home_monitoring.autogen.electricity_consumption_kwh WHERE source = 'grid' AND period = '${period}' AND time > now() - ${timeWindow}`;
        } else {
            // For last_* periods, get statistics from unique period values over time window
            // Use LAST() to get one value per day/hour/month, then calculate statistics
            var timeWindow = config.timeWindow;
            var groupByTime;
            
            if (period === 'last_hour') {
                groupByTime = '1h'; // One value per hour over last 24 hours
            } else if (period === 'last_day') {
                groupByTime = '1d'; // One value per day over last 30 days
            } else if (period === 'last_month') {
                groupByTime = '30d'; // One value per month over last 12 months
            }
            
            statsQuery = `SELECT MIN(last_val), MAX(last_val), PERCENTILE(last_val, 20), PERCENTILE(last_val, 50), PERCENTILE(last_val, 80) FROM (SELECT LAST("consumption") AS last_val FROM home_monitoring.autogen.electricity_consumption_kwh WHERE source = 'grid' AND period = '${period}' AND time > now() - ${timeWindow} GROUP BY time(${groupByTime}))`;
        }
        
        sendTo('influxdb.0', 'query', statsQuery, function(result) {
            if (result.error) {
                console.error(`[Tibber Consumption Stats ${period}] Query error:`, result.error);
                return;
            }

            if (!result.result || !result.result[0] || result.result[0].length === 0) {
                return;
            }

            var row = result.result[0][0];
            
            // Update statistics states based on what's configured for this period
            if (config.stats.indexOf('min') >= 0 && row.min !== undefined) {
                setState(`${stateBasePath}.consumption_grid_${period}_min`, row.min);
            }
            if (config.stats.indexOf('max') >= 0 && row.max !== undefined) {
                setState(`${stateBasePath}.consumption_grid_${period}_max`, row.max);
            }
            if (config.stats.indexOf('p20') >= 0 && row.percentile !== undefined) {
                setState(`${stateBasePath}.consumption_grid_${period}_p20`, row.percentile);
            }
            if (config.stats.indexOf('p50') >= 0 && row.percentile_1 !== undefined) {
                setState(`${stateBasePath}.consumption_grid_${period}_p50`, row.percentile_1);
            }
            if (config.stats.indexOf('p80') >= 0 && row.percentile_2 !== undefined) {
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

    // Query 2: Get cost statistics for each period with appropriate time windows
    periods.forEach(function(period) {
        var config = periodStatsConfig[period];
        
        // Skip periods without statistics
        if (!config || config.stats.length === 0) {
            return;
        }
        
        // Build query based on period type
        var statsQuery;
        if (period.startsWith('this_')) {
            // For this_* periods, just get MAX from current period within time window
            var timeWindow = config.timeWindow;
            statsQuery = `SELECT MAX("cost") FROM home_monitoring.autogen.electricity_costs_euro WHERE period = '${period}' AND time > now() - ${timeWindow}`;
        } else {
            // For last_* periods, get statistics from unique period values over time window
            // Use LAST() to get one value per day/hour/month, then calculate statistics
            var timeWindow = config.timeWindow;
            var groupByTime;
            
            if (period === 'last_hour') {
                groupByTime = '1h'; // One value per hour over last 24 hours
            } else if (period === 'last_day') {
                groupByTime = '1d'; // One value per day over last 30 days
            } else if (period === 'last_month') {
                groupByTime = '30d'; // One value per month over last 12 months
            }
            
            statsQuery = `SELECT MIN(last_val), MAX(last_val), PERCENTILE(last_val, 20), PERCENTILE(last_val, 50), PERCENTILE(last_val, 80) FROM (SELECT LAST("cost") AS last_val FROM home_monitoring.autogen.electricity_costs_euro WHERE period = '${period}' AND time > now() - ${timeWindow} GROUP BY time(${groupByTime}))`;
        }
        
        sendTo('influxdb.0', 'query', statsQuery, function(result) {
            if (result.error) {
                console.error(`[Tibber Cost Stats ${period}] Query error:`, result.error);
                return;
            }

            if (!result.result || !result.result[0] || result.result[0].length === 0) {
                return;
            }

            var row = result.result[0][0];
            
            // Update statistics states based on what's configured for this period
            if (config.stats.indexOf('min') >= 0 && row.min !== undefined) {
                setState(`${stateBasePath}.cost_${period}_min`, row.min);
            }
            if (config.stats.indexOf('max') >= 0 && row.max !== undefined) {
                setState(`${stateBasePath}.cost_${period}_max`, row.max);
            }
            if (config.stats.indexOf('p20') >= 0 && row.percentile !== undefined) {
                setState(`${stateBasePath}.cost_${period}_p20`, row.percentile);
            }
            if (config.stats.indexOf('p50') >= 0 && row.percentile_1 !== undefined) {
                setState(`${stateBasePath}.cost_${period}_p50`, row.percentile_1);
            }
            if (config.stats.indexOf('p80') >= 0 && row.percentile_2 !== undefined) {
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
