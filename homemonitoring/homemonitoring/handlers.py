import requests


class HomeMonitoringHandler(object):

    def __init__(self, api_key, url):
        self.url = url
        self.api_key = api_key


class TankerKoenigHandler(object):
    DEFAULT_URL = 'https://creativecommons.tankerkoenig.de'

    def __init__(self, api_key, url=DEFAULT_URL):
        self.url = url
        self.api_key = api_key

    def get_prices(self, station_ids):
        response = requests.get(
            f'{self.url}/json/prices.php?ids={",".join(station_ids)}&apikey={self.api_key}'
        )
        response.raise_for_status()
        return response.json()
