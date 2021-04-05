"""The module contains a handler to call the TankerKoenig API."""

import requests


class TankerKoenig:
    """TankerKoenig returns gas station prices.

    TankerKoenig queries the API to return gas station prices.

    Args:
        site_token(string): api key
    """

    DEFAULT_URL = 'https://creativecommons.tankerkoenig.de'

    def __init__(self, api_key):
        self.api_key = api_key

    def get_prices(self, station_ids):
        """Returns gas prices for given station station ids.

        Queries the Tankerkoenig API to return current gas station prices for given station ids.

        Args:
            station_ids(list): list of station ids

        Returns:
            dict: response
        """
        response = requests.get(
            f'{self.DEFAULT_URL}/json/prices.php?ids={",".join(station_ids)}&apikey={self.api_key}'
        )
        response.raise_for_status()
        return response.json()

    def get_station_details(self, station_id):
        """Returns details for given station station id.

        Queries the Tankerkoenig API to return station details for given station id.

        Args:
            str: station id

        Returns:
            dict: response
        """
        response = requests.get(
            f'{self.DEFAULT_URL}/json/detail.php?id={station_id}&apikey={self.api_key}'
        )
        response.raise_for_status()
        return response.json()

    def get_stations_details(self, station_ids):
        """Returns details for given station station ids.

        Queries the Tankerkoenig API to return station details for given station id.

        Args:
            station_ids(list): list of station ids

        Returns:
            dict: response
        """
        return {
            station_id: self.get_station_details(station_id)
            for station_id in station_ids
        }
