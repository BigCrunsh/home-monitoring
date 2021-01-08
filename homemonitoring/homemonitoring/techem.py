"""Decoder for data packets from the wireless M-Bus of the TECHEM heat meter Compat V."""


class TechemDecoder:
    """TechemDecoder decodes data received from the techem energy meter.

    TechemDecoder implements functionality to decode the wireless M-Bus data
    of the TECHEM heat meter Compat V. This code is motivated by
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

    def __init__(self, data):
        self.data = data

    def __get_byte(self, offset):
        """Return byte pair ignoring the first 'b' of data paket.

        Args:
            offset(int): offset of byte pairs
        """
        pos = offset * 2 + 1
        assert offset >= 0, "Offset must be non-negative"
        assert len(self.data) > pos, "Pair offset must be smaller than half data length"
        return self.data[pos:pos + 2]

    def get_meter_id(self):
        """Return id of heat meter."""
        return int(
            self.__get_byte(7) + self.__get_byte(6) + self.__get_byte(5) + self.__get_byte(4)
        )
