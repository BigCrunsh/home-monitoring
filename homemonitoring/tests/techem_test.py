"""The module contains test functions to test the techem heat meter decoder."""

from unittest import TestCase

from homemonitoring.techem import TechemDecoder


class TestTechemDecoder(TestCase):
    """TestTechemDecoder contains the test cases for the TechenDecoder class."""

    def setUp(self):
        """Sets use case to test."""
        self.id = 53012345
        self.consumption_before_cutoff = 38524
        self.consumption_since_cutoff = 287
        self.total_consumption = 38811
        self.decoder = TechemDecoder('b36446850452301534543CDF7A1009F297C9600881F010080F391ACB2A45C76AA24655A05E5C928932C028921917C0A79E24F460585C59A7DE245F86791B00C')  # noqa

    def test_init(self):
        """Checks init of TechemDecoder."""
        with self.assertRaises(AssertionError):
            TechemDecoder('')
        with self.assertRaises(AssertionError):
            TechemDecoder('b364568504523')

    def test__get_byte(self):
        """Checks private get byte function."""
        self.assertEqual(self.decoder._TechemDecoder__get_byte(0), '36')
        self.assertEqual(self.decoder._TechemDecoder__get_byte(4), '45')
        with self.assertRaises(AssertionError):
            self.decoder._TechemDecoder__get_byte(-1)
        with self.assertRaises(AssertionError):
            self.decoder._TechemDecoder__get_byte(100)

    def test_get_meter_id(self):
        """Checks get byte function."""
        self.assertEqual(self.decoder.get_meter_id(), self.id)

    def test_get_consumption_til_last_cutoff(self):
        """Checks get_consumption_til_last_cutoff."""
        self.assertEqual(
            self.decoder.get_consumption_til_last_cutoff(), self.consumption_before_cutoff
        )

    def test_get_consumption_since_last_cutoff(self):
        """Checks get_consumption_since_last_cutoff."""
        self.assertEqual(
            self.decoder.get_consumption_since_last_cutoff(), self.consumption_since_cutoff
        )

    def test_get_total_consumption(self):
        """Checks get_total_consumption."""
        self.assertEqual(
            self.decoder.get_total_consumption(), self.total_consumption
        )
