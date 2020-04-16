"""The module contains response mappers that convert API responses to InfluxDB point format."""

from abc import ABC, abstractmethod

import pandas as pd


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

        Converts a API response json to a list of dicts that is compatible to with
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
        s = pd.to_datetime(arg).tz_localize(tz=time_zone, ambiguous='NaT')
        return s.tz_convert(tz=None).tz_localize(None)  # convert time

    @staticmethod
    def to_pandas_df(response_json, time_zone=None, measurement_name=None):
        """Converts json response to pandas dataframe.

        Converts a API response json to a pandas dataframe. The index is based on the time
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
        assert len(response_json) == 1, "results from more than one endpoint"
        endpoint, response_endpoint_json = response_json.popitem()
        measurement_name = measurement_name or endpoint

        if len(response_endpoint_json) == 0:
            df = pd.DataFrame()
            df.name = measurement_name
            return df

        df = pd.concat([
            pd.DataFrame
            .from_dict(response_endpoint_json['meters'][i]['values'])
            .set_index('date')
            .fillna(0.0)
            .rename({"value": response_endpoint_json['meters'][i]['type']}, axis=1)
            for i in range(len(response_endpoint_json['meters']))
        ], axis=1)
        df.name = measurement_name
        if not df.empty:
            df.index = SolarEdgeResponseMapper.convert_local_to_utc(df.index, time_zone)
        return df

    @staticmethod
    def to_influxdb_point(response_json, time_zone=None, measurement_name=None):
        """Converts json response to InfluxDB point format.

        Converts a API response json to a list of dicts that is compatible to with
        the `InfluxDB.write_points` interface. Times are mapped to UTC.
        The `measurement_name` is added to the field `measurement` in the struct.

        Args:
            response_endpoint_json (json): API response to be mapped.
            time_zone (string/tzinfo): time zone of the datetime of response.
            measurement_name (str): Name of the measurement added to the result.

        Raises:
            AssertionError: response_json contains more than one element (multiple endpoints)

        Returns:
            list[dict]: Responses mapped to InfluxDB point format.
        """
        assert len(response_json) == 1, "results from more than one endpoint"
        endpoint, response_endpoint_json = response_json.popitem()
        df = SolarEdgeResponseMapper.to_pandas_df({endpoint: response_endpoint_json}, time_zone)
        return [
            {
                "measurement": measurement_name or endpoint,
                "time": t,
                "fields": ms
            }
            for t, ms in df.T.to_dict().items() if len(ms) > 0
        ]


class TankerKoenigResponseMapper(InfluxDBResponseMapper):
    MEASUREMENT_NAME = 'gas_prices_euro'

    @staticmethod
    def to_influxdb_point(time, response_json, station_map):
        return [
            {
                "measurement": TankerKoenigResponseMapper.MEASUREMENT_NAME,
                "time": time,
                "fields": {t: p for (t, p) in ps.items()},
                "tags": {
                    "brand": station_map[station_id],
                    "station_id": station_id,
                }
            }
            for station_id, ps in response_json['prices'].items() if ps['status'] == 'open'
        ]


class NetatmoResponseMapper(InfluxDBResponseMapper):
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
        return [response_json[0]['module_name']] + list(map(
            lambda m: m['module_name'],
            response_json[0]['modules']
        ))

    @staticmethod
    def _get_data(response_json, module_name):
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
