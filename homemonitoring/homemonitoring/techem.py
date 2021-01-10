"""Decoder for data packets from the wireless M-Bus of the TECHEM heat meter Compat V."""


class TechemDecoder:
    """TechemDecoder decodes data received from the techem energy meter.

    TechemDecoder implements functionality to decode the wireless M-Bus data
    of the TECHEM energy meter Compat V. This code is motivated by
    https://github.com/fhem/fhem-mirror/blob/master/fhem/FHEM/32_TechemWZ.pm

    The string 'b3644685045230153...' is a pairwise byte encoding as little endian as follows:

    0     36        number of bytes
    1     44        control field
    2-3   5068      vendor
    4-7   53012345  heat meter ID
    ...

    Args:
        data(string): byte string received
    """
    BYTE_POS = {
        'id': [4, 5, 6, 7],
        'value_last_period': [16, 17, 18],
        'value_current_period': [20, 21, 22]
    }

    def __init__(self, data):
        self.data = data

    def __get_byte(self, offset):
        """Return byte pair ignoring the first 'b' of data paket.

        Args:
            offset(int): offset of byte pairs

        Returns:
            string: byte pair
        """
        pos = offset * 2 + 1
        assert offset >= 0, "Offset must be non-negative"
        assert len(self.data) > pos, "Pair offset must be smaller than half data length"
        return self.data[pos:pos + 2]

    def __get_byte_by_category(self, cat):
        """Return bytes for each category of information.

        Args:
            cat(string): name of encoded category

        Returns:
            string: bytes for category
        """
        return ''.join(map(self.__get_byte, self.BYTE_POS[cat][::-1]))

    def get_meter_id(self):
        """Return id of heat meter.

        Returns:
            int: heat meter id
        """
        return int(self.__get_byte_by_category('id'))

    def get_consumption_til_last_cutoff(self):
        """Return heat consumption of the last billing period.

        Returns:
            int: heat consumption in kWh
        """
        return int(self.__get_byte_by_category('value_last_period'), 16)

    def get_consumption_since_last_cutoff(self):
        """Return heat consumption of the current billing period.

        Returns:
            int: heat consumption in kWh
        """
        return int(self.__get_byte_by_category('value_current_period'), 16)

    def get_total_consumption(self):
        """Return total heat consumption.

        Returns:
            int: heat consumption in kWh
        """
        return self.get_consumption_til_last_cutoff() + self.get_consumption_since_last_cutoff()
