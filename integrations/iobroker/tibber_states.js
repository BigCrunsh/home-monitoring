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
 * Schedule: Runs every 5 minutes (at 1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56 minutes past the hour)
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
var influxAdapter = 'influxdb.0';

// Statistics configuration per period
var periodStatsConfig = {
    'this_hour': { stats: ['max'], timeWindow: '24h' },
    'this_day': { stats: ['max'], timeWindow: '30d' },
    'this_month': { stats: ['max'], timeWindow: '365d' },
    'this_year': { stats: ['max'], timeWindow: '365d' },
    'last_hour': { stats: ['min', 'max', 'p20', 'p50', 'p80'], timeWindow: '24h' },
    'last_day': { stats: ['min', 'max', 'p20', 'p50', 'p80'], timeWindow: '30d' },
    'last_month': { stats: ['min', 'max', 'p20', 'p50', 'p80'], timeWindow: '365d' },
    'last_year': { stats: [], timeWindow: null }
};

// Derive periods from configuration
var periods = Object.keys(periodStatsConfig);

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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build statistics query for a given period
 * @param {string} metric - Field name (e.g., 'consumption', 'cost')
 * @param {string} measurement - InfluxDB measurement name
 * @param {string} period - Period name
 * @param {Object} config - Period configuration
 * @param {string} sourceFilter - Optional WHERE clause for source filtering
 * @returns {string} InfluxDB query string
 */
function buildStatsQuery(metric, measurement, period, config, sourceFilter) {
    var whereClause = sourceFilter || '';
    
    if (period.startsWith('this_')) {
        // For this_* periods, just get MAX from current period within time window
        // Use alias 'max' to match INFLUX_FIELD_MAPPING
        return `SELECT MAX("${metric}") AS max FROM home_monitoring.autogen.${measurement} WHERE ${whereClause}period = '${period}' AND time > now() - ${config.timeWindow}`;
    } else {
        // For last_* periods, get statistics from unique period values over time window
        // Use aliases to match INFLUX_FIELD_MAPPING exactly
        var groupByTime;
        if (period === 'last_hour') {
            groupByTime = '1h';
        } else if (period === 'last_day') {
            groupByTime = '1d';
        } else if (period === 'last_month') {
            groupByTime = '30d';
        }
        
        return `SELECT MIN(last_val) AS min, MAX(last_val) AS max, PERCENTILE(last_val, 20) AS p20, PERCENTILE(last_val, 50) AS p50, PERCENTILE(last_val, 80) AS p80 FROM (SELECT LAST("${metric}") AS last_val FROM home_monitoring.autogen.${measurement} WHERE ${whereClause}period = '${period}' AND time > now() - ${config.timeWindow} GROUP BY time(${groupByTime}))`;
    }
}

/**
 * Update statistics states for a given metric and period
 * @param {string} metricType - Type of metric ('consumption_grid' or 'cost')
 * @param {string} period - Period name
 * @param {Object} row - Query result row
 * @param {Object} config - Period configuration
 */
function updatePeriodStats(metricType, period, row, config) {
    config.stats.forEach(function(stat) {
        if (row[stat] !== undefined) {
            setState(`${stateBasePath}.${metricType}_${period}_${stat}`, row[stat]);
        }
    });
}

/**
 * Query statistics for all periods of a given metric
 * @param {string} metricType - Type of metric ('consumption_grid' or 'cost')
 * @param {string} metric - Field name in InfluxDB
 * @param {string} measurement - InfluxDB measurement name
 * @param {string} sourceFilter - Optional WHERE clause for source filtering
 */
function queryPeriodStatistics(metricType, metric, measurement, sourceFilter) {
    periods.forEach(function(period) {
        var config = periodStatsConfig[period];
        
        // Skip periods without statistics
        if (!config || config.stats.length === 0) {
            return;
        }
        
        var statsQuery = buildStatsQuery(metric, measurement, period, config, sourceFilter);
        
        sendTo(influxAdapter, 'query', statsQuery, function(result) {
            if (result.error) {
                console.error(`[Tibber ${metricType} Stats ${period}] Query error: ${JSON.stringify(result.error)}`);
                console.error(`[Tibber ${metricType} Stats ${period}] Failed query: ${statsQuery}`);
                return;
            }

            if (!result.result || !result.result[0] || result.result[0].length === 0) {
                console.warn(`[Tibber ${metricType} Stats ${period}] No statistics data returned`);
                return;
            }

            updatePeriodStats(metricType, period, result.result[0][0], config);
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
    sendTo(influxAdapter, 'query', 
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
    // Use stat names directly as aliases
    var statsQuery = `SELECT MIN("total") AS min, MAX("total") AS max, PERCENTILE("total", 20) AS p20, PERCENTILE("total", 50) AS p50, PERCENTILE("total", 80) AS p80 FROM home_monitoring.autogen.electricity_prices_euro WHERE time > now() - ${priceStatsConfig.timeWindow}`;
    
    sendTo(influxAdapter, 'query', statsQuery, function(result) {
        if (result.error) {
            console.error('[Tibber Price Stats] Query error:', result.error);
            return;
        }

        if (result.result && result.result[0] && result.result[0].length > 0) {
            var row = result.result[0][0];
            
            // Update statistics states directly using stat names
            priceStatsConfig.stats.forEach(function(stat) {
                if (row[stat] !== undefined) {
                    setState(`${stateBasePath}.energy_price_euro_${stat}`, row[stat]);
                }
            });
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
    
    sendTo(influxAdapter, 'query', currentQuery, function(result) {
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

            // InfluxDB carries more period tags than this script exposes as
            // states (e.g. last_24h, yesterday) — only set configured ones
            if (period && !periodStatsConfig.hasOwnProperty(period)) {
                return;
            }

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

    // Query 2: Get consumption statistics using helper function
    queryPeriodStatistics('consumption_grid', 'consumption', 'electricity_consumption_kwh', "source = 'grid' AND ");
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
    
    sendTo(influxAdapter, 'query', currentQuery, function(result) {
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

            // InfluxDB carries more period tags than this script exposes as
            // states (e.g. last_24h) — only set configured ones
            if (period && !periodStatsConfig.hasOwnProperty(period)) {
                return;
            }

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

    // Query 2: Get cost statistics using helper function
    queryPeriodStatistics('cost', 'cost', 'electricity_costs_euro', '');
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

// Initialize script
console.log('[Tibber Integration] Initializing...');

// Create all states on script start
createPriceStates();
createConsumptionStates();
createCostStates();


// ============================================================================
// PRICE FORECAST CHART (SVG, rendered by a vis HTML widget)
// ============================================================================

createState(`${stateBasePath}.price_forecast_chart`, '', {
    desc: 'Preis-Forecast als SVG (heute + morgen, 15-min-Aufloesung)',
    type: 'string',
    role: 'html'
});

function berlinParts(ts) {
    // the Pi runs Europe/London; the household clock is Europe/Berlin
    var s = new Date(ts).toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit',
        weekday: 'short', hour12: false
    });
    // e.g. "Do., 14:00"
    var m = s.match(/(\w+)\.?,?\s+(\d+):(\d+)/);
    return m ? { day: m[1], hour: parseInt(m[2], 10), minute: parseInt(m[3], 10) } : null;
}

function renderPriceForecastChart(rows) {
    // Elegant colored-line/area chart on the dashboard design system (Figtree, palette).
    var W = 1154, H = 74, PT = 20, PB = 12, PX = 5;
    var GREEN = '#b5fb5b', AMBER = '#F1BE3D', RED = '#A00629', MUT = '#8A8A8A', BORD = '#262a33';
    var head = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ' + W + ' ' + H + '">'
        + '<defs><linearGradient id="fcf" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0" stop-color="rgba(138,138,138,0.20)"/><stop offset="1" stop-color="rgba(138,138,138,0)"/>'
        + '</linearGradient></defs>'
        + "<style>@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');"
        + 'text{font-family:Figtree,system-ui,sans-serif;font-variant-numeric:tabular-nums}</style>';
    if (!rows.length) {
        return head + '<text x="577" y="40" fill="' + MUT + '" font-size="14" '
            + 'text-anchor="middle">kein Preis-Forecast verf\u00fcgbar</text></svg>';
    }

    var totals = rows.map(function (r) { return r.total; });
    var maxV = Math.max.apply(null, totals), minV = Math.min.apply(null, totals);
    var p20s = getState(stateBasePath + '.energy_price_euro_p20');
    var p80s = getState(stateBasePath + '.energy_price_euro_p80');
    var p20 = (p20s && typeof p20s.val === 'number') ? p20s.val : minV + (maxV - minV) / 3;
    var p80 = (p80s && typeof p80s.val === 'number') ? p80s.val : minV + 2 * (maxV - minV) / 3;

    var now = Date.now(), slotMs = 15 * 60000, n = rows.length;
    // amplify the (often small) variation: baseline below min, a little headroom above
    var lo = Math.max(0, minV - (maxV - minV) * 0.35), hi = maxV + (maxV - minV) * 0.12;
    if (hi <= lo) { hi = lo + 0.1; }
    var plotH = H - PT - PB, baseY = PT + plotH;
    function X(i) { return PX + (i / (n - 1)) * (W - 2 * PX); }
    function Y(v) { return PT + plotH - ((v - lo) / (hi - lo)) * plotH; }
    function band(v) { return v <= p20 ? GREEN : (v >= p80 ? RED : AMBER); }
    function euro(v) { return v.toFixed(2).replace('.', ','); }
    var parts = [head];

    // cheapest contiguous 2h window in the future
    var WIN = 8, bestStart = -1, bestSum = Infinity;
    for (var s = 0; s + WIN <= n; s++) {
        if (rows[s].ts + slotMs <= now) { continue; }
        var sum = 0; for (var k = s; k < s + WIN; k++) { sum += rows[k].total; }
        if (sum < bestSum) { bestSum = sum; bestStart = s; }
    }
    // soft cheap-window band (behind the curve)
    if (bestStart >= 0) {
        var wx0 = X(bestStart), wx1 = X(bestStart + WIN - 1);
        parts.push('<rect x="' + wx0.toFixed(1) + '" y="' + PT + '" width="' + (wx1 - wx0).toFixed(1)
            + '" height="' + plotH + '" rx="6" fill="rgba(181,251,91,0.10)"/>');
    }

    // area fill under the curve
    var area = 'M ' + X(0).toFixed(1) + ' ' + baseY.toFixed(1);
    rows.forEach(function (r, i) { area += ' L ' + X(i).toFixed(1) + ' ' + Y(r.total).toFixed(1); });
    area += ' L ' + X(n - 1).toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
    parts.push('<path d="' + area + '" fill="url(#fcf)"/>');

    // day separators + day labels (top) + hour ticks (bottom)
    rows.forEach(function (r, i) {
        var bp = berlinParts(r.ts); if (!bp || bp.minute !== 0) { return; }
        var x = X(i);
        if (bp.hour === 0 && i > 4) {
            parts.push('<line x1="' + x.toFixed(1) + '" y1="' + PT + '" x2="' + x.toFixed(1)
                + '" y2="' + baseY + '" stroke="' + BORD + '" stroke-width="1"/>');
            parts.push('<text x="' + (x + 5).toFixed(1) + '" y="' + (PT - 7) + '" fill="' + MUT
                + '" font-size="11" font-weight="600">' + bp.day + '</text>');
        } else if (bp.hour % 6 === 0 && x > 16 && x < W - 16) {
            parts.push('<text x="' + x.toFixed(1) + '" y="' + (H - 2) + '" fill="' + MUT
                + '" font-size="10" text-anchor="middle">' + bp.hour + '</text>');
        }
    });

    // the price curve as band-coloured segments
    var nowX = null, nowVal = null;
    for (var i = 0; i < n - 1; i++) {
        parts.push('<line x1="' + X(i).toFixed(1) + '" y1="' + Y(rows[i].total).toFixed(1)
            + '" x2="' + X(i + 1).toFixed(1) + '" y2="' + Y(rows[i + 1].total).toFixed(1)
            + '" stroke="' + band((rows[i].total + rows[i + 1].total) / 2) + '" stroke-width="2.2" stroke-linecap="round"/>');
        if (rows[i].ts <= now && now < rows[i].ts + slotMs) {
            nowX = X(i) + (X(i + 1) - X(i)) * ((now - rows[i].ts) / slotMs); nowVal = rows[i].total;
        }
    }

    // cheap-window label (top, green)
    if (bestStart >= 0) {
        var b1 = berlinParts(rows[bestStart].ts), b2 = berlinParts(rows[bestStart + WIN - 1].ts + slotMs);
        if (b1 && b2) {
            var fmt = function (p) { return p.hour + ':' + (p.minute < 10 ? '0' : '') + p.minute; };
            var avg = euro(bestSum / WIN);
            var nowIn = now >= rows[bestStart].ts && now < rows[bestStart + WIN - 1].ts + slotMs;
            var today = berlinParts(now);
            var dp = (!nowIn && b1 && today && b1.day !== today.day) ? b1.day + ' ' : '';
            var label = nowIn ? 'jetzt g\u00fcnstig \u00b7 \u00d8 ' + avg + ' \u20ac'
                : 'g\u00fcnstig ' + dp + fmt(b1) + '\u2013' + fmt(b2) + ' \u00b7 \u00d8 ' + avg + ' \u20ac';
            var lx = Math.min(Math.max((X(bestStart) + X(bestStart + WIN - 1)) / 2, 95), W - 95);
            parts.push('<text x="' + lx.toFixed(1) + '" y="' + (PT - 7) + '" fill="' + GREEN
                + '" font-size="11" font-weight="600" text-anchor="middle">' + label + '</text>');
        }
    }

    // now: subtle vertical line + a clean price pill (drawn last, on top)
    if (nowX !== null) {
        parts.push('<line x1="' + nowX.toFixed(1) + '" y1="' + PT + '" x2="' + nowX.toFixed(1)
            + '" y2="' + baseY + '" stroke="#ffffff" stroke-width="1.4" opacity="0.65"/>');
        var pw = 60, ph = 18, px = Math.min(Math.max(nowX - pw / 2, 2), W - pw - 2);
        parts.push('<rect x="' + px.toFixed(1) + '" y="1" width="' + pw + '" height="' + ph
            + '" rx="9" fill="#15161c" stroke="' + BORD + '"/>');
        parts.push('<text x="' + (px + pw / 2).toFixed(1) + '" y="14" fill="#ffffff" font-size="12" '
            + 'font-weight="700" text-anchor="middle">' + (nowVal !== null ? euro(nowVal) + ' \u20ac' : 'jetzt') + '</text>');
    }

    parts.push('</svg>');
    return parts.join('');
}

function buildPriceForecastChart() {
    sendTo(influxAdapter, 'query',
        'SELECT * FROM home_monitoring.autogen.electricity_price_forecast_euro'
        + ' WHERE time >= now() - 90m ORDER BY time ASC LIMIT 200',
        function (result) {
            if (result.error) {
                console.error('[Tibber Chart] ' + result.error);
                return;
            }
            var rows = (result.result && result.result[0]) || [];
            setState(`${stateBasePath}.price_forecast_chart`, renderPriceForecastChart(rows));
        }
    );
}

// Wait for states to be created before running first query (createState is async)
setTimeout(function() {
    queryInfluxDBTibber();
    buildPriceForecastChart();
}, 2000);

// Schedule to run every 5 minutes, 1 minute after collection script (*/5)
schedule("1,6,11,16,21,26,31,36,41,46,51,56 * * * *", function () {
    queryInfluxDBTibber();
    buildPriceForecastChart();
});

console.log('[Tibber Integration] Script initialized and scheduled');
