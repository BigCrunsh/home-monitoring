"""The module contains response mappers that convert API responses to InfluxDB point format."""

from abc import ABC, abstractmethod

import pandas as pd

from homemonitoring.techem import TechemDecoder


class InfluxDBResponseMapper(ABC):
    """InfluxDBResponseMapper is an interface to map API responses to InfluxDB point format.

    Concrete instantiation must implement a `to_influxdb_point` function that take a json response
    and a measurement name to create a point structure that can be written to InfluxDB

    Example:
        ifclient = InfluxDBClient(**credentials)
        api = SomeApi(api_key)
        response = api.get_data()
        points = SomeInfluxDBResponseMapper.to_influxdb_point(response, 'measure1')
        ifclient.write_points(points)
    """

    @staticmethod
    @abstractmethod
    def to_influxdb_point(response_endpoint_json, measurement_name):
        """Converts json response to InfluxDB point format.

        Converts an API response json to a list of dicts that is compatible to with
        the `InfluxDB.write_points` interface. The `measurement_name` is added
        to the field `measurement` in the struct.

        Args:
            response_endpoint_json (json): API response to be mapped.
            measurement_name (str): Name of the measurement added to the result.

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        pass


class SolarEdgeResponseMapper(InfluxDBResponseMapper):
    """SolarEdgeResponseMapper maps Solaredge responses to InfluxDB point format.

    The SolarEdgeResponseMapper takes the response of the Solaredge API and returns
    a list of dicts that can be written to InfluxDB.

    Example:
        ifclient = InfluxDBClient(**credentials)
        api = Solaredge(api_key)
        response = api.get_power_details()
        points = SolarEdgeResponseMapper.to_influxdb_point(response, 'electricity_power_watt')
        ifclient.write_points(points)
    """

    @staticmethod
    def convert_local_to_utc(arg, time_zone):
        """Converts argument datetime in UTC.

        The given argument is converted to a tz-aware datetime for the given `time_zone`.
        The time is than transformed to UTC.

        Args:
            arg (list): List of strings converted to datetimes.
            time_zone (string/tzinfo): time zone of the datetime represented by args.

        Note:
            There is an issues with daylight saving time, e.g., 2019-10-27 02:00:00

        Returns:
            pandas.Series: Series of datetimes in UTC.
        """
        s = pd.to_datetime(arg).tz_localize(tz=time_zone, ambiguous='NaT', nonexistent='NaT')
        return s.tz_convert(tz=None).tz_localize(None)  # convert time

    @staticmethod
    def _to_pandas_df(response_json, time_zone=None, measurement_name=None):
        """Converts json response to pandas dataframe.

        Converts an API response json to a pandas dataframe. The index is based on the time
        stamps converted to UTC. The `measurement_name` is added
        as name.

        Args:
            response_endpoint_json (json): API response to be mapped.
            time_zone (string/tzinfo): time zone of the datetime of response.
            measurement_name (str): Name of the measurement added to the result.

        Raises:
            AssertionError: response_json contains more than one element (multiple endpoints)

        Returns:
            pandas.DataFrame: formated response
        """
        assert len(response_json) < 2, "results from more than one endpoint"
        endpoint, response_endpoint_json = response_json.copy().popitem()
        measurement_name = measurement_name or endpoint

        df = [
            pd.DataFrame
            .from_dict(response_endpoint_json['meters'][i]['values'])
            .set_index('date')
            .rename({"value": response_endpoint_json['meters'][i]['type']}, axis=1)
            for i in range(len(response_endpoint_json['meters']))
            if len(response_endpoint_json['meters'][i]['values']) > 0
        ]
        if len(df) == 0:
            df = [pd.DataFrame()]
        df = pd.concat(df, axis=1, sort=True)
        df.index.name = 'date'  # https://github.com/pandas-dev/pandas/issues/21629
        df.name = measurement_name
        if not df.empty:
            df.index = SolarEdgeResponseMapper.convert_local_to_utc(df.index, time_zone)

        df = df[df.index.notnull()]  # filter all null index (dst)
        df = df[~df.isnull().all(axis=1)]  # filter out all missing measurements
        return df.fillna(0.0)

    @staticmethod
    def _to_influxdb_point(response_json, time_zone=None, measurement_name=None):
        """Converts json response to InfluxDB point format.

        Converts an API response json to a list of dicts that is compatible to with
        the `InfluxDB.write_points` interface. Times are mapped to UTC.
        The `measurement_name` is added to the field `measurement` in the struct.

        Args:
            response_json (json): API response to be mapped.
            time_zone (string/tzinfo): time zone of the datetime of response.
            measurement_name (str): Name of the measurement added to the result.

        Raises:
            AssertionError: response_json contains more than one element (multiple endpoints)

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        assert len(response_json) < 2, "results from more than one endpoint"
        endpoint, response_endpoint_json = response_json.copy().popitem()
        df = SolarEdgeResponseMapper._to_pandas_df(response_json, time_zone)
        return [
            {
                "measurement": measurement_name or endpoint,
                "time": t,
                "fields": ms
            }
            for t, ms in df.T.to_dict().items() if len(ms) > 0
        ]

    @staticmethod
    def to_influxdb_point(responses_json, time_zone=None, measurement_name=None):
        """Converts list of json responses to InfluxDB point format.

        Solaredge in the homemonitoring package returns a list of API responses due to
        date time range limit. Converts this list of API responses to a list of dicts
        that is compatible to with the `InfluxDB.write_points` interface. Times are mapped to UTC.
        The `measurement_name` is added to the field `measurement` in the struct.

        Args:
            responses_json (list): List of API responses to be mapped.
            time_zone (string/tzinfo): time zone of the datetime of response.
            measurement_name (str): Name of the measurement added to the result.

        Raises:
            AssertionError: response_json (element of responses_json) contains more
            than one element (multiple endpoints)

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        return sum(
            map(
                lambda r: SolarEdgeResponseMapper._to_influxdb_point(
                    r, time_zone, measurement_name
                ), responses_json
            ), []
        )


class TankerKoenigResponseMapper(InfluxDBResponseMapper):
    """TankerKoenigResponseMapper maps TankerKoenig responses to InfluxDB point format.

    The TankerKoenigResponseMapper takes the response of the TankerKoenig API and returns
    a list of dicts that can be written to InfluxDB.

    Example:
        ifclient = InfluxDBClient(**credentials)
        station_map = {
            "51d4b477-a095-1aa0-e100-80009459e03a": "Jet",
        }
        api = TankerKoenigHandler(api_key)
        response = api.get_prices()
        time = datetime.datetime.utcnow()
        points = TankerKoenigResponseMapper.to_influxdb_point(time, response, station_map)
        ifclient.write_points(points)
    """

    MEASUREMENT_NAME = 'gas_prices_euro'

    @staticmethod
    def to_influxdb_point(time, response_prices, response_stations):
        """Converts json response to InfluxDB point format.

        Converts an API response json to a list of dicts that is compatible to with
        the `InfluxDB.write_points` interface. The `time` is added to the field `time`
        in the struct.

        Args:
            time (datetime): Time added to the result
            response_prices (json): API response from the prices.php
            response_stations (json): dict of API response from the detail.php

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        return [
            {
                "measurement": TankerKoenigResponseMapper.MEASUREMENT_NAME,
                "time": time,
                "fields": {t: p for (t, p) in ps.items()},
                "tags": {
                    "brand": response_stations[station_id]['station']['brand'],
                    "place": response_stations[station_id]['station']['place'],
                    "street": response_stations[station_id]['station']['street'],
                    "house_number": response_stations[station_id]['station']['houseNumber'],
                    "station_id": station_id,
                }
            }
            for station_id, ps in response_prices['prices'].items() if ps['status'] == 'open'
        ]


class NetatmoResponseMapper(InfluxDBResponseMapper):
    """NetatmoResponseMapper maps Netatmo responses to InfluxDB point format.

    The NetatmoResponseMapper takes the response of the Netamo API and returns
    a list of dicts that can be written to InfluxDB.

    Example:
        ifclient = InfluxDBClient(**credentials)
        api = netatmo.WeatherStation(secrets)
        api.get_data()
        time = datetime.datetime.utcnow()
        points = NetatmoResponseMapper.to_influxdb_point(api.devices, time)
        ifclient.write_points(points)
    """

    # [data_type][measurement][unit]
    measurement_map = {
        'Temperature': {
            'Temperature': 'celsius'
        },
        'Humidity': {
            'Humidity': 'percentage'
        },
        'CO2': {
            'CO2': 'ppm'
        },
        'Noise': {
            'Noise': 'db'
        },
        'Pressure': {
            'Pressure': 'mbar'
        },
        'Wind': {
            'WindStrength': 'kph',
            'WindAngle': 'angles',
            'GustStrength': 'kph',
            'GustAngle': 'angles'
        },
        'Rain': {
            'Rain': 'mm'
        }

    }

    @staticmethod
    def to_influxdb_point(response_json, time, measurement_map=measurement_map):
        """Converts json response to InfluxDB point format.

        Converts an API response json to a list of dicts that is compatible to with
        the `InfluxDB.write_points` interface. The `time` is added to the field `time`
        in the struct.

        Args:
            time (datetime): Time added to the result
            response_endpoint_json (json): API response to be mapped.
            measurement_map (dict): mapping data_type to measurement to unit

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        module_names = NetatmoResponseMapper._get_module_names(response_json)
        return [
            {
                "measurement": f'weather_{measurements_name.lower()}_{unit}',
                "time": time,
                "fields": {
                    measurements_name: float(NetatmoResponseMapper._get_data(
                        response_json, module_name
                    )['dashboard_data'][measurements_name])
                },
                "tags": {
                    "module_name": module_name,
                }
            }
            for data_type, measurements in measurement_map.items()
            for measurements_name, unit in measurements.items()
            for module_name in module_names
            if data_type in NetatmoResponseMapper._get_data(response_json, module_name)['data_type']
        ] + [
            {
                "measurement": 'weather_system_battery_percentage',
                "time": time,
                "fields": {
                    'Battery': float(NetatmoResponseMapper._get_data(
                        response_json, module_name
                    )['battery_percent'])
                },
                "tags": {
                    "module_name": module_name,
                }

            }
            for module_name in module_names
            if 'battery_percent' in NetatmoResponseMapper._get_data(response_json, module_name)
        ]

    @staticmethod
    def _get_module_names(response_json):
        """Extracts module names from API response.

        Extracts module name from json response.

        Args:
            response_json (json): API response.

        Returns:
            list[string]: list of module names
        """
        return [response_json[0]['module_name']] + list(map(
            lambda m: m['module_name'],
            response_json[0]['modules']
        ))

    @staticmethod
    def _get_data(response_json, module_name):
        """Extracts module data from API response.

        Extracts module data from API response of a given module name.

        Args:
            response_json (json): API response.
            module_name (string): module name for requested data.

        Raises:
            AssertionError: if module name not found

        Returns:
            dict: module data
        """
        if module_name == response_json[0]['module_name']:
            return response_json[0]
        module = list(filter(
            lambda m: module_name == m['module_name'],
            response_json[0]['modules']
        ))
        assert len(module) == 1, "found {} module with name {}".format(
            len(module), module_name
        )
        return module[0]


class GardenaResponseMapper(InfluxDBResponseMapper):
    """GardenaResponseMapper maps Gardena device attributes to InfluxDB point format.

    The GardenaResponseMapper takes a device object and returns
    a list of dicts that can be written to InfluxDB.

    Example:
        ifclient = InfluxDBClient(**credentials)
        ...
        time = datetime.datetime.utcnow()
        points = NetatmoResponseMapper.to_influxdb_point(api.devices, time)
        ifclient.write_points(points)
    """
    VALVE_ACTIVITY = ['CLOSED', 'MANUAL_WATERING', 'SCHEDULED_WATERING']

    @staticmethod
    def control_data_to_influxdb_point(control, time):
        """Reads irrigation control data and formates to InfluxDB point format.

        Parses device attributes to a list of dicts that is compatible to with
        the `InfluxDB.write_points` interface. The `time` is added to the field `time`
        in the struct.

        Args:
            device (gardena.base_device.BaseDevice): device object holding state
            time (datetime): Time added to the result

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        return [
            {
                "measurement": 'garden_valves_activity',
                "time": time,
                "fields": {
                    "state": int(v['activity'] == activity)
                },
                "tags": {
                    "activity": activity,
                    "name": control.name,
                    "id": control.id,
                    "type": control.type,
                    "valve_name": v['name'],
                    "valve_id": v['id'],
                }
            }
            for activity in GardenaResponseMapper.VALVE_ACTIVITY
            for v in control.valves.values()
        ]

    @staticmethod
    def sensor_data_to_influxdb_point(sensor, time):
        """Reads sensor data and formates to InfluxDB point format.

        Parses device attributes to a list of dicts that is compatible to with
        the `InfluxDB.write_points` interface. The `time` is added to the field `time`
        in the struct.

        Args:
            device (gardena.base_device.BaseDevice): device object holding state
            time (datetime): Time added to the result

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        return [
            {
                "measurement": 'garden_system_battery_percentage',
                "time": time,
                "fields": {
                    'battery': sensor.battery_level
                },
                "tags": {
                    "name": sensor.name,
                    "id": sensor.id,
                    "type": sensor.type
                }
            },
            {
                "measurement": 'garden_temperature_celsius',
                "time": time,
                "fields": {
                    'temperature': sensor.soil_temperature
                },
                "tags": {
                    "environment": 'soil',
                    "name": sensor.name,
                    "id": sensor.id,
                    "type": sensor.type
                }
            },
            {
                "measurement": 'garden_temperature_celsius',
                "time": time,
                "fields": {
                    'temperature': sensor.ambient_temperature
                },
                "tags": {
                    "environment": 'ambient',
                    "name": sensor.name,
                    "id": sensor.id,
                    "type": sensor.type
                }
            },
            {
                "measurement": 'garden_humidity_percentage',
                "time": time,
                "fields": {
                    'humidity': sensor.soil_humidity
                },
                "tags": {
                    "environment": 'soil',
                    "name": sensor.name,
                    "id": sensor.id,
                    "type": sensor.type
                }
            },
            {
                "measurement": 'garden_light_intensity_lux',
                "time": time,
                "fields": {
                    'light_intensity': sensor.light_intensity
                },
                "tags": {
                    "name": sensor.name,
                    "id": sensor.id,
                    "type": sensor.type
                }
            },
            {
                "measurement": 'garden_rf_link_level_percentage',
                "time": time,
                "fields": {
                    'rf_link_level': sensor.rf_link_level
                },
                "tags": {
                    "name": sensor.name,
                    "id": sensor.id,
                    "type": sensor.type
                }
            },
        ]


class TechemResponseMapper(InfluxDBResponseMapper):
    """TechemResponseMapper maps and decodes Techem responses to InfluxDB point format.

    The TechemResponseMapper decodes the wireless M-Bus data
    of the TECHEM energy meter Compat V and returns a list of dicts that can be written to InfluxDB.
    """

    @staticmethod
    def to_influxdb_point(time, data):
        """Converts hexadecial encoded data from Techem to InfluxDB point format.

        Args:
            time (datetime): Time added to the result
            data (set[byte]): Techem energy meter format.

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        decoders = map(lambda p: TechemDecoder(p.decode('utf-8')), data)
        return [
            {
                "measurement": 'heat_energy_watthours',
                "time": time,
                "fields": {
                    'Total_Consumption': d.get_total_consumption() * 1000
                },
                "tags": {
                    "id": d.get_meter_id()
                }
            }
            for d in decoders
        ]
