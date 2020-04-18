"""The module contains test functions to test Solaredge API wrapper."""

from unittest import TestCase

import datetime
import pytz

from homemonitoring.solaredge import Solaredge


class TestSolaredge(TestCase):
    """TestSolaredge contains the test cases for the Solaredge class."""

    def setUp(self):
        """Sets common params for each test function."""
        self.time_zone = 'Europe/Berlin'
        self.tz = pytz.timezone(self.time_zone)
        self.start_datetime = self.tz.localize(datetime.datetime(2020, 4, 11, 11, 58, 10, 20))

    def test_init_start_date(self):
        """Checks iniatialization of start date."""
        # TODO: Check that installation date is properly parsed.
        pass

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

    def test_get_date_ranges_multiple_months(self):
        """Checks date range if start and end is more than a month apart (has to be split)."""
        self.maxDiff = None
        end_datetime = self.tz.localize(datetime.datetime(2020, 5, 11, 12))
        r = list(Solaredge._get_date_ranges(self.start_datetime, end_datetime))
        self.assertListEqual(r, [
            (self.start_datetime, self.tz.localize(datetime.datetime(2020, 4, 30))),
            (self.tz.localize(datetime.datetime(2020, 5, 1)), end_datetime)
        ])
