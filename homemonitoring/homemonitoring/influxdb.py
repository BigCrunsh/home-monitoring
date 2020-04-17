"""The module contains extensions of the influxdb client."""

import datetime
import pytz

import influxdb


class InfluxDBClient(influxdb.InfluxDBClient):
    """InfluxDBClient is a wrapper around the InfluxDB client with additional functionality.

    The InfluxDBClient extends the client by a funtion to get the timestamp of the latest entry
    of a measurement
    """

    def get_latest_timestamp(self, measurement_name):
        """Returns timestamp of a latest measurement.

        args:
            measurement_name (string): name of the measurement in InfluxDB

        Returns:
            datetime.datetime: timestamp of latest entry
        """
        res = self.query(f"SELECT * from {measurement_name} ORDER BY DESC LIMIT 1")
        points = list(res.get_points(measurement=measurement_name))
        print(points)
        assert len(points) < 2
        if len(points) == 0:
            return None
        return pytz.utc.localize(datetime.datetime.fromisoformat(points[0]['time'][:-1]))
