"""The module contains test functions to test Tankerkoenig API wrapper."""

import tempfile
import os

from unittest import TestCase
from unittest.mock import MagicMock, patch

from homemonitoring.tankerkoenig import TankerKoenig


class TestTankerKoenig(TestCase):
    """TestTankerKoenig contains the test cases for the TankerKoenig class."""

    RESPONSE_DETAIL_FIXTURES = {
        "id_1": {
            "station": {"id": "id_1"}
        }
    }

    @patch("requests.get")
    def test_call_api(self, mock):
        """Checks function that composes API call."""
        apikey = 'apikey'
        ids = "1,2,3"
        api = TankerKoenig(apikey)
        api._call_api('details.php', ids=ids)
        mock.assert_called_with(
            'https://creativecommons.tankerkoenig.de/json/details.php',
            params={'ids': ids, 'apikey': apikey}
        )

    def test_get_station_details(self):
        """Checks get station details."""
        station_id = 'id_1'
        with tempfile.TemporaryDirectory() as tmp_dir:
            api = TankerKoenig('api-key', cache_dir=tmp_dir)

            def mock_call_api(endpoint, **params):
                return self.RESPONSE_DETAIL_FIXTURES[params['id']]
            api._call_api = MagicMock(side_effect=mock_call_api)

            # call "API"
            got = api.get_station_details(station_id, force_update=True)
            expected = {'station': {'id': 'id_1'}}
            self.assertDictEqual(got, expected)
            assert os.path.exists(os.path.join(tmp_dir, f'{station_id}.json'))
            api._call_api.assert_called_once()

            # this time from file
            got = api.get_station_details(station_id, force_update=False)
            self.assertDictEqual(got, expected)
            api._call_api.assert_called_once()  # API should not have been called again

            # this time force update
            got = api.get_station_details(station_id, force_update=True)
            self.assertDictEqual(got, expected)
            assert api._call_api.call_count == 2  # API should not have been called again
