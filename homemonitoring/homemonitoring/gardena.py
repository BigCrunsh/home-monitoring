"""The module contains a wrapper of the SmartSystem API with additional functionality."""

import time
import json
import websocket
from threading import Thread

from gardena import smart_system


class Client(smart_system.Client):
    """Client encapsulate websocket app response logic.

    This is a copy from the (py-smart-gardena)[https://github.com/grm/py-smart-gardena/blob/master/src/gardena/smart_system.py], # noqa
    but adding a sleep to make the restart succesful.
    """
    def on_close(self):
        """Method to be called when connection gets closed."""
        self.live = False
        self.logger.info("Connection close to gardena API")
        if not self.should_stop:
            time.sleep(5)
            self.logger.info("Restarting websocket")
            self.smart_system.start_ws(self.location)


class SmartSystem(smart_system.SmartSystem):
    """SmartSystem is a wrapper around the SmartSystem API with additional functionality.

    Provides easier way to connect and start web socket

    Args:
        email (string): email used to register gardena account
        password (string): gardena account password
        client_id (string): gardena application id
    """

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

    def start_ws(self, location):
        """Start websocket app.

        This is a copy from the (py-smart-gardena)[https://github.com/grm/py-smart-gardena/blob/master/src/gardena/smart_system.py], # noqa
        but to call an on close function with delay.

        Arguments:
            location (gardena.location.Location): Keep information about gardena location and devices
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
        response = r.json()
        ws_url = response["data"]["attributes"]["url"]
        if self.client is None:
            self.client = Client(self, level=self.level, location=location)
        self.ws = websocket.WebSocketApp(
            ws_url,
            on_message=self.client.on_message,
            on_error=self.client.on_error,
            on_close=self.client.on_close,
            on_open=self.client.on_open,
        )
        wst = Thread(
            target=self.ws.run_forever, kwargs={"ping_interval": 60, "ping_timeout": 5}
        )
        wst.daemon = True
        wst.start()
