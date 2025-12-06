# ioBroker Integration Scripts

This directory contains JavaScript scripts for integrating Home Monitoring data with ioBroker.

## Overview

ioBroker is a home automation platform that can visualize and control smart home devices. These scripts pull data from InfluxDB (populated by the Home Monitoring Python services) and create ioBroker states for use in dashboards and automations.

## Architecture

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│ Tibber API      │────────>│ Python       │────────>│ InfluxDB    │
│ (External)      │         │ Service      │         │ Database    │
└─────────────────┘         └──────────────┘         └─────────────┘
                                                             │
                                                             │ Query
                                                             ▼
                                                      ┌─────────────┐
                                                      │ ioBroker    │
                                                      │ JavaScript  │
                                                      └─────────────┘
                                                             │
                                                             ▼
                                                      ┌─────────────┐
                                                      │ ioBroker    │
                                                      │ States      │
                                                      └─────────────┘
```

## Scripts

### `tibber_states.js`

Pulls Tibber electricity data from InfluxDB and creates ioBroker states.

**Data Categories:**
- **Energy Prices**: Current price, rank, and statistics (min/max/percentiles)
- **Energy Consumption**: Grid consumption for various periods with statistics
- **Energy Costs**: Total costs for various periods with statistics

**Periods Supported:**
- `this_hour` - Current incomplete hour
- `this_day` - Today (completed hours)
- `this_month` - Current month (completed days + today)
- `this_year` - Current year (completed months + this month)
- `last_hour` - Previous completed hour
- `last_day` - Yesterday
- `last_month` - Previous completed month
- `last_year` - Previous completed year

**Schedule:** Runs every 15 minutes (at 1, 16, 31, 46 minutes past the hour)

## Installation

### Prerequisites

1. **ioBroker** installed and running
2. **InfluxDB adapter** (`influxdb.0`) configured in ioBroker
3. **Home Monitoring Python services** running and populating InfluxDB

### Setup Steps

1. **Configure InfluxDB Adapter in ioBroker:**
   - Install the InfluxDB adapter if not already installed
   - Configure connection to your InfluxDB instance
   - Database: `home_monitoring`
   - Test the connection

2. **Install the Script:**
   - Open ioBroker Admin interface
   - Navigate to "Scripts" (JavaScript adapter)
   - Create a new script in the "global" or "common" folder
   - Copy the contents of `tibber_states.js`
   - Save and enable the script

3. **Verify States are Created:**
   - Navigate to "Objects" in ioBroker Admin
   - Look for `javascript.0.tibber_energy.*` states
   - Verify states are being populated with data

## Configuration

### Adjustable Parameters

Edit these variables at the top of `tibber_states.js`:

```javascript
// Base path for all created states
var stateBasePath = 'javascript.0.tibber_energy';

// Time window for calculating statistics (min/max/percentiles)
var statisticsTimeWindow = '7d';  // Options: '7d', '30d', '90d', etc.

// Periods to track
var periods = [
    'this_hour', 'this_day', 'this_month', 'this_year',
    'last_hour', 'last_day', 'last_month', 'last_year'
];

// Statistics to calculate
var summaryStatistics = ['min', 'max', 'p20', 'p50', 'p80'];
```

### Schedule Customization

To change the update frequency, modify the schedule line:

```javascript
// Current: Every 15 minutes
schedule("1,16,31,46 * * * *", queryInfluxDBTibber);

// Examples:
// Every 5 minutes: schedule("*/5 * * * *", queryInfluxDBTibber);
// Every hour: schedule("0 * * * *", queryInfluxDBTibber);
// Every 30 minutes: schedule("0,30 * * * *", queryInfluxDBTibber);
```

## State Structure

### Energy Price States

| State | Description | Unit | Type |
|-------|-------------|------|------|
| `energy_price_euro` | Current electricity price | Euro | number |
| `energy_price_rank` | Price rank (0.0=cheapest, 1.0=most expensive) | - | number |
| `energy_price_euro_ts` | Timestamp of last update | ms | number |
| `energy_price_euro_min` | Minimum price in time window | Euro | number |
| `energy_price_euro_max` | Maximum price in time window | Euro | number |
| `energy_price_euro_p20` | 20th percentile price | Euro | number |
| `energy_price_euro_p50` | 50th percentile (median) price | Euro | number |
| `energy_price_euro_p80` | 80th percentile price | Euro | number |

### Energy Consumption States (per period)

| State Pattern | Description | Unit | Type |
|---------------|-------------|------|------|
| `consumption_grid_{period}` | Grid consumption for period | kWh | number |
| `consumption_grid_{period}_ts` | Timestamp of last update | ms | number |
| `consumption_grid_{period}_min` | Minimum consumption in time window | kWh | number |
| `consumption_grid_{period}_max` | Maximum consumption in time window | kWh | number |
| `consumption_grid_{period}_p20` | 20th percentile consumption | kWh | number |
| `consumption_grid_{period}_p50` | 50th percentile consumption | kWh | number |
| `consumption_grid_{period}_p80` | 80th percentile consumption | kWh | number |

### Energy Cost States (per period)

| State Pattern | Description | Unit | Type |
|---------------|-------------|------|------|
| `cost_{period}` | Total cost for period | Euro | number |
| `cost_{period}_ts` | Timestamp of last update | ms | number |
| `cost_{period}_min` | Minimum cost in time window | Euro | number |
| `cost_{period}_max` | Maximum cost in time window | Euro | number |
| `cost_{period}_p20` | 20th percentile cost | Euro | number |
| `cost_{period}_p50` | 50th percentile cost | Euro | number |
| `cost_{period}_p80` | 80th percentile cost | Euro | number |

## Data Consistency

### InfluxDB Measurements

The script queries these InfluxDB measurements:

1. **`electricity_prices_euro`**
   - Fields: `total` (price), `rank` (0.0-1.0)
   - Tags: None

2. **`electricity_consumption_kwh`**
   - Fields: `consumption` (kWh)
   - Tags: `period`, `source` (grid/solar)

3. **`electricity_costs_euro`**
   - Fields: `cost` (Euro)
   - Tags: `period`

### Period Definitions

Periods are defined consistently with the Python service:

- **`this_hour`**: Current incomplete hour (NOT included in `this_day`)
- **`this_day`**: Completed hours 0 to current_hour-1
- **`this_month`**: Completed days + `this_day`
- **`this_year`**: Completed months + `this_month`
- **`last_hour`**: Previous completed hour
- **`last_day`**: Yesterday (previous completed day)
- **`last_month`**: Previous completed month
- **`last_year`**: Previous completed year

## Troubleshooting

### No Data in States

1. **Check InfluxDB Connection:**
   ```javascript
   // In ioBroker JavaScript console
   sendTo('influxdb.0', 'query', 'SHOW DATABASES', function(result) {
       console.log(result);
   });
   ```

2. **Verify Data in InfluxDB:**
   ```bash
   docker exec -it influxdb influx
   USE home_monitoring
   SELECT * FROM electricity_prices_euro ORDER BY time DESC LIMIT 1
   SELECT * FROM electricity_consumption_kwh WHERE source='grid' ORDER BY time DESC LIMIT 10
   SELECT * FROM electricity_costs_euro ORDER BY time DESC LIMIT 10
   ```

3. **Check Script Logs:**
   - Open ioBroker Admin → Scripts
   - View the script's log output
   - Look for error messages with `[Tibber ...]` prefix

### States Not Updating

1. **Verify Python Service is Running:**
   ```bash
   # Check if Tibber data collection is running
   ps aux | grep collect_tibber_data
   ```

2. **Check Python Service Logs:**
   ```bash
   # View recent Tibber collection logs
   tail -f /var/log/home_monitoring/tibber.log
   ```

3. **Verify Schedule is Active:**
   - Check that the script is enabled in ioBroker
   - Verify the schedule line is not commented out

### Incorrect Values

1. **Check Time Window:**
   - Ensure `statisticsTimeWindow` has enough data
   - Try increasing to `'30d'` if `'7d'` shows no statistics

2. **Verify InfluxDB Query Results:**
   - Add debug logging to see raw query results:
   ```javascript
   console.log('[Debug] Query result:', JSON.stringify(result));
   ```

## Dashboard Examples

### VIS Dashboard Widget

Example using the states in a VIS dashboard:

```javascript
// Current price with color coding based on rank
{
  "tpl": "tplValueFloat",
  "data": {
    "oid": "javascript.0.tibber_energy.energy_price_euro",
    "factor": "1",
    "decimals": "4",
    "unit": "€/kWh"
  },
  "style": {
    "color": "{javascript.0.tibber_energy.energy_price_rank} < 0.35 ? 'green' : {javascript.0.tibber_energy.energy_price_rank} > 0.65 ? 'red' : 'orange'"
  }
}
```

### Grafana Alternative

While these scripts are for ioBroker, you can also visualize the same InfluxDB data in Grafana:

```sql
-- Current price
SELECT "total" FROM "electricity_prices_euro" 
WHERE time >= now() - 1h 
ORDER BY time DESC LIMIT 1

-- Today's consumption
SELECT last("consumption") FROM "electricity_consumption_kwh" 
WHERE "period" = 'this_day' AND "source" = 'grid'
```

## Testing

See `TESTING.md` for comprehensive testing procedures.

## Contributing

When modifying these scripts:

1. Maintain consistency with Python service data structures
2. Add appropriate error handling and logging
3. Update documentation
4. Test with actual InfluxDB data
5. Verify state creation and updates

## References

- [ioBroker Documentation](https://www.iobroker.net/)
- [InfluxDB Adapter](https://github.com/ioBroker/ioBroker.influxdb)
- [Home Monitoring InfluxDB Documentation](../../INFLUXDB_MEASUREMENTS_DOCUMENTATION.md)
- [Tibber Python Service](../../src/home_monitoring/services/tibber/)

## License

MIT License - see LICENSE file in repository root
