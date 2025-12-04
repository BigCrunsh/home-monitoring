# InfluxDB Measurements Documentation

## Overview
This document provides comprehensive documentation of all InfluxDB measurements produced by the Home Monitoring system.

## Complete Measurement Catalog

### 1. Electricity & Energy

#### `electricity_energy_watthour`
- **Source**: SolarEdge API (`/site/{siteId}/energyDetails`)
- **Description**: Detailed solar energy per meter (production, consumption, feed-in, purchase, self-consumption)
- **Fields**: 
  - `Consumption`: Energy consumed (Wh)
  - `Production`: Energy produced (Wh)
  - `FeedIn`: Energy exported to the grid (Wh)
  - `Purchased`: Energy imported from the grid (Wh)
  - `SelfConsumption`: Self-consumed energy (Wh)
- **Tags**: 
  - `site_id`: SolarEdge site identifier
- **Update Frequency**: Depends on configured `timeUnit` (DAY/WEEK/HOUR/etc.) and scheduler

#### `electricity_power_watt`
- **Source**: SolarEdge API (`/site/{siteId}/powerDetails`)
- **Description**: Detailed real-time power per meter (production, consumption, feed-in, purchase, self-consumption)
- **Fields**:
  - `Consumption`: Power consumed (W)
  - `Production`: Power produced (W)
  - `FeedIn`: Power exported to the grid (W)
  - `Purchased`: Power imported from the grid (W)
  - `SelfConsumption`: Self-consumed power (W)
- **Tags**:
  - `site_id`: SolarEdge site identifier
- **Update Frequency**: Depends on scheduler; typically every 15 minutes for detailed power

#### `electricity_prices_euro`
- **Source**: Tibber API
- **Description**: Electricity prices in EUR
- **Fields**:
  - `total`: Total price including taxes (EUR)
  - `rank`: Price ranking (0.0-1.0, where 0.0 is cheapest)
- **Tags**: None
- **Update Frequency**: Hourly

#### `electricity_costs_euro`
- **Source**: Tibber API (calculated from consumption data)
- **Description**: Total electricity costs for different time periods
- **Fields**:
  - `cost`: Total cost in EUR
- **Tags**:
  - `period`: Time period (last_hour, this_hour, last_day, last_24h, this_day, last_month, this_month, this_year, last_year)
- **Update Frequency**: Configurable (recommended: hourly or daily)

#### `electricity_consumption_kwh`
- **Source**: Tibber API
- **Description**: Total electricity consumption for different time periods. Can represent total consumption, grid consumption, or solar production depending on the source tag.
- **Fields**:
  - `consumption`: Total consumption in kWh
- **Tags**:
  - `period`: Time period (last_hour, this_hour, last_day, last_24h, this_day, last_month, this_month, this_year, last_year)
  - `source`: (optional) Energy source - `grid` for grid consumption, `solar` for solar production. When absent, represents total consumption.
- **Update Frequency**: Configurable (recommended: hourly or daily)

### 2. Garden & Irrigation

#### `garden_humidity_percentage`
- **Source**: Gardena Smart System API
- **Description**: Soil humidity measurements
- **Fields**:
  - `humidity`: Soil humidity percentage (%)
- **Tags**:
  - `environment`: soil/ambient
  - `name`: Device name
  - `id`: Device ID
  - `type`: Device type
- **Update Frequency**: Every 6 hours

#### `garden_light_intensity_lux`
- **Source**: Gardena Smart System API
- **Description**: Light intensity measurements
- **Fields**:
  - `light_intensity`: Light intensity (lux)
- **Tags**:
  - `name`: Device name
  - `id`: Device ID
  - `type`: Device type
- **Update Frequency**: Every 6 hours

#### `garden_rf_link_level_percentage`
- **Source**: Gardena Smart System API
- **Description**: RF signal strength for garden devices
- **Fields**:
  - `rf_link_level`: RF link level percentage (%)
- **Tags**:
  - `name`: Device name
  - `id`: Device ID
  - `type`: Device type
- **Update Frequency**: Every 6 hours

#### `garden_system_battery_percentage`
- **Source**: Gardena Smart System API
- **Description**: Battery levels for garden devices
- **Fields**:
  - `battery_level`: Battery level percentage (%)
- **Tags**:
  - `name`: Device name
  - `id`: Device ID
  - `type`: Device type
- **Update Frequency**: Every 6 hours

#### `garden_temperature_celsius`
- **Source**: Gardena Smart System API
- **Description**: Temperature measurements from garden sensors
- **Fields**:
  - `temperature`: Temperature (°C)
- **Tags**:
  - `environment`: soil/ambient
  - `name`: Device name
  - `id`: Device ID
  - `type`: Device type
  - `sensor_type`: soil (for soil sensors)
- **Update Frequency**: Every 6 hours

#### `garden_valves_activity`
- **Source**: Gardena Smart System API
- **Description**: Irrigation valve activity states
- **Fields**:
  - `state`: Activity state (0/1 for inactive/active)
- **Tags**:
  - `activity`: CLOSED/MANUAL_WATERING/SCHEDULED_WATERING
  - `name`: Control name
  - `id`: Control ID
  - `type`: Control type
- **Update Frequency**: Every 6 hours

### 3. Fuel Prices

#### `gas_prices_euro`
- **Source**: TankerKoenig API
- **Description**: Fuel prices at gas stations
- **Fields**:
  - `e5`: Super E5 price (EUR/L)
  - `e10`: Super E10 price (EUR/L)
  - `diesel`: Diesel price (EUR/L)
- **Tags**:
  - `brand`: Gas station brand
  - `place`: City/location
  - `street`: Street name
  - `house_number`: House number
  - `lat`: Latitude
  - `lng`: Longitude
  - `station_id`: Station identifier
- **Update Frequency**: Every 30 minutes

### 4. Heating

#### `heat_energy_watthours`
- **Source**: Techem Energy Meter (wireless M-Bus)
- **Description**: Heat energy consumption from Techem meters
- **Fields**:
  - `Total_Consumption`: Total heat consumption (Wh)
- **Tags**:
  - `id`: Meter ID
- **Update Frequency**: Every 4 hours

#### `heat_temperature_celsius`
- **Source**: Sam Digital reader (sam-digital.net)
- **Description**: Aggregated heating circuit temperatures from Sam Digital
- **Fields**:
  - `outdoor`: Outdoor temperature AF1 (°C)
  - `heating_flow`: Heating circuit flow temperature VF1 (°C)
  - `heating_return`: Heating circuit return temperature RüF1 (°C)
  - `hotwater_return`: Hot water circuit return temperature RüF2 (°C)
  - `hotwater_storage`: Hot water storage temperature SF1 (°C)
- **Tags**:
  - `device_id`: Sam Digital device identifier
  - `device_name`: Human-readable device name from Sam Digital
- **Update Frequency**: Depends on scheduler

#### `heat_valve_signal_percentage`
- **Source**: Sam Digital reader (sam-digital.net)
- **Description**: Control valve signal (Stellsignal HK2)
- **Fields**:
  - `heating`: Heating circuit valve signal HK1 (%)
  - `hotwater`: Hot water circuit valve signal HK2 (%)
- **Tags**:
  - `device_id`: Sam Digital device identifier
  - `device_name`: Human-readable device name from Sam Digital
- **Update Frequency**: Depends on scheduler

### 5. Weather

#### `weather_co2_ppm`
- **Source**: Netatmo Weather Station
- **Description**: Indoor CO2 concentration
- **Fields**:
  - `CO2`: CO2 concentration (ppm)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_gustangle_angles`
- **Source**: Netatmo Weather Station
- **Description**: Wind gust direction
- **Fields**:
  - `GustAngle`: Gust direction (degrees)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_guststrength_kph`
- **Source**: Netatmo Weather Station
- **Description**: Wind gust strength
- **Fields**:
  - `GustStrength`: Gust strength (km/h)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_humidity_percentage`
- **Source**: Netatmo Weather Station
- **Description**: Relative humidity
- **Fields**:
  - `Humidity`: Relative humidity (%)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_noise_db`
- **Source**: Netatmo Weather Station
- **Description**: Ambient noise level
- **Fields**:
  - `Noise`: Noise level (dB)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_pressure_mbar`
- **Source**: Netatmo Weather Station
- **Description**: Sea-level atmospheric pressure
- **Fields**:
  - `Pressure`: Sea-level pressure (mbar)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_rain_mm`
- **Source**: Netatmo Weather Station
- **Description**: Rainfall measurements
- **Fields**:
  - `Rain`: Rainfall amount (mm)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_system_battery_percentage`
- **Source**: Netatmo Weather Station
- **Description**: Battery levels for weather station modules
- **Fields**:
  - `Battery`: Battery level (%)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_temperature_celsius`
- **Source**: Netatmo Weather Station
- **Description**: Temperature measurements
- **Fields**:
  - `Temperature`: Temperature (°C)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_windangle_angles`
- **Source**: Netatmo Weather Station
- **Description**: Wind direction
- **Fields**:
  - `WindAngle`: Wind direction (degrees)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

#### `weather_windstrength_kph`
- **Source**: Netatmo Weather Station
- **Description**: Wind speed
- **Fields**:
  - `WindStrength`: Wind speed (km/h)
- **Tags**:
  - `module_name`: Weather station module name
  - `device_id`: Device identifier
  - `type`: Device type
- **Update Frequency**: Every 10 minutes

## Data Collection Architecture

### System Architecture
- **Structure**: Service-based architecture with standardized interfaces
- **Services**: Async services with consistent error handling and logging
- **Scheduling**: Centralized service orchestration
- **Benefits**: Maintainability, unified monitoring, consistent data validation

## Database Schema

### InfluxDB Configuration
- **Database**: `home_monitoring`
- **Retention Policy**: Default (configurable)
- **Precision**: Nanosecond timestamps

### Common Tag Structure
All measurements include contextual tags for filtering and grouping:
- **Device identification**: `id`, `name`, `type`
- **Location context**: `module_name`, `site_id`, `place`
- **Measurement context**: `source`, `environment`, `activity`

### Field Data Types
- **Numeric values**: Float64 (temperature, power, prices, etc.)
- **State indicators**: Integer (0/1 for inactive/active states)
- **Identifiers**: String (device IDs, names)

## Monitoring & Alerting

### Key Metrics to Monitor
1. **Data freshness**: Ensure measurements arrive within expected intervals
2. **Data completeness**: Verify all expected measurements are present
3. **Data quality**: Check for reasonable value ranges
4. **Service health**: Monitor API response times and error rates

### Recommended Alerts
- Missing data for >2x expected update frequency
- Values outside normal ranges (e.g., temperature <-50°C or >70°C)
- Service failures or API errors
- Battery levels <20% for garden/weather devices

## Usage Examples

### Grafana Queries
```sql
-- Average temperature over last 24 hours
SELECT MEAN("Temperature")
FROM "weather_temperature_celsius"
WHERE time >= now() - 24h
GROUP BY time(1h)

-- Current solar power production
SELECT LAST("Production")
FROM "electricity_power_watt"
WHERE time >= now() - 1h

-- Daily energy consumption
SELECT SUM("Consumption")
FROM "electricity_energy_watthour"
WHERE time >= now() - 1d
GROUP BY time(1d)
```

### Data Export
All measurements follow standard InfluxDB line protocol and can be exported using:
- InfluxDB CLI tools
- Grafana data export
- Custom scripts using InfluxDB client libraries

---
*Last updated: December 2025*
*System: Home Monitoring InfluxDB Integration*
