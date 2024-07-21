"""The module contains test functions to test response mappers."""

import datetime
import pandas as pd

from unittest import TestCase

from gardena.smart_system import SmartSystem
from gardena.devices.sensor import Sensor
from gardena.devices.smart_irrigation_control import SmartIrrigationControl

from homemonitoring.response_mappers import (
    SolarEdgeResponseMapper, GardenaResponseMapper, TechemResponseMapper,
    TankerKoenigResponseMapper, NetatmoResponseMapper, TibberResponseMapper
)
from .fixtures import sensor_fixture, smart_irrigation_fixture, soil_sensor_fixture


class TestNetatmoResponseMapper(TestCase):
    """TestNetatmoResponseMapper contains the tests for NetatmoResponseMapper class."""
    RESPONSE_FIXTURES = [{
        '_id': '0',
        'module_name': 'Main',
        'wifi_status': 58,
        'data_type': ['Temperature'],
        'dashboard_data': {
            'time_utc': 1627581580,
            'Temperature': 26,
        },
        'modules': [
            {
                '_id': '1',
                'type': 'NAModule4',
                'module_name': 'room',
                'data_type': ['Temperature'],
                'dashboard_data': {
                    'time_utc': 1627581578,
                    'Temperature': 25.6,
                }
            },
            {
                '_id': '2',
                'type': 'NAModule2',
                'module_name': 'wind',
                'data_type': [],
                'battery_percent': 1,
                'battery_vp': 3973
            },
        ]
    }]

    def test_to_influxdb_point(self):
        """Checks conversion to influxdb."""
        time = datetime.datetime(2020, 3, 30, 17, 45)
        got = NetatmoResponseMapper.to_influxdb_point(
            self.RESPONSE_FIXTURES,
            time
        )
        expected = [
            {
                'measurement': 'weather_temperature_celsius',
                'time': datetime.datetime(2020, 3, 30, 17, 45),
                'fields': {'Temperature': 26.0},
                'tags': {'module_name': 'Main'}
            },
            {
                'measurement': 'weather_temperature_celsius',
                'time': datetime.datetime(2020, 3, 30, 17, 45),
                'fields': {'Temperature': 25.6},
                'tags': {'module_name': 'room'}
            },
            {
                'measurement': 'weather_system_battery_percentage',
                'time': datetime.datetime(2020, 3, 30, 17, 45),
                'fields': {'Battery': 1.0},
                'tags': {'module_name': 'wind'},
            },
        ]
        print(got)
        self.assertListEqual(got, expected)

    def test_get_module_names(self):
        """Checks extraction of module names."""
        got = NetatmoResponseMapper._get_module_names(self.RESPONSE_FIXTURES)
        expected = ['Main', 'room', 'wind']
        self.assertListEqual(got, expected)

    def test_get_data(self):
        """Checks extration of data by name."""
        got = NetatmoResponseMapper._get_data(self.RESPONSE_FIXTURES, 'room')
        expected = {
            '_id': '1',
            'type': 'NAModule4',
            'module_name': 'room',
            'data_type': ['Temperature'],
            'dashboard_data': {
                'time_utc': 1627581578,
                'Temperature': 25.6,
            }
        }
        self.assertDictEqual(got, expected)


class TestTankerKoenigResponseMapper(TestCase):
    """TestTankerKoenigResponseMapper contains the tests for TankerKoenigResponseMapper class."""

    RESPONSE_PRICE_FIXTURES = {
        "prices": {
            "id_1": {
                "status": "open",
                "e5": 1.01,
                "e10": 1.02,
                "diesel": 1.03
            },
            "id_2": {
                "status": "open",
                "e5": 1.04,
                "e10": 1.05,
                "diesel": 1.06
            },
            "id_3": {  # filter out since it is closed
                "status": "close",
                "e5": 1.07,
                "e10": 1.08,
                "diesel": 1.09
            }
        }
    }

    RESPONSE_DETAIL_FIXTURES = {
        "id_1": {
            "station": {
                "id": "id_1",
                "brand": "ARAL",
                "street": "Strasse1",
                "houseNumber": "1",
                "place": "placeA",
                "lat": 1,
                "lng": 2,
            }
        },
        "id_2": {
            "station": {
                "id": "id_2",
                "brand": "Jet",
                "street": "Strasse2",
                "houseNumber": "2",
                "place": "placeB",
                "lat": 3,
                "lng": 4,
            }
        },
        "id_3": {
            "station": {
                "id": "id_3",
                "brand": "Frei",
                "street": "Strasse3",
                "houseNumber": "3",
                "place": "placeC",
                "lat": 5,
                "lng": 6,
            }
        },
    }

    def setUp(self):
        """Sets common params for each test function."""
        self.measurement_name = 'gas_prices_euro'

    def test_to_influxdb_point(self):
        """Checks conversion to influxdb."""
        time = datetime.datetime(2020, 3, 30, 17, 45)
        got = TankerKoenigResponseMapper.to_influxdb_point(
            time,
            self.RESPONSE_PRICE_FIXTURES,
            self.RESPONSE_DETAIL_FIXTURES
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': time,
                'fields': {'status': 'open', 'e5': 1.01, 'e10': 1.02, 'diesel': 1.03},
                'tags': {
                    'brand': 'aral', 'place': 'placea', 'street': 'strasse1', 'house_number': '1',
                    'station_id': 'id_1', 'lat': 1, 'lng': 2
                }
            },
            {
                'measurement': self.measurement_name,
                'time': time,
                'fields': {'status': 'open', 'e5': 1.04, 'e10': 1.05, 'diesel': 1.06},
                'tags': {
                    'brand': 'jet', 'place': 'placeb', 'street': 'strasse2',
                    'house_number': '2', 'station_id': 'id_2', 'lat': 3, 'lng': 4
                }
            }
        ]
        self.assertListEqual(got, expected)


class TestSolarEdgeResponseMapper(TestCase):
    """TestSolarEdgeResponseMapper contains the test cases for the SolarEdgeResponseMapper class."""

    RESPONSE_FIXTURES = {
        'regular': {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 1.0},
                        {'date': '2020-03-30 20:00:00', 'value': 2.0}
                    ]},
                    {'type': 'Purchased', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 3.0},
                        {'date': '2020-03-30 20:00:00', 'value': 4.0}
                    ]}
                ]
            }
        },
        'empty': {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [{'date': '2020-03-30 19:45:00'}]},
                    {'type': 'Purchased', 'values': [{'date': '2020-03-30 20:00:00'}]},
                ]
            }
        },
        'missing_date': {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'FeedIn', 'values': []},
                    {'type': 'SelfConsumption', 'values': []},
                    {'type': 'Purchased', 'values': []},
                    {'type': 'Consumption', 'values': []},
                    {'type': 'Production', 'values': []}
                ]
            }
        },
        'dst': {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [
                        {'date': '2020-03-29 01:45:00', 'value': 1.0},
                        {'date': '2020-03-29 02:00:00', 'value': 2.0},
                        {'date': '2020-03-29 04:00:00', 'value': 3.0}
                    ]}
                ]
            }
        },
        'first_missing': {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [
                        {'date': '2020-03-30 19:45:00'},
                        {'date': '2020-03-30 20:00:00', 'value': 2.0},
                    ]},
                    {'type': 'Purchased', 'values': [
                        {'date': '2020-03-30 19:45:00'},
                        {'date': '2020-03-30 20:00:00', 'value': 4.0},
                    ]},
                ]
            }
        },
        'last_missing': {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 1.0},
                        {'date': '2020-03-30 20:00:00'},
                    ]},
                    {'type': 'Purchased', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 3.0},
                        {'date': '2020-03-30 20:00:00'},
                    ]},
                ]
            }
        },
        'partially_missing': {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 1.0},
                        {'date': '2020-03-30 20:00:00', 'value': 2.0},
                    ]},
                    {'type': 'Purchased', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 3.0},
                        {'date': '2020-03-30 20:00:00'},
                    ]},
                ]
            }
        }
    }

    def setUp(self):
        """Sets common params for each test function."""
        self.measurement_name = 'electricity_power_watt'
        self.time_zone = 'Europe/Berlin'

    # convert_local_to_utc

    def test_convert_local_to_utc(self):
        """Checks conversation of local time to utc."""
        time_zone = 'Europe/Berlin'
        series = [
            '2020-03-01 01:45:00', '2020-03-01 02:00:00', '2020-03-01 02:15:00',
            '2020-03-01 02:30:00', '2020-03-01 02:45:00', '2020-03-01 03:00:00',
            '2020-03-01 03:15:00'
        ]
        expected = pd.DatetimeIndex([
            '2020-03-01 00:45:00', '2020-03-01 01:00:00', '2020-03-01 01:15:00',
            '2020-03-01 01:30:00', '2020-03-01 01:45:00', '2020-03-01 02:00:00',
            '2020-03-01 02:15:00'
        ])
        got = SolarEdgeResponseMapper.convert_local_to_utc(series, time_zone)
        pd.testing.assert_index_equal(got, expected)

    def test_convert_local_to_utc_dst(self):
        """Checks conversation of local time to utc with daylight saving time."""
        time_zone = 'Europe/Berlin'
        series = [
            '2020-03-29 01:45:00', '2020-03-29 02:00:00', '2020-03-29 02:15:00',
            '2020-03-29 02:30:00', '2020-03-29 02:45:00', '2020-03-29 03:00:00',
            '2020-03-29 03:15:00'
        ]
        expected = pd.DatetimeIndex([
            '2020-03-29 00:45:00', pd.NaT, pd.NaT,
            pd.NaT, pd.NaT, '2020-03-29 01:00:00',
            '2020-03-29 01:15:00'
        ])
        got = SolarEdgeResponseMapper.convert_local_to_utc(series, time_zone)
        pd.testing.assert_index_equal(got, expected)

    # _to_pandas_df

    def test_to_pandas_df(self):
        """Checks conversion to pandas dataframe."""
        got = SolarEdgeResponseMapper._to_pandas_df(
            self.RESPONSE_FIXTURES['regular'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )

        expected = pd.DataFrame({
            'Consumption': {
                datetime.datetime(2020, 3, 30, 17, 45): 1.0,
                datetime.datetime(2020, 3, 30, 18, 0): 2.0
            },
            'Purchased': {
                datetime.datetime(2020, 3, 30, 17, 45): 3.0,
                datetime.datetime(2020, 3, 30, 18, 0): 4.0
            }
        })
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    def test_to_pandas_missing_date(self):
        """Checks conversion to pandas dataframe in frame is missing date records."""
        got = SolarEdgeResponseMapper._to_pandas_df(
            self.RESPONSE_FIXTURES['missing_date'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = pd.DataFrame()
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    def test_to_pandas_df_dst(self):
        """Checks conversion to pandas dataframe in case of daylight saving time."""
        got = SolarEdgeResponseMapper._to_pandas_df(
            self.RESPONSE_FIXTURES['dst'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = pd.DataFrame({
            'Consumption': {
                datetime.datetime(2020, 3, 29, 0, 45): 1.0,
                datetime.datetime(2020, 3, 29, 2, 0): 3.0,
            }
        })
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    def test_to_pandas_df_empty_response(self):
        """Checks conversion to pandas dataframe with empty response."""
        got = SolarEdgeResponseMapper._to_pandas_df(
            self.RESPONSE_FIXTURES['empty'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = pd.DataFrame()
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(
            got, expected, check_index_type=False, check_column_type=False
        )

    def test_to_pandas_df_first_missing(self):
        """Checks conversion to pandas dataframe response with missing record in the beginning."""
        got = SolarEdgeResponseMapper._to_pandas_df(
            self.RESPONSE_FIXTURES['first_missing'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = pd.DataFrame({
            'Consumption': {
                datetime.datetime(2020, 3, 30, 18, 0): 2.0
            },
            'Purchased': {
                datetime.datetime(2020, 3, 30, 18, 0): 4.0
            }
        })
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    def test_to_pandas_df_last_missing(self):
        """Checks conversion to pandas dataframe response with missing record in the end."""
        got = SolarEdgeResponseMapper._to_pandas_df(
            self.RESPONSE_FIXTURES['last_missing'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = pd.DataFrame({
            'Consumption': {
                datetime.datetime(2020, 3, 30, 17, 45): 1.0,
            },
            'Purchased': {
                datetime.datetime(2020, 3, 30, 17, 45): 3.0,
            }
        })
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    def test_to_pandas_df_partial_missing(self):
        """Checks conversion to pandas dataframe response with missing value in the end."""
        got = SolarEdgeResponseMapper._to_pandas_df(
            self.RESPONSE_FIXTURES['partially_missing'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = pd.DataFrame({
            'Consumption': {
                datetime.datetime(2020, 3, 30, 17, 45): 1.0,
                datetime.datetime(2020, 3, 30, 18, 0): 2.0
            },
            'Purchased': {
                datetime.datetime(2020, 3, 30, 17, 45): 3.0,
                datetime.datetime(2020, 3, 30, 18, 0): 0.0
            }
        })
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    # _to_influxdb_point

    def test_to_influxdb_point(self):
        """Checks conversion to influxdb for regular response."""
        got = SolarEdgeResponseMapper._to_influxdb_point(
            self.RESPONSE_FIXTURES['regular'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 3, 30, 17, 45),
                'fields': {'Consumption': 1.0, 'Purchased': 3.0},
            },
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 3, 30, 18, 0),
                'fields': {'Consumption': 2.0, 'Purchased': 4.0},
            }
        ]
        self.assertListEqual(got, expected)

    def test_to_influxdb_point_first_missing(self):
        """Checks conversion to influxdb for response with missing record in the beginning."""
        got = SolarEdgeResponseMapper._to_influxdb_point(
            self.RESPONSE_FIXTURES['first_missing'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 3, 30, 18, 0),
                'fields': {'Consumption': 2.0, 'Purchased': 4.0}
            }
        ]
        self.assertListEqual(got, expected)

    def test_to_influxdb_point_last_missing(self):
        """Checks conversion to influxdb for response with missing record in the end."""
        got = SolarEdgeResponseMapper._to_influxdb_point(
            self.RESPONSE_FIXTURES['last_missing'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 3, 30, 17, 45),
                'fields': {'Consumption': 1.0, 'Purchased': 3.0}
            }
        ]
        self.assertListEqual(got, expected)

    def test_to_influxdb_point_partially_missing(self):
        """Checks conversion to influxdb for response with missing value in the beginning."""
        got = SolarEdgeResponseMapper._to_influxdb_point(
            self.RESPONSE_FIXTURES['partially_missing'],
            time_zone=self.time_zone,
            measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 3, 30, 17, 45),
                'fields': {'Consumption': 1.0, 'Purchased': 3.0}
            },
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 3, 30, 18, 0),
                'fields': {'Consumption': 2.0, 'Purchased': 0.0}
            }
        ]
        self.assertListEqual(got, expected)

    # to_influxdb_point

    def test_to_influxdb_point_multiple_responses(self):
        """Checks conversion to influxdb for regular response."""
        response_json = [
            {
                'powerDetails': {
                    'timeUnit': 'QUARTER_OF_AN_HOUR',
                    'unit': 'W',
                    'meters': [
                        {'type': 'Consumption', 'values': [
                            {'date': '2020-04-14 09:30:00', 'value': 1.0},
                        ]},
                        {'type': 'Purchased', 'values': [
                            {'date': '2020-04-14 09:30:00', 'value': 2.0},
                        ]}
                    ]
                }
            },
            {
                'powerDetails': {
                    'timeUnit': 'QUARTER_OF_AN_HOUR',
                    'unit': 'W',
                    'meters': [
                        {'type': 'Consumption', 'values': [
                            {'date': '2020-04-14 09:45:00', 'value': 3.0}
                        ]},
                        {'type': 'Purchased', 'values': [
                            {'date': '2020-04-14 09:45:00', 'value': 4.0}
                        ]}
                    ]
                }
            },
        ]
        got = SolarEdgeResponseMapper.to_influxdb_point(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 4, 14, 7, 30),
                'fields': {'Consumption': 1.0, 'Purchased': 2.0},
            },
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 4, 14, 7, 45),
                'fields': {'Consumption': 3.0, 'Purchased': 4.0},
            }
        ]
        self.assertListEqual(got, expected)


class TestTibberResponseMapper(TestCase):
    """TestTibberResponseMapper contains the test cases for the TibberResponseMapper class."""

    def test_control_data_to_influxdb_point(self):
        """Checks prices to influxdb."""
        response = {
            'energy': 0.0937,
            'tax': 0.222,
            'total': 0.3157,
            'startsAt': '2024-07-21T23:00:00.000+02:00',
            'level': 'NORMAL'
        }
        time = datetime.datetime(
            2024, 7, 21, 23, 00, tzinfo=datetime.timezone(datetime.timedelta(seconds=7200))
        )
        got = TibberResponseMapper.to_influxdb_point(response)
        expected = [
            {
                "measurement": 'energy_prices_euro',
                "time": time,
                "fields": {
                    'energy': 0.0937,
                    'tax': 0.222,
                    'total': 0.3157,
                    'level': 'NORMAL'
                },
            }
        ]
        self.assertListEqual(got, expected)


class TestGardenaResponseMapper(TestCase):
    """TestGardenaResponseMapper contains the test cases for the GardenaResponseMapper class."""

    def setUp(self):
        """Prepare test fixtures."""
        self.sm = SmartSystem(
            client_id="gardena_application_id", client_secret="gardena_application_secret"
        )

    def test_control_data_to_influxdb_point(self):
        """Checks conversion to influxdb for irrigation control device."""
        control = SmartIrrigationControl(self.sm, smart_irrigation_fixture)
        time = 3
        got = GardenaResponseMapper.control_data_to_influxdb_point(control, time)
        tags = {
            'name': "Irrigation Control",
            'id': "28c26146-d4c1-42d7-964a-89f5237550ce",
            'type': 'SMART_IRRIGATION_CONTROL'
        }
        expected = [
            {
                "measurement": 'garden_valves_activity',
                "time": time,
                "fields": {
                    'state': int(activity == 'CLOSED')
                },
                "tags": {
                    **tags,
                    "activity": activity,
                    "valve_name": f'Valve {i}',
                    "valve_id": f'28c26146-d4c1-42d7-964a-89f5237550ce:{i}',
                }
            }
            for activity in GardenaResponseMapper.VALVE_ACTIVITY
            for i in range(1, 7)
        ]
        self.assertListEqual(got, expected)

    def test_soil_sensor_data_to_influxdb_point_nan(self):
        """Checks conversion to influxdb for sensor device with N/A values."""
        sensor = Sensor(self.sm, soil_sensor_fixture)
        time = 3
        got = GardenaResponseMapper.soil_sensor_data_to_influxdb_point(sensor, time)
        tags = {
            'name': "Sensor",
            'id': "a134596e-6127-4020-aaa5-b6d2f24d0d03",
            'type': 'SENSOR'
        }
        expected = [
            {
                'measurement': 'garden_system_battery_percentage',
                'time': time,
                'fields': {'battery': 93},
                'tags': tags
            },
            {
                'measurement': 'garden_temperature_celsius',
                'time': time,
                'fields': {'temperature': 22},
                'tags': {**tags, 'environment': 'soil'}
            },
            {
                'measurement': 'garden_humidity_percentage',
                'time': time,
                'fields': {'humidity': 0},
                'tags': {**tags, 'environment': 'soil'}
            },
            {
                'measurement': 'garden_rf_link_level_percentage',
                'time': time,
                'fields': {'rf_link_level': 70},
                'tags': tags
            }
        ]
        self.assertListEqual(got, expected)

    def test_sensor_data_to_influxdb_point(self):
        """Checks conversion to influxdb for sensor device."""
        sensor = Sensor(self.sm, sensor_fixture)
        time = 3
        got = GardenaResponseMapper.sensor_data_to_influxdb_point(sensor, time)
        tags = {
            'name': "Sensor",
            'id': "a134596e-6127-4020-aaa5-b6d2f24d0d03",
            'type': 'SENSOR'
        }
        expected = [
            {
                'measurement': 'garden_system_battery_percentage',
                'time': time,
                'fields': {'battery': 93},
                'tags': tags
            },
            {
                'measurement': 'garden_temperature_celsius',
                'time': time,
                'fields': {'temperature': 22},
                'tags': {**tags, 'environment': 'soil'}
            },
            {
                'measurement': 'garden_humidity_percentage',
                'time': time,
                'fields': {'humidity': 0},
                'tags': {**tags, 'environment': 'soil'}
            },
            {
                'measurement': 'garden_rf_link_level_percentage',
                'time': time,
                'fields': {'rf_link_level': 70},
                'tags': tags
            },
            {
                'measurement': 'garden_temperature_celsius',
                'time': time,
                'fields': {'temperature': 21},
                'tags': {**tags, 'environment': 'ambient'}
            },
            {
                'measurement': 'garden_light_intensity_lux',
                'time': time,
                'fields': {'light_intensity': 15},
                'tags': tags
            },
        ]
        self.assertListEqual(got, expected)


class TestTechemResponseMapper(TestCase):
    """TestTechemResponseMapper contains the test cases for the TechemResponseMapper class."""

    def test_to_influxdb_point(self):
        """Checks conversion to influxdb."""
        response = set([
            b'b36446850452301534543CDF7A1009F297C9600881F010080F391ACB2A45C76AA24655A05E5C928932C028921917C0A79E24F460585C59A7DE245F86791B00C',  # noqa
            b'',  # to be ingored
            b'b36446850462301534543CDF7A1009F297C9700881F010080F391ACB2A45C76AA24655A05E5C928932C028921917C0A79E24F460585C59A7DE245F86791B00C'  # noqa
        ])
        time = datetime.datetime(2020, 3, 30, 17, 45),
        got = sorted(
            TechemResponseMapper.to_influxdb_point(time, response),
            key=lambda m: m['tags']['id']
        )

        expected = [
            {
                'measurement': 'heat_energy_watthours',
                'time': time,
                'fields': {'Total_Consumption': 38811000},
                'tags': {'id': 53012345}
            },
            {
                'measurement': 'heat_energy_watthours',
                'time': time,
                'fields': {'Total_Consumption': 39067000},
                'tags': {'id': 53012346}
            }
        ]
        self.assertListEqual(got, expected)
