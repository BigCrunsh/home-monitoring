"""The module contains test functions to test Solaredge API wrapper."""

from unittest import TestCase
from unittest.mock import MagicMock, patch

import datetime
import pytz

from homemonitoring.solaredge import Solaredge


class TestSolaredge(TestCase):
    """TestSolaredge contains the test cases for the Solaredge class."""

    def setUp(self):
        """Sets common params for each test function."""
        self.time_zone = 'Europe/Berlin'
        self.site_id = 123
        self.installation_date = datetime.datetime(2019, 9, 6)
        self.meta = {
            'sites': {
                'count': 1,
                'site': [{
                    'id': self.site_id,
                    'installationDate': self.installation_date.strftime('%Y-%m-%d'),
                    'location': {
                        'country': 'Germany',
                        'timeZone': self.time_zone
                    }
                }]
            }
        }
        self.tz = pytz.timezone(self.time_zone)
        self.start_datetime = self.tz.localize(datetime.datetime(2020, 4, 11, 11, 58, 10))
        self.api = Solaredge('api-key')
        self.api.get_list = MagicMock(return_value=self.meta)

    # _get_date_ranges

    def test_get_date_ranges_start_after_end(self):
        """Checks date range if start and end in same quarter of hour."""
        end_datetime = self.tz.localize(datetime.datetime(2020, 4, 11, 12))
        r = list(Solaredge._get_date_ranges(end_datetime, self.start_datetime))
        self.assertListEqual(r, [])

    def test_get_date_ranges_same_month(self):
        """Checks date range if end in in another quarter of hour."""
        end_datetime = self.tz.localize(datetime.datetime(2020, 4, 11, 12))
        r = list(Solaredge._get_date_ranges(self.start_datetime, end_datetime))
        self.assertListEqual(r, [
            (self.start_datetime, end_datetime)
        ])

    def test_get_date_ranges_last_day_of_month(self):
        """Checks time range for last day in months."""
        start_time = self.tz.localize(datetime.datetime(2020, 3, 30, 23))
        end_time = self.tz.localize(datetime.datetime(2020, 3, 31))
        r = list(Solaredge._get_date_ranges(start_time, end_time))
        self.assertListEqual(r, [(start_time, end_time)])

    def test_get_date_ranges_multiple_months(self):
        """Checks date range if start and end is more than a month apart (has to be split)."""
        end_datetime = self.tz.localize(datetime.datetime(2020, 5, 11, 12))
        r = list(Solaredge._get_date_ranges(self.start_datetime, end_datetime))
        print(r)
        self.assertListEqual(r, [
            (self.start_datetime, self.tz.localize(datetime.datetime(2020, 4, 30, 23, 59, 59))),
            (self.tz.localize(datetime.datetime(2020, 5, 1)), end_datetime)
        ])

    # get meta data

    def test_get_meta(self):
        """Checks retrieval of meta data."""
        got = self.api.get_meta()
        self.assertDictEqual(got, self.meta['sites']['site'][0])

    def test_get_meta_cached(self):
        """Checks retrieval of cached meta data."""
        value = 1
        self.api.meta = value
        got = self.api.get_meta()
        self.assertEqual(got, value)

    def test_get_site_id(self):
        """Checks retrieval of meta data (site id)."""
        got = self.api.get_site_id()
        self.assertEqual(got, self.site_id)

    def test_get_installation_date(self):
        """Checks retrieval of meta data (installation date)."""
        got = self.api.get_installation_date()
        expected = self.tz.localize(self.installation_date)
        self.assertEqual(got, expected)

    def test_get_tz(self):
        """Checks retrieval of meta data (time zone)."""
        got = self.api.get_tz()
        self.assertEqual(got, self.tz)

    # _normalize_date

    def test_normalize_date(self):
        """Checks date normalization function."""
        date = pytz.utc.localize(datetime.datetime(2020, 4, 11, 11, 58, 10, 1))
        got = self.api._normalize_date(date)
        expected = datetime.datetime(2020, 4, 11, 13, 58, 10)
        self.assertEqual(got, expected)

    def test_normalize_date_not_localized_input(self):
        """Checks date normalization function with non localized input."""
        with self.assertRaises(AssertionError):
            self.api._normalize_date(self.installation_date)

    # api calls

    @patch("solaredge.Solaredge.get_power_details")
    def test_get_power_details(self, mock):
        """Checks get power details call."""
        self.api.get_power_details(self.start_datetime, self.start_datetime)
        mock.assert_called_once_with(
            site_id=self.site_id,
            start_time=datetime.datetime(2020, 4, 11, 11, 58, 10),
            end_time=datetime.datetime(2020, 4, 11, 11, 58, 10),
        )

    @patch("solaredge.Solaredge.get_energy_details")
    def test_get_energy_details(self, mock):
        """Checks get energy details call."""
        self.api.get_energy_details(self.start_datetime, self.start_datetime)
        mock.assert_called_once_with(
            site_id=self.site_id,
            start_time=datetime.datetime(2020, 4, 11, 11, 58, 10),
            end_time=datetime.datetime(2020, 4, 11, 11, 58, 10),
            time_unit='QUARTER_OF_AN_HOUR'
        )
