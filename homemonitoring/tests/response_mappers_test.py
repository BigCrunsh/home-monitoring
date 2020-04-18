"""The module contains test functions to test response mappers."""

import datetime

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
        pass

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
        got = SolarEdgeResponseMapper.to_influxdb_point(
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
                        {'date': '2020-04-14 09:30:00', 'value': 316.1671},
                        {'date': '2020-04-14 09:45:00', 'value': 296.30615}
                    ]},
                    {'type': 'Purchased', 'values': [
                        {'date': '2020-04-14 09:30:00', 'value': 0.0},
                        {'date': '2020-04-14 09:45:00', 'value': 0.0}
                    ]}
                ]
            }
        }
        got = SolarEdgeResponseMapper.to_influxdb_point(
            response_json, time_zone=self.time_zone, measurement_name=self.measurement_name
        )
        expected = [
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 4, 14, 7, 30),
                'fields': {'Consumption': 316.1671, 'Purchased': 0.0},
            },
            {
                'measurement': self.measurement_name,
                'time': datetime.datetime(2020, 4, 14, 7, 45),
                'fields': {'Consumption': 296.30615, 'Purchased': 0.0},
            }
        ]
        self.assertListEqual(got, expected)

        # TODO: add test case for nan
