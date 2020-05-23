"""The module contains a wrapper of the SmartSystem API with additional functionality."""

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
