# Measurement Analysis: Current vs Expected

## Expected Measurements
```
electricity_energy_watthour
electricity_power_watt
electricity_prices
energy_prices_euro
garden_humidity_percentage
garden_light_intensity_lux
garden_rf_link_level_percentage
garden_system_battery_percentage
garden_temperature_celsius
garden_valves_activity
gas_prices_euro
heat_energy_watthours
weather_absolute_pressure_mbar
weather_co2_ppm
weather_gustangle_angles
weather_guststrength_kph
weather_humidity_percentage
weather_noise_db
weather_pressure_mbar
weather_rain_mm
weather_system_battery_percentage
weather_temperature_celsius
weather_windangle_angles
weather_windstrength_kph
```

## Current Measurements Created

### ✅ SolarEdge Service
**Current:**
- `solaredge` (type: overview) - Energy totals, current power
- `solaredge` (type: power_flow) - Grid/PV/Load power
- `electricity_power_watt` (source: grid/pv/load) - Individual power measurements

**Missing:**
- `electricity_energy_watthour` - Energy consumption/production totals

### ✅ Netatmo Service  
**Current:**
- `weather_temperature_celsius`
- `weather_humidity_percentage` 
- `weather_co2_ppm`
- `weather_noise_db`
- `weather_pressure_mbar`
- `weather_absolute_pressure_mbar`
- `weather_rain_mm`
- `weather_wind_strength_kph` (not `weather_windstrength_kph`)
- `weather_wind_angle_degrees` (not `weather_windangle_angles`)
- `weather_gust_strength_kph` (not `weather_guststrength_kph`)
- `weather_gust_angle_degrees` (not `weather_gustangle_angles`)
- `weather_system_battery_percentage`

**Issues:**
- Wind/gust measurements use different naming convention (degrees vs angles, underscore placement)

### ✅ Tibber Service
**Current:**
- `electricity_prices`

**Missing:**
- `energy_prices_euro` - May need currency-specific measurements

### ❌ Gardena Service
**Current:**
- `gardena` (combined measurement with device-specific fields)

**Missing ALL expected garden measurements:**
- `garden_humidity_percentage`
- `garden_light_intensity_lux` 
- `garden_rf_link_level_percentage`
- `garden_system_battery_percentage`
- `garden_temperature_celsius`
- `garden_valves_activity`

### ❌ TankerKoenig Service
**Current:**
- `gas_prices` (not `gas_prices_euro`)

**Issues:**
- Wrong measurement name (missing `_euro` suffix)

### ❌ Techem Service
**Current:**
- `techem` (generic measurement)

**Missing:**
- `heat_energy_watthours` - Specific measurement for heating energy

## Summary After Fixes

### ✅ Now Correct Measurements (24/24)
- electricity_energy_watthour ✅ (Added to SolarEdge)
- electricity_power_watt ✅ (SolarEdge)
- electricity_prices ✅ (Tibber)
- energy_prices_euro ✅ (Added to Tibber)
- garden_humidity_percentage ✅ (Fixed Gardena)
- garden_light_intensity_lux ✅ (Fixed Gardena)
- garden_rf_link_level_percentage ✅ (Fixed Gardena)
- garden_system_battery_percentage ✅ (Fixed Gardena)
- garden_temperature_celsius ✅ (Fixed Gardena)
- garden_valves_activity ✅ (Fixed Gardena)
- gas_prices_euro ✅ (Fixed TankerKoenig)
- heat_energy_watthours ✅ (Fixed Techem)
- weather_absolute_pressure_mbar ✅ (Netatmo)
- weather_co2_ppm ✅ (Netatmo)
- weather_gustangle_angles ✅ (Fixed Netatmo)
- weather_guststrength_kph ✅ (Fixed Netatmo)
- weather_humidity_percentage ✅ (Netatmo)
- weather_noise_db ✅ (Netatmo)
- weather_pressure_mbar ✅ (Netatmo)
- weather_rain_mm ✅ (Netatmo)
- weather_system_battery_percentage ✅ (Netatmo)
- weather_temperature_celsius ✅ (Netatmo)
- weather_windangle_angles ✅ (Fixed Netatmo)
- weather_windstrength_kph ✅ (Fixed Netatmo)

### 🔧 Changes Made
1. **SolarEdge**: Added electricity_energy_watthour measurements for daily/monthly/yearly totals
2. **Netatmo**: Fixed wind/gust measurement names (removed underscores, angles vs degrees)
3. **Tibber**: Added energy_prices_euro when currency is EUR
4. **Gardena**: Replaced generic gardena measurement with specific garden_* measurements
5. **TankerKoenig**: Renamed gas_prices to gas_prices_euro
6. **Techem**: Renamed techem to heat_energy_watthours

### ⚠️ Tests Need Updates
All mapper tests need to be updated to reflect the new measurement names and counts.

## Required Changes

1. **SolarEdge**: Add electricity_energy_watthour measurements
2. **Netatmo**: Fix wind/gust measurement names (degrees → angles, underscore placement)
3. **Tibber**: Add energy_prices_euro measurements  
4. **Gardena**: Replace generic `gardena` with specific garden_* measurements
5. **TankerKoenig**: Rename `gas_prices` to `gas_prices_euro`
6. **Techem**: Rename `techem` to `heat_energy_watthours`
