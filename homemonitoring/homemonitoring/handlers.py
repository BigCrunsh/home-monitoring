import requests


class HomeMonitoringHandler(object):

    def __init__(self, api_key, url):
        self.url = url
        self.api_key = api_key


class TankerKoenigHandler(object):
    DEFAULT_URL = 'https://creativecommons.tankerkoenig.de'
    DEFAULT_STATION_IDS = {
        "51d4b477-a095-1aa0-e100-80009459e03a": "Jet",
        "005056ba-7cb6-1ed2-bceb-8e5fec1a0d35": "Star"
    }

    def __init__(self, api_key, url=DEFAULT_URL):
        self.url = url
        self.api_key = api_key

    def get_prices(self, station_ids=DEFAULT_STATION_IDS.keys()):
        response = requests.get(
            f'{self.url}/json/prices.php?ids={",".join(station_ids)}&apikey={self.api_key}'
        )
        response.raise_for_status()
        return response.json()
