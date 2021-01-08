"""The module contains test functions to test the techem heat meter decoder."""

from unittest import TestCase

from homemonitoring.techem import TechemDecoder


class TestTechemDecoder(TestCase):
    """TestTechemDecoder contains the test cases for the TechenDecoder class."""

    def test_init(self):
        """Checks data format validation."""
        TechemDecoder('')
