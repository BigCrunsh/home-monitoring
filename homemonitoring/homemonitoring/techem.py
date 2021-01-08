"""Decoder for data packets from the wireless M-Bus of the TECHEM heat meter Compat V."""


class TechemDecoder:
    """TechemDecoder decodes data received from the techem energy meter.

    TechemDecoder implements functionality to decode the wireless M-Bus data (little endian)
    of the TECHEM heat meter Compat V. This code is motivated by
    https://github.com/fhem/fhem-mirror/blob/master/fhem/FHEM/32_TechemWZ.pm

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
