import datetime
import pytz

import influxdb


class InfluxDBClient(influxdb.InfluxDBClient):

    def get_latest_timestamp(self, measurement_name):
        res = self.query(f"SELECT * from {measurement_name} ORDER BY DESC LIMIT 1")
        points = list(res.get_points(measurement=measurement_name))
        print(points)
        assert len(points) < 2
        if len(points) == 0:
            return None
        return pytz.utc.localize(datetime.datetime.fromisoformat(points[0]['time'][:-1]))
