"""The module contains a wrapper of the SmartSystem API with additional functionality."""

import logging
import json
import websocket
from threading import Thread

from gardena import smart_system


class SmartSystem(smart_system.SmartSystem):
    """SmartSystem is a wrapper around the SmartSystem API with additional functionality.

    Provides easier way to connect and start web socket

    Args:
        email (string): email used to register gardena account
        password (string): gardena account password
        client_id (string): gardena application id
    """

    def __init__(self, *args, **kwargs):
        super(SmartSystem, self).__init__(*args, **kwargs)
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(self.level)


    def connect(self):
        """Starts web socket.

        Run authentification, update locations and devices, and start the web socket.

        Raises:
            AssertionError: If number of locations is not 1.
        """
        self.authenticate()
        self.update_locations()
        assert len(self.locations) == 1, "Number of locations found is not 1"
        self.location = list(self.locations.values())[0]
        self.update_devices(self.location)
        self.start_ws(self.location)


    def on_error(tself, error):
        self.logger.error(f"error : {error}")


    def on_close(self):
        self.logger.info("Connection close to gardena API")


    def on_open(self):
        self.logger.info("Connected to Gardena API")


    def create_websocket(self, location):
        """Create a new WebSocket endpoint.

        Call gardena websocket endpoint to create new websocket endpoint to retrieve realtime events.

        Returns:
           string: websocket endpoint
        """
        args = {
            "data": {
                "type": "WEBSOCKET",
                "attributes": {"locationId": location.id},
                "id": "does-not-matter",
            }
        }
        r = self.oauth_session.post(
            f"{self.SMART_HOST}/v1/websocket",
            headers=self.create_header(True),
            data=json.dumps(args, ensure_ascii=False),
        )
        r.raise_for_status()
        return r.json()["data"]["attributes"]["url"]


    def start_ws(self, location):
        """Start websocket app.

        This is a copy from the (py-smart-gardena)[https://github.com/grm/py-smart-gardena/blob/master/src/gardena/smart_system.py], # noqa
        but restarts the socket after error (e.g., expired authentification).

        Arguments:
            location (gardena.location.Location): Keep information about gardena location and devices
        """
        ws = websocket.WebSocketApp(
            self.create_websocket(location),
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close,
            on_open=self.on_open,
        )
        self.wst = Thread(
            target=ws.run_forever, kwargs={"ping_interval": 60, "ping_timeout": 5}
        )
        self.wst.daemon = True
        self.wst.start()
