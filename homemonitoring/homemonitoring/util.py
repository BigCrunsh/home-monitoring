"""The module contains some commom util functiosn."""


import logging
import logging.config


class LoggerConfig(object):
    """LoggerConfig allows to configure logging consistently for the package.

    Example:
        LoggerConfig.set_verbose(True)
        logger = LoggerConfig.get_logger(__name__)
        logger.info('test')
    """

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
        """Sets logging verbosity level.

        Args:
            verbose (boolean): verbose or not.
        """
        cls.VERBOSE = verbose

    @classmethod
    def get_logger(cls, name):
        """Returns logger object.

        Returns logger with name.

        Args:
            name (string): logger name

        Returns:
            logging.Logger: Logger object
        """
        logging.config.dictConfig(cls.DEFAULT_LOG_DICT)
        logger = logging.getLogger(name)
        logger.setLevel(logging.DEBUG if cls.VERBOSE else logging.INFO)
        return logger
