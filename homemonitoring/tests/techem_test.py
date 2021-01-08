"""The module contains test functions to test the techem heat meter decoder."""

from unittest import TestCase

from homemonitoring.techem import TechemDecoder


class TestTechemDecoder(TestCase):
    """TestTechemDecoder contains the test cases for the TechenDecoder class."""

    def test_init(self):
        """Checks data format validation."""
        TechemDecoder('')

    def test__get_byte(self):
        """Checks private get byte function."""
        decoder = TechemDecoder('b123456abcd')
        self.assertEqual(decoder._TechemDecoder__get_byte(0), '12')
        self.assertEqual(decoder._TechemDecoder__get_byte(4), 'cd')
        with self.assertRaises(AssertionError):
            decoder._TechemDecoder__get_byte(-1)
        with self.assertRaises(AssertionError):
            decoder._TechemDecoder__get_byte(5)
