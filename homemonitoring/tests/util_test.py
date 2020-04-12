import datetime
import pytz

import numpy as np
from unittest import TestCase

from homemonitoring.util import get_date_ranges


class TestUtils(TestCase):

    def test_get_date_ranges(self):
        time_zone = 'Europe/Berlin'
        tz = pytz.timezone(time_zone)

        # start and end in same quarter of hour
        start_datetime = datetime.datetime(2020, 4, 11, 11, 58, 10, 20, tzinfo=tz)
        end_datetime = datetime.datetime(2020, 4, 11, 11, 59, 10, 20, tzinfo=tz)
        s, e = get_date_ranges('Europe/Berlin', start_datetime, start_datetime)
        np.testing.assert_equal(s, np.array([]))
        np.testing.assert_equal(e, np.array([]))

        # end is new quarter
        end_datetime = datetime.datetime(2020, 4, 11, 12, 0, 0, 0, tzinfo=tz)
        s, e = get_date_ranges('Europe/Berlin', start_datetime, end_datetime)
        np.testing.assert_equal(s, np.array([end_datetime.replace(tzinfo=None)]))
        np.testing.assert_equal(e, np.array([end_datetime.replace(tzinfo=None)]))

        # dist between start and end is more than a month (has to be split)
        end_datetime = datetime.datetime(2020, 5, 11, 12, 0, 0, 0, tzinfo=tz)
        s, e = get_date_ranges('Europe/Berlin', start_datetime, end_datetime)
        np.testing.assert_equal(s, np.array([
            datetime.datetime(2020, 4, 11, 12, 0),  # start rounded to full quarter
            datetime.datetime(2020, 5, 1, 0, 0)  # first day of next month
        ]))

        np.testing.assert_equal(e, np.array([
            datetime.datetime(2020, 4, 30, 0, 0),  # last day of month
            end_datetime.replace(tzinfo=None)
        ]))
