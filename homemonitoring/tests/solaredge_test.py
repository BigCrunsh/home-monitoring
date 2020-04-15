from unittest import TestCase

import datetime
import pytz

from homemonitoring.solaredge import Solaredge


class TestSolaredge(TestCase):

    def setUp(self):
        self.time_zone = 'Europe/Berlin'
        self.tz = pytz.timezone(self.time_zone)
        self.start_datetime = self.tz.localize(datetime.datetime(2020, 4, 11, 11, 58, 10, 20))

    def test_init_start_date(self):
        # Todo: check that installation date is properly parsed
        pass

    def test_get_date_ranges_start_after_end(self):
        """
        start and end in same quarter of hour
        """
        end_datetime = self.tz.localize(datetime.datetime(2020, 4, 11, 12))
        r = list(Solaredge._get_date_ranges(end_datetime, self.start_datetime))
        self.assertListEqual(r, [])

    def test_get_date_ranges_same_month(self):
        """
        end is new quarter
        """
        end_datetime = self.tz.localize(datetime.datetime(2020, 4, 11, 12))
        r = list(Solaredge._get_date_ranges(self.start_datetime, end_datetime))
        self.assertListEqual(r, [
            (self.start_datetime, end_datetime)
        ])

    def test_get_date_ranges_multiple_months(self):
        """
        dist between start and end is more than a month (has to be split)
        """
        self.maxDiff = None
        end_datetime = self.tz.localize(datetime.datetime(2020, 5, 11, 12))
        r = list(Solaredge._get_date_ranges(self.start_datetime, end_datetime))
        self.assertListEqual(r, [
            (self.start_datetime, self.tz.localize(datetime.datetime(2020, 4, 30))),
            (self.tz.localize(datetime.datetime(2020, 5, 1)), end_datetime)
        ])
