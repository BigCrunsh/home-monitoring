"""The module contains test functions to test the techem heat meter decoder."""

from unittest import TestCase

from homemonitoring.techem import TechemDecoder


class TestTechemDecoder(TestCase):
    """TestTechemDecoder contains the test cases for the TechenDecoder class."""

    def setUp(self):
        """Sets common params for each test function."""
        self.id = 53012345
        self.decoder = TechemDecoder('b36446850452301534543CDF7A1009F297C9600881F010080F391ACB2A45C76AA24655A05E5C928932C028921917C0A79E24F460585C59A7DE245F86791B00C')  # noqa

    def test__get_byte(self):
        """Checks private get byte function."""
        decoder = TechemDecoder('b123456abcd')
        self.assertEqual(decoder._TechemDecoder__get_byte(0), '12')
        self.assertEqual(decoder._TechemDecoder__get_byte(4), 'cd')
        with self.assertRaises(AssertionError):
            decoder._TechemDecoder__get_byte(-1)
        with self.assertRaises(AssertionError):
            decoder._TechemDecoder__get_byte(5)

    def test_get_meter_id(self):
        """Checks private get byte function."""
        self.assertEqual(self.decoder.get_meter_id(), self.id)
