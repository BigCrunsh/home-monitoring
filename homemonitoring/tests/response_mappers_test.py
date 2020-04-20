"""The module contains test functions to test response mappers."""

import datetime
import pandas as pd

from unittest import TestCase

from homemonitoring.response_mappers import SolarEdgeResponseMapper


class TestSolarEdgeResponseMapper(TestCase):
    """TestSolarEdgeResponseMapper contains the test cases for the SolarEdgeResponseMapper class."""

    def setUp(self):
        """Sets common params for each test function."""
        self.measurement_name = 'electricity_power_watt'
        self.time_zone = 'Europe/Berlin'

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

    def test_to_pandas_df(self):
        """Checks conversion to pandas dataframe."""
        response_json = {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [
                        {'date': '2020-04-14 09:45:00', 'value': 1.0},
                        {'date': '2020-04-14 10:00:00', 'value': 2.0}
                    ]},
                    {'type': 'Purchased', 'values': [
                        {'date': '2020-04-14 09:45:00', 'value': 3.0},
                        {'date': '2020-04-14 10:00:00', 'value': 4.0}
                    ]}
                ]
            }
        }
        got = SolarEdgeResponseMapper._to_pandas_df(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        expected = pd.DataFrame({
            'Consumption': {
                datetime.datetime(2020, 4, 14, 7, 45): 1.0,
                datetime.datetime(2020, 4, 14, 8, 0): 2.0
            },
            'Purchased': {
                datetime.datetime(2020, 4, 14, 7, 45): 3.0,
                datetime.datetime(2020, 4, 14, 8, 0): 4.0
            }
        })
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    def test_to_pandas_df_dst(self):
        """Checks conversion to pandas dataframe in case of daylight saving time."""
        response_json = {
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
        }
        got = SolarEdgeResponseMapper._to_pandas_df(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        expected = pd.DataFrame({
            'Consumption': {
                datetime.datetime(2020, 3, 29, 0, 45): 1.0,
                datetime.datetime(2020, 3, 29, 2, 0): 3.0,
            }
        })
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    def test_to_pandas_df_missing_values_in_between(self):
        """Checks conversion to pandas dataframe for response with missing values in between.

        If data is missing in between for any field in the metrics the remaining values
        have to be filtered out.
        """
        response_json = {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Production', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 1.0},
                        {'date': '2020-03-30 20:00:00'},
                        {'date': '2020-03-30 20:15:00', 'value': 2.0},
                    ]},
                    {'type': 'FeedIn', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 3.0},
                        {'date': '2020-03-30 20:00:00', 'value': 4.0},
                        {'date': '2020-03-30 20:15:00', 'value': 5.0},
                    ]},
                ]
            }
        }
        got = SolarEdgeResponseMapper._to_pandas_df(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        expected = pd.DataFrame({
            'Production': {
                datetime.datetime(2020, 3, 30, 17, 45): 1.0
            },
            'FeedIn': {
                datetime.datetime(2020, 3, 30, 17, 45): 3.0
            }
        })
        expected.index.name = 'date'
        pd.testing.assert_frame_equal(got, expected)

    def test_to_influxdb_point_empty_response(self):
        """Checks conversion to influxdb for empty response."""
        response_json = {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [{'date': '2020-04-12 22:15:00'}]},
                    {'type': 'SelfConsumption', 'values': [{'date': '2020-04-12 22:15:00'}]},
                ]
            }
        }
        got = SolarEdgeResponseMapper._to_influxdb_point(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        self.assertListEqual(got, [])

    def test_to_influxdb_point_normal_response(self):
        """Checks conversion to influxdb for regular response."""
        response_json = {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Consumption', 'values': [
                        {'date': '2020-04-14 09:30:00', 'value': 1.0},
                        {'date': '2020-04-14 09:45:00', 'value': 2.0}
                    ]},
                    {'type': 'Purchased', 'values': [
                        {'date': '2020-04-14 09:30:00', 'value': 3.0},
                        {'date': '2020-04-14 09:45:00', 'value': 4.0}
                    ]}
                ]
            }
        }
        got = SolarEdgeResponseMapper._to_influxdb_point(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 4, 14, 7, 30),
                'fields': {'Consumption': 1.0, 'Purchased': 3.0},
            },
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 4, 14, 7, 45),
                'fields': {'Consumption': 2.0, 'Purchased': 4.0},
            }
        ]
        self.assertListEqual(got, expected)

    def test_to_influxdb_point_missing_values(self):
        """Checks conversion to influxdb for response with missing values."""
        response_json = {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Production', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 1.0},
                        {'date': '2020-03-30 20:00:00'},
                    ]},
                    {'type': 'FeedIn', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 3.0},
                        {'date': '2020-03-30 20:00:00', 'value': 4.0},
                    ]},
                ]
            }
        }
        got = SolarEdgeResponseMapper._to_influxdb_point(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 3, 30, 17, 45),
                'fields': {'Production': 1.0, 'FeedIn': 3.0}
            }
        ]
        self.assertListEqual(got, expected)

    def test_to_influxdb_point_missing_values_in_between(self):
        """Checks conversion to influxdb for response with missing values in between.

        If data is missing in between for any field in the metrics the remaining values
        have to be filtered out.
        """
        response_json = {
            'powerDetails': {
                'timeUnit': 'QUARTER_OF_AN_HOUR',
                'unit': 'W',
                'meters': [
                    {'type': 'Production', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 1.0},
                        {'date': '2020-03-30 20:00:00'},
                        {'date': '2020-03-30 20:15:00', 'value': 2.0},
                    ]},
                    {'type': 'FeedIn', 'values': [
                        {'date': '2020-03-30 19:45:00', 'value': 3.0},
                        {'date': '2020-03-30 20:00:00', 'value': 4.0},
                        {'date': '2020-03-30 20:15:00', 'value': 5.0},
                    ]},
                ]
            }
        }
        got = SolarEdgeResponseMapper._to_influxdb_point(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 3, 30, 17, 45),
                'fields': {'Production': 1.0, 'FeedIn': 3.0}
            }
        ]
        self.assertListEqual(got, expected)

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
