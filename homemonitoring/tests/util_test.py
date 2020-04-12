import datetime

from unittest import TestCase

from homemonitoring.util import get_date_ranges


class TestUtils(TestCase):

    def test_get_date_ranges(self):
        start_datetime = datetime.datetime(2020, 4, 11)
        print(get_date_ranges('Europe/Berlin', start_datetime, start_datetime))
        assert False
