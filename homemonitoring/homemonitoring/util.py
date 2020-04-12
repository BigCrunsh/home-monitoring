import datetime

import logging
import logging.config


def get_latest_timestamp_influxdb(measurement_name, ifclient, default):
    res = ifclient.query(f"SELECT * from {measurement_name} ORDER BY DESC LIMIT 1")
    points = list(res.get_points(measurement=measurement_name))
    assert len(points) < 2
    if len(points) == 0:
        return default
    return datetime.datetime.fromisoformat(points[0]['time'][:-1])


class LoggerConfig(object):
    VERBOSE = False

    DEFAULT_LOG_DICT = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
            }
        },
        "handlers": {
            "default": {
                "level": "INFO",
                "formatter": "standard",
                "class": "logging.StreamHandler"
            }
        },
        "loggers": {
            "": {
                "handlers": ["default"],
                "level": "WARN",
                "propagate": True
            },
            "es_requests": {
                "propagate": True
            }
        }
    }

    @classmethod
    def set_verbose(cls, verbose):
        cls.VERBOSE = verbose

    @classmethod
    def get_logger(cls, name):
        logging.config.dictConfig(cls.DEFAULT_LOG_DICT)
        logger = logging.getLogger(name)
        logger.setLevel(logging.DEBUG if cls.VERBOSE else logging.INFO)
        return logger
