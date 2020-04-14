import datetime
import pytz

import pandas as pd
import numpy as np

import logging
import logging.config


def get_date_ranges(time_zone, start_datetime, end_datetime=None):
    # get time from right time zone
    tz = pytz.timezone(time_zone)
    if end_datetime is None:
        end_datetime = datetime.datetime.now(tz)

    # convert to same time zone
    assert end_datetime.tzinfo is not None
    assert start_datetime.tzinfo is not None
    end_datetime = end_datetime.astimezone(tz)
    start_datetime = start_datetime.astimezone(tz)

    # ignore ms and tzinfo
    start_datetime = start_datetime.replace(microsecond=0).replace(tzinfo=None)
    end_datetime = end_datetime.replace(microsecond=0).replace(tzinfo=None)

    # round to next 15 mins
    start_datetime += datetime.timedelta(minutes=15 - start_datetime.minute % 15)
    start_datetime -= datetime.timedelta(seconds=start_datetime.second)

    end_dates = pd.date_range(
        start_datetime, end_datetime, freq='M', normalize=True
    ).to_pydatetime()
    start_dates = end_dates+datetime.timedelta(days=1)

    if start_datetime <= end_datetime:
        end_dates = np.append(end_dates, end_datetime)
        start_dates = np.append(start_datetime, start_dates)
    return start_dates, end_dates


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
