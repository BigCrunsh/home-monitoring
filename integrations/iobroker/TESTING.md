# Testing Guide for ioBroker Integration Scripts

This document provides comprehensive testing procedures for the ioBroker integration scripts.

## Testing Strategy

### Test Levels

1. **Syntax Validation** - Ensure JavaScript is valid
2. **InfluxDB Connectivity** - Verify database connection
3. **Data Retrieval** - Confirm queries return expected data
4. **State Creation** - Validate ioBroker states are created
5. **State Updates** - Verify states are updated with correct values
6. **End-to-End** - Test full data flow from Python service to ioBroker

## Prerequisites

Before testing:

- [ ] InfluxDB is running and accessible
- [ ] Home Monitoring Python services have populated data
- [ ] ioBroker is running with JavaScript adapter enabled
- [ ] InfluxDB adapter (`influxdb.0`) is configured

## 1. Syntax Validation

### Manual Validation

Check JavaScript syntax using Node.js:

```bash
# Navigate to the integration directory
cd integrations/iobroker

# Check syntax (Node.js must be installed)
node --check tibber_states.js
```

**Expected Output:** No output (syntax is valid)

**If errors:** Fix syntax errors before proceeding

### ioBroker Validation

1. Copy script to ioBroker Scripts editor
2. Save the script
3. Check for syntax errors in the editor

**Expected:** No red error indicators

## 2. InfluxDB Connectivity Test

### Test Database Connection

In ioBroker JavaScript console or as a test script:

```javascript
// Test 1: Check if InfluxDB adapter is available
sendTo('influxdb.0', 'query', 'SHOW DATABASES', function(result) {
    if (result.error) {
        console.error('InfluxDB connection failed:', result.error);
    } else {
        console.log('InfluxDB connection successful');
        console.log('Databases:', result.result);
    }
});

// Test 2: Verify home_monitoring database exists
sendTo('influxdb.0', 'query', 'SHOW MEASUREMENTS ON home_monitoring', function(result) {
    if (result.error) {
        console.error('Database query failed:', result.error);
    } else {
        console.log('Measurements in home_monitoring:', result.result);
    }
});
```

**Expected Output:**
```
InfluxDB connection successful
Databases: [Array with database names including 'home_monitoring']
Measurements in home_monitoring: [Array including 'electricity_prices_euro', 'electricity_consumption_kwh', 'electricity_costs_euro']
```

## 3. Data Retrieval Tests

### Test Price Data Query

```javascript
sendTo('influxdb.0', 'query', 
    "SELECT * FROM home_monitoring.autogen.electricity_prices_euro ORDER BY DESC LIMIT 1",
    function(result) {
        if (result.error) {
            console.error('Price query error:', result.error);
        } else {
            console.log('Price data:', JSON.stringify(result.result, null, 2));
            
            // Validate data structure
            if (result.result && result.result[0] && result.result[0].length > 0) {
                var row = result.result[0][0];
                console.log('✓ Has total:', typeof row.total === 'number');
                console.log('✓ Has rank:', typeof row.rank === 'number');
                console.log('✓ Has time:', row.time !== undefined);
            } else {
                console.error('✗ No price data returned');
            }
        }
    }
);
```

**Expected Output:**
```
Price data: [
  [
    {
      "time": "2024-12-06T19:00:00Z",
      "total": 0.2845,
      "rank": 0.35
    }
  ]
]
✓ Has total: true
✓ Has rank: true
✓ Has time: true
```

### Test Consumption Data Query

```javascript
sendTo('influxdb.0', 'query',
    "SELECT last(*) FROM home_monitoring.autogen.electricity_consumption_kwh WHERE source = 'grid' GROUP BY period",
    function(result) {
        if (result.error) {
            console.error('Consumption query error:', result.error);
        } else {
            console.log('Consumption data:', JSON.stringify(result.result, null, 2));
            
            // Validate periods
            var periods = ['this_hour', 'this_day', 'this_month', 'this_year', 
                          'last_hour', 'last_day', 'last_month', 'last_year'];
            var foundPeriods = [];
            
            if (result.result && result.result[0]) {
                result.result[0].forEach(function(row) {
                    foundPeriods.push(row.period);
                });
            }
            
            console.log('Expected periods:', periods);
            console.log('Found periods:', foundPeriods);
            
            periods.forEach(function(period) {
                var found = foundPeriods.indexOf(period) !== -1;
                console.log((found ? '✓' : '✗') + ' Period ' + period + ':', found);
            });
        }
    }
);
```

**Expected Output:**
```
Consumption data: [Array of objects with period, last_consumption, time]
Expected periods: [Array of 8 periods]
Found periods: [Array of found periods]
✓ Period this_hour: true
✓ Period this_day: true
... (all periods should be true)
```

### Test Cost Data Query

```javascript
sendTo('influxdb.0', 'query',
    "SELECT last(*) FROM home_monitoring.autogen.electricity_costs_euro GROUP BY period",
    function(result) {
        if (result.error) {
            console.error('Cost query error:', result.error);
        } else {
            console.log('Cost data:', JSON.stringify(result.result, null, 2));
            
            // Validate data
            if (result.result && result.result[0] && result.result[0].length > 0) {
                var row = result.result[0][0];
                console.log('✓ Has period:', row.period !== undefined);
                console.log('✓ Has last_cost:', typeof row.last_cost === 'number');
                console.log('✓ Has time:', row.time !== undefined);
            } else {
                console.error('✗ No cost data returned');
            }
        }
    }
);
```

## 4. State Creation Tests

### Test State Creation

1. **Install and enable the script** in ioBroker
2. **Wait 5 seconds** for states to be created
3. **Navigate to Objects** in ioBroker Admin
4. **Filter by** `javascript.0.tibber_energy`

**Expected States:**

```
javascript.0.tibber_energy.
├── energy_price_euro
├── energy_price_rank
├── energy_price_euro_ts
├── energy_price_euro_min
├── energy_price_euro_max
├── energy_price_euro_p20
├── energy_price_euro_p50
├── energy_price_euro_p80
├── consumption_grid_this_hour
├── consumption_grid_this_hour_ts
├── consumption_grid_this_hour_min
├── consumption_grid_this_hour_max
├── consumption_grid_this_hour_p20
├── consumption_grid_this_hour_p50
├── consumption_grid_this_hour_p80
├── ... (repeat for all 8 periods)
├── cost_this_hour
├── cost_this_hour_ts
├── cost_this_hour_min
├── cost_this_hour_max
├── cost_this_hour_p20
├── cost_this_hour_p50
├── cost_this_hour_p80
└── ... (repeat for all 8 periods)
```

**Total Expected States:**
- Price: 8 states (1 current + 1 rank + 1 ts + 5 statistics)
- Consumption: 56 states (8 periods × 7 states each)
- Cost: 56 states (8 periods × 7 states each)
- **Total: 120 states**

### Validate State Properties

Check a sample state:

```javascript
// Get state object
getObject('javascript.0.tibber_energy.energy_price_euro', function(err, obj) {
    if (err) {
        console.error('Error getting state:', err);
    } else {
        console.log('State properties:', JSON.stringify(obj.common, null, 2));
        console.log('✓ Has desc:', obj.common.desc !== undefined);
        console.log('✓ Type is number:', obj.common.type === 'number');
        console.log('✓ Has unit:', obj.common.unit !== undefined);
    }
});
```

## 5. State Update Tests

### Test Manual Update

Trigger a manual update:

```javascript
// Run the main query function
queryInfluxDBTibber();

// Wait 2 seconds, then check state values
setTimeout(function() {
    getState('javascript.0.tibber_energy.energy_price_euro', function(err, state) {
        if (err) {
            console.error('Error getting state value:', err);
        } else {
            console.log('Current price:', state.val, state.unit);
            console.log('Last update:', new Date(state.ts));
            console.log('✓ Value is number:', typeof state.val === 'number');
            console.log('✓ Value > 0:', state.val > 0);
        }
    });
}, 2000);
```

**Expected Output:**
```
Current price: 0.2845 Euro
Last update: Fri Dec 06 2024 20:16:00 GMT+0100
✓ Value is number: true
✓ Value > 0: true
```

### Test Scheduled Update

1. **Enable the script**
2. **Wait for next scheduled run** (at 1, 16, 31, or 46 minutes past the hour)
3. **Check script logs** for execution message:
   ```
   [Tibber Integration] Starting data collection from InfluxDB
   ```
4. **Verify state timestamps** are updated

## 6. End-to-End Test

This test validates the complete data flow from Python service to ioBroker.

### Test Procedure

1. **Ensure Python service has recent data:**
   ```bash
   # Run Tibber data collection
   PYTHONPATH=src python -m home_monitoring.scripts.collect_tibber_data
   ```

2. **Verify data in InfluxDB:**
   ```bash
   docker exec -it influxdb influx
   USE home_monitoring
   SELECT * FROM electricity_prices_euro ORDER BY time DESC LIMIT 1
   SELECT * FROM electricity_consumption_kwh WHERE source='grid' ORDER BY time DESC LIMIT 5
   SELECT * FROM electricity_costs_euro ORDER BY time DESC LIMIT 5
   ```

3. **Trigger ioBroker script update:**
   ```javascript
   queryInfluxDBTibber();
   ```

4. **Verify states are updated:**
   ```javascript
   // Check multiple states
   var statesToCheck = [
       'energy_price_euro',
       'consumption_grid_this_day',
       'cost_this_month'
   ];
   
   statesToCheck.forEach(function(stateName) {
       getState('javascript.0.tibber_energy.' + stateName, function(err, state) {
           if (err) {
               console.error('✗ Error checking ' + stateName + ':', err);
           } else {
               console.log('✓ ' + stateName + ':', state.val);
           }
       });
   });
   ```

**Expected Output:**
```
✓ energy_price_euro: 0.2845
✓ consumption_grid_this_day: 12.45
✓ cost_this_month: 45.67
```

## 7. Data Consistency Tests

### Test Period Consistency

Verify that period calculations match between Python and JavaScript:

```javascript
// Get consumption for this_day and this_hour
getState('javascript.0.tibber_energy.consumption_grid_this_day', function(err, dayState) {
    getState('javascript.0.tibber_energy.consumption_grid_this_hour', function(err, hourState) {
        console.log('this_day consumption:', dayState.val, 'kWh');
        console.log('this_hour consumption:', hourState.val, 'kWh');
        console.log('✓ this_day >= this_hour:', dayState.val >= hourState.val);
        console.log('Note: this_hour should NOT be included in this_day');
    });
});
```

### Test Statistics Consistency

Verify statistics are reasonable:

```javascript
// Check that min <= p20 <= p50 <= p80 <= max
var stats = ['min', 'p20', 'p50', 'p80', 'max'];
var values = [];

stats.forEach(function(stat) {
    getState('javascript.0.tibber_energy.energy_price_euro_' + stat, function(err, state) {
        values.push({stat: stat, val: state.val});
        
        if (values.length === stats.length) {
            // Check ordering
            for (var i = 0; i < values.length - 1; i++) {
                var current = values[i];
                var next = values[i + 1];
                var ordered = current.val <= next.val;
                console.log((ordered ? '✓' : '✗') + ' ' + current.stat + ' <= ' + next.stat + ':', 
                           current.val, '<=', next.val, '=', ordered);
            }
        }
    });
});
```

## 8. Error Handling Tests

### Test Missing Data

Simulate missing data scenarios:

```javascript
// Test with non-existent period
sendTo('influxdb.0', 'query',
    "SELECT last(*) FROM home_monitoring.autogen.electricity_consumption_kwh WHERE period = 'invalid_period'",
    function(result) {
        if (result.error) {
            console.log('✓ Error handled correctly:', result.error);
        } else if (!result.result || result.result[0].length === 0) {
            console.log('✓ Empty result handled correctly');
        } else {
            console.error('✗ Unexpected data returned');
        }
    }
);
```

### Test InfluxDB Unavailable

1. **Stop InfluxDB:**
   ```bash
   docker stop influxdb
   ```

2. **Trigger script update:**
   ```javascript
   queryInfluxDBTibber();
   ```

3. **Check logs for error messages:**
   ```
   [Tibber Prices] Query error: ...
   [Tibber Consumption] Query error: ...
   [Tibber Costs] Query error: ...
   ```

4. **Restart InfluxDB:**
   ```bash
   docker start influxdb
   ```

## Test Checklist

Use this checklist to verify all tests pass:

- [ ] Syntax validation passes
- [ ] InfluxDB connection successful
- [ ] Price data query returns valid data
- [ ] Consumption data query returns all periods
- [ ] Cost data query returns valid data
- [ ] All 120 states are created
- [ ] State properties are correct
- [ ] Manual update populates states
- [ ] Scheduled update works
- [ ] End-to-end test passes
- [ ] Period consistency verified
- [ ] Statistics ordering correct
- [ ] Error handling works

## Automated Testing

### JavaScript Unit Tests (Future Enhancement)

For more robust testing, consider creating unit tests:

```javascript
// Example test structure (requires test framework)
describe('Tibber ioBroker Integration', function() {
    it('should create all required states', function() {
        // Test state creation
    });
    
    it('should query InfluxDB successfully', function() {
        // Test queries
    });
    
    it('should update states with correct values', function() {
        // Test state updates
    });
});
```

### Python Integration Tests

Add tests to the Python test suite to verify InfluxDB data:

```python
# tests/integration/test_iobroker_integration.py
import pytest
from home_monitoring.repositories.influxdb import InfluxDBRepository

@pytest.mark.asyncio
async def test_tibber_data_available_for_iobroker():
    """Verify Tibber data in InfluxDB matches ioBroker expectations."""
    repo = InfluxDBRepository()
    
    # Test price data
    result = await repo.query(
        "SELECT * FROM electricity_prices_euro ORDER BY DESC LIMIT 1"
    )
    assert len(result) > 0
    assert 'total' in result[0]
    assert 'rank' in result[0]
    
    # Test consumption data
    result = await repo.query(
        "SELECT last(*) FROM electricity_consumption_kwh "
        "WHERE source = 'grid' GROUP BY period"
    )
    periods = [r['period'] for r in result]
    expected_periods = [
        'this_hour', 'this_day', 'this_month', 'this_year',
        'last_hour', 'last_day', 'last_month', 'last_year'
    ]
    for period in expected_periods:
        assert period in periods
```

## Troubleshooting Test Failures

### No Data Returned

1. Check Python service logs
2. Verify InfluxDB has recent data
3. Check InfluxDB adapter configuration
4. Verify database name matches

### States Not Created

1. Check JavaScript syntax
2. Verify script is enabled
3. Check ioBroker logs for errors
4. Restart JavaScript adapter

### Incorrect Values

1. Compare InfluxDB raw data with state values
2. Check timestamp conversions
3. Verify field name mappings
4. Check for data type mismatches

## References

- [ioBroker Testing Best Practices](https://www.iobroker.net/)
- [InfluxDB Query Language](https://docs.influxdata.com/influxdb/v1.8/query_language/)
- [Home Monitoring Test Suite](../../tests/)
