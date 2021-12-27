# NanoCul to Monitor Techem
We use a NanoCul running on the raspberry pi to scrape metrics from the Techem Heat Meter. 


## Flash NanoCul
To update firmware and enable the wmbus run the following steps.

Install dependencies:

* `sudo apt-get install make gcc-avr avrdude avr-libc`
* `sudo apt-get install libcrypt-cbc-perl libdigest-crc-perl libssl-dev`
* `sudo cpan -i Crypt::OpenSSL::AES`
* `wget http://culfw.de/culfw-1.67.tar.gz`
* `tar xvfz culfw-1.67.tar.gz`

Adapt configs in board.h:

* activate HAS_MBUS and remove not needed stuff
* increase TTY_BUFSIZE 192

Compile sources:
    
* `cd culfw-1.67/Devices/nanoCUL`
* `make`


Check that only one usb device is active:

* `ls -l /dev/serial/by-id/*`

Flash:

* `make program`


## Run NanoCul
Once the the Cul is flashed, you can communicate as follows:

* start (in screen 1): `screen -dmS nano_cul /dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0 38400`
* listen (in screen 2): `cat /dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0`
* check version (in screen 3): `echo V > /dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0`
* activate wmbus (in screen 3): `echo "brt" > /dev/serial/by-id/usb-SHK_NANO_CUL_868-if00-port0`

## References
* [techemAnalyser.php (FHEM)](https://github.com/fhem/fhem-mirror/blob/master/fhem/FHEM/32_TechemWZ.pm)
* [FHEM forum](https://forum.fhem.de/index.php?topic=72682.0)
