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

    def get_installation_date(self):
        """Returns the installation date of the photovoltaic system.

        Queries list end point of API. The call is cached it will return
        the same result when called twice.

        Returns:
            datetime.datetime: installation date (localized)
        """
        return self.get_tz().localize(
            datetime.datetime.fromisoformat(self.get_meta()['installationDate'])
        )

    def get_tz(self):
        """Returns time zone.

        Queries list end point of API. The call is cached it will return
        the same result when called twice.

        Returns:
            pytz.timezone: system time zone
        """
        return pytz.timezone(self.get_meta()['location']['timeZone'])

    @staticmethod
    def _get_date_ranges(start_datetime, end_datetime):
        """Split date range by months.

        The SolarEdge API is limited to one-month period, i.e., period between endTime and
        startTime should not exceed one month. This function splits the date range into
        chunks by months.

        Args:
            start_datetime (datetime.datetime): localized start datetime of range
            end_datetime (datetime.datetime): localized end datetime of range

        Returns:
            zip: list of start and end dates by months
        """
        end_dates = np.array(list(map(
            lambda d: d.replace(hour=23, minute=59, second=59),
            pd.date_range(start_datetime, end_datetime, freq='ME', normalize=False).to_pydatetime()
        )))

        start_dates = end_dates + datetime.timedelta(seconds=1)
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
        assert datetime.tzinfo is not None, "dates are expected to be localized"
        return datetime.astimezone(self.get_tz()).replace(microsecond=0).replace(tzinfo=None)

    def get_power_details(self, start_time=None, end_time=None):
        """Returns power details.

        Calls `powerDetails` endpoint of SolarEdge API. The parameters are not
        limited to one-month period. The first data point returned is the `start_time`
        rounded down to the full quarter of an hour. The last data point returned is the
        `end_time` of the last (not equal) full quarter of an hour. The last available data point
        might change until the next quarter of the hour.

        Example:
            self.get_power_details(
                start_time=datetime.datetime(2020, 4, 21, 20, 55),
                end_time=datetime.datetime(2020, 4, 21, 21, 0)
            )
            # returns data for '2020-04-21 20:45:00'

            self.get_power_details(
                start_time=datetime.datetime(2020, 4, 21, 20, 55),
                end_time=datetime.datetime(2020, 4, 21, 21, 1)
            )
            # returns data for '2020-04-21 20:45:00' and '2020-04-21 21:00:00'

        Args:
            start_time (datetime.datetime): start datetime of range;
                default: installation date (based on solaredge meta data)
            end_time (datetime.datetime): end datetime of range
                default: current timestamp

        Returns:
            dict: response
        """
        start_time = self._normalize_date(
            start_time or self.get_installation_date()
        )
        end_time = self._normalize_date(
            end_time or datetime.datetime.now(self.get_tz())
        )
        return [
            super(Solaredge, self).get_power_details(
                site_id=self.get_site_id(), start_time=s, end_time=e
            )
            for s, e in self._get_date_ranges(start_time, end_time)
        ]

    def get_energy_details(self, start_time=None, end_time=None):
        """Returns energy details.

        Calls `energyDetails` endpoint of SolarEdge API. The parameters are not
        limited to one-month period. The first data point returned is the `start_time`
        rounded down to the full quarter of an hour. The last data point returned is the
        `end_time` of the last (not equal) full quarter of an hour. The last available data point
        might change until the next quarter of the hour.

        Example:
            self.get_power_details(
                start_time=datetime.datetime(2020, 4, 21, 20, 55),
                end_time=datetime.datetime(2020, 4, 21, 21, 0)
            )
            # returns data for '2020-04-21 20:45:00'

            self.get_power_details(
                start_time=datetime.datetime(2020, 4, 21, 20, 55),
                end_time=datetime.datetime(2020, 4, 21, 21, 1)
            )
            # returns data for '2020-04-21 20:45:00' and '2020-04-21 21:00:00'

        Args:
            start_time (datetime.datetime): start datetime of range;
                default: installation date (based on solaredge meta data)
            end_time (datetime.datetime): end datetime of range
                default: current timestamp

        Returns:
            dict: response
        """
        start_time = self._normalize_date(
            start_time or self.get_installation_date()
        )
        end_time = self._normalize_date(
            end_time or datetime.datetime.now(self.get_tz())
        )
        return [
            super(Solaredge, self).get_energy_details(
                site_id=self.get_site_id(), start_time=s, end_time=e, time_unit='QUARTER_OF_AN_HOUR'
            )
            for s, e in self._get_date_ranges(start_time, end_time)
        ]
