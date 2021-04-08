"""The module contains a handler to call the TankerKoenig API."""

import os
import json
import requests


class TankerKoenig:
    """TankerKoenig returns gas station prices.

    TankerKoenig queries the API to return gas station prices. Station details can be cached to
    avoid unnecessary calls to the API (rate limits).

    Args:
        site_token(string): api key
        cache_dir(string): directory to store station details
    """

    DEFAULT_URL = 'https://creativecommons.tankerkoenig.de'

    def __init__(self, api_key, cache_dir=None):
        self.api_key = api_key
        self.cache_dir = cache_dir

    def _call_api(self, endpoint, **params):
        response = requests.get(
            f'{self.DEFAULT_URL}/json/{endpoint}',
            params={**params, 'apikey': self.api_key}
        )
        response.raise_for_status()
        return response.json()

    def get_prices(self, station_ids):
        """Returns gas prices for given station station ids.

        Queries the Tankerkoenig API to return current gas station prices for given station ids.

        Args:
            station_ids(list): list of station ids

        Returns:
            dict: response
        """
        return self._call_api('prices.php', ids=",".join(station_ids))

    def get_station_details(self, station_id, force_update=False):
        """Returns details for given station station id.

        Queries the Tankerkoenig API to return station details for given station id.

        Args:
            str: station id
            force_update(bool): queries API and does not use cached results

        Returns:
            dict: response
        """
        if not force_update and self.cache_dir is not None:
            filename = os.path.join(self.cache_dir, f'{station_id}.json')
            try:
                with open(filename, 'r') as f:
                    return json.load(f)
            except IOError:
                print(f"File {filename} not accessible")

        jsn = self._call_api('detail.php', id=station_id)

        if self.cache_dir is not None:
            filename = os.path.join(self.cache_dir, f'{station_id}.json')
            with open(filename, 'w') as f:
                json.dump(jsn, f, sort_keys=True, indent=4)
        return jsn

    def get_stations_details(self, station_ids, force_update=False):
        """Returns details for given station station ids.

        Queries the Tankerkoenig API to return station details for given station id.

        Args:
            station_ids(list): list of station ids
            force_update(bool): queries API and does not use cached results

        Returns:
            dict: response
        """
        return {
            station_id: self.get_station_details(station_id, force_update)
            for station_id in station_ids
        }
