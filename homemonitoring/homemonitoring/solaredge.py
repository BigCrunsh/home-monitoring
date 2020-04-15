"""The module contains a wrapper of the Solaredge API with additional functionality."""

import solaredge

import datetime
import pytz

import pandas as pd
import numpy as np


class Solaredge(solaredge.Solaredge):
    """Solaredge is a wrapper around the Solaredge API with additional functionality.

    The Solaredge API is queried with date ranges. Date ranges are relative to the location
    of the photovoltaic system. The wrapper sets reasonable default values, normalizes dates
    to be compliant with the API call, and splits the call by month ranges.

    Args:
        site_token(string): api key
    """

    def __init__(self, *args, **kwargs):
        super(Solaredge, self).__init__(*args, **kwargs)
        self.meta = None

    def get_meta(self):
        """Returns solaredge meta data.

        Queries list end point of API. The call is cached it will return
        the same result when called twice.

        Returns:
            dict: meta data
        """
        if self.meta is None:
            self.meta = self.get_list()['sites']['site'][0]
        return self.meta

    def get_site_id(self):
        """Returns solaredge site id.

        Queries list end point of API. The call is cached it will return
        the same result when called twice.

        Returns:
            int: site id
        """
        return self.get_meta()['id']

    @staticmethod
    def _get_date_ranges(start_datetime, end_datetime):
        """Split date range by months.

        The SolarEdge API is limited to one-month period, i.e., period between endTime and
        startTime should not exceed one month. This function splits the date range into
        chunks by months.

        Args:
            start_datetime (datetime.datetime): start datetime of range
            end_datetime (datetime.datetime): end datetime of range

        Returns:
            zip: list of start and end dates by months
        """
        end_dates = pd.date_range(
            start_datetime, end_datetime, freq='M', normalize=True
        ).to_pydatetime()
        start_dates = end_dates + datetime.timedelta(days=1)
        if start_datetime <= end_datetime:
            end_dates = np.append(end_dates, end_datetime)
            start_dates = np.append(start_datetime, start_dates)
        return zip(start_dates, end_dates)

    def _normalize_date(self, datetime):
        """Normalizes datetime for SolarEdge API call.

        Normalizes `datetime` to be used in solaredge API, i.e.,
        - timezone is converted to time zone of system location
        - time zone info and microseconds are removed (API fails otherwise)

        Args:
            datetime (datetime.datetime): localized datetime to be normalized

        Raises:
            AssertionError: if datime misses tzinfo

        Returns:
            datetime.datetime: datetime normalized for solaredge API call
        """
        assert datetime.tzinfo is not None
        meta = self.get_meta()
        tz = pytz.timezone(meta['location']['timeZone'])
        return datetime.astimezone(tz).replace(microsecond=0).replace(tzinfo=None)

    def _init_start_date(self, start_time):
        """Initialize start time.

        Initializes `start_time` for API call. Specifically,
        - timezone is converted to time zone of system location
        - time zone info and microseconds are removed (API fails otherwise)
        - round to next 15 mins (time unit of API is quarter of an hour)

        Args:
            start_time (datetime.datetime): start datetime;
                default: installation date (based on solaredge meta data)

        Returns:
            datetime.datetime: normalized start date
        """
        meta = self.get_meta()
        s = self._normalize_date(
            start_time or meta['installationDate']
        )
        # round to next 15 mins
        s += datetime.timedelta(minutes=15 - s.minute % 15)
        s -= datetime.timedelta(seconds=s.second)
        return s

    def _init_end_date(self, end_time):
        """Initialize end time.

        Initializes `end_time` for API call. Specifically,
        - timezone is converted to time zone of system location
        - time zone info and microseconds are removed (API fails otherwise)

        Args:
            end_time (datetime.datetime): end datetime;
                default: current timestamp

        Returns:
            datetime.datetime: normalized end date
        """
        meta = self.get_meta()
        tz = pytz.timezone(meta['location']['timeZone'])
        return self._normalize_date(
            end_time or datetime.datetime.now(tz)
        )

    def get_power_details(self, start_time=None, end_time=None):
        """Returns power details.

        Calls `powerDetails` endpoint of SolarEdge API. The parameters are not
        limited to one-month period.

        Args:
            start_time (datetime.datetime): start datetime of range;
                default: installation date (based on solaredge meta data)
            end_time (datetime.datetime): end datetime of range
                default: current timestamp

        Returns:
            dict: response
        """
        return [
            super(Solaredge, self).get_power_details(
                site_id=self.get_site_id(), start_time=s, end_time=e
            )
            for s, e in self._get_date_ranges(
                self._init_start_date(start_time),
                self._init_end_date(end_time)
            )
        ]

    def get_energy_details(self, start_time=None, end_time=None):
        """Returns energy details.

        Calls `energyDetails` endpoint of SolarEdge API. The parameters are not
        limited to one-month period.

        Args:
            start_time (datetime.datetime): start datetime of range;
                default: installation date (based on solaredge meta data)
            end_time (datetime.datetime): end datetime of range
                default: current timestamp

        Returns:
            dict: response
        """
        return [
            super(Solaredge, self).get_energy_details(
                site_id=self.get_site_id(), start_time=s, end_time=e, time_unit='QUARTER_OF_AN_HOUR'
            )
            for s, e in self._get_date_ranges(
                self._init_start_date(start_time),
                self._init_end_date(end_time)
            )
        ]
