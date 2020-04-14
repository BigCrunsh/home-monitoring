from unittest import TestCase
from unittest.mock import MagicMock

import datetime
import pytz
from influxdb.resultset import ResultSet

from homemonitoring.influxdb import InfluxDBClient


class TestInfluxDBClient(TestCase):

    def test_get_latest_timestamp(self):
        measurement_name = 'test'
        ifclient = InfluxDBClient()
        response = ResultSet({
            "series": [{
                    "name": measurement_name,
                    "columns": ["time", "Consumption"],
                    "values": [
                        ["2020-04-14T11:15:00Z", 137.7605],
                    ]
            }]
        })
        ifclient.query = MagicMock(return_value=response)
        got = ifclient.get_latest_timestamp(measurement_name)
        expected = pytz.utc.localize(datetime.datetime(2020, 4, 14, 11, 15))
        self.assertEqual(got, expected)

    def test_get_latest_timestamp_missing_measurement(self):
        ifclient = InfluxDBClient()
        ifclient.query = MagicMock(return_value=ResultSet({}))
        got = ifclient.get_latest_timestamp('random')
        self.assertIsNone(got)
