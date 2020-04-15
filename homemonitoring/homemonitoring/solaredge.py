import solaredge

import datetime
import pytz

import pandas as pd
import numpy as np


class Solaredge(solaredge.Solaredge):

    def __init__(self, *args, **kwargs):
        super(Solaredge, self).__init__(*args, **kwargs)
        self.meta = None

    def get_meta(self):
        if self.meta is None:
            self.meta = self.get_list()['sites']['site'][0]
        return self.meta

    def get_site_id(self):
        return self.get_meta()['id']

    @staticmethod
    def _get_date_ranges(start_datetime, end_datetime):
        end_dates = pd.date_range(
            start_datetime, end_datetime, freq='M', normalize=True
        ).to_pydatetime()
        start_dates = end_dates+datetime.timedelta(days=1)
        if start_datetime <= end_datetime:
            end_dates = np.append(end_dates, end_datetime)
            start_dates = np.append(start_datetime, start_dates)
        return zip(start_dates, end_dates)

    def _normalize_date(self, datetime):
        assert datetime.tzinfo is not None
        meta = self.get_meta()
        tz = pytz.timezone(meta['location']['timeZone'])
        return datetime.astimezone(tz).replace(microsecond=0).replace(tzinfo=None)

    def _init_start_date(self, start_time):
        meta = self.get_meta()
        s = self._normalize_date(
            start_time or meta['installationDate']
        )
        # round to next 15 mins
        s += datetime.timedelta(minutes=15 - s.minute % 15)
        s -= datetime.timedelta(seconds=s.second)
        return s

    def _init_end_date(self, end_time):
        meta = self.get_meta()
        tz = pytz.timezone(meta['location']['timeZone'])
        return self._normalize_date(
            end_time or datetime.datetime.now(tz)
        )

    def get_power_details(self, start_time=None, end_time=None):
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
        return [
            super(Solaredge, self).get_energy_details(
                site_id=self.get_site_id(), start_time=s, end_time=e, time_unit='QUARTER_OF_AN_HOUR'
            )
            for s, e in self._get_date_ranges(
                self._init_start_date(start_time),
                self._init_end_date(end_time)
            )
        ]
