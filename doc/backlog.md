# Development Roadmap for Open Rowing Monitor

This is the very minimalistic Backlog for further development of this project.

## Soon

* cleanup of the server.js start file
* figure out where to set the Service Advertising Data (FTMS.pdf p 15)
* Web UI: replace fullscreen button with exit Button when started from home screen
* investigate bug: crash, when one unsubscribe to BLE "Generic Attribute", probably a bleno bug "handleAttribute.emit is not a function"
* add photo of wired device to installation instructions
* what value should we use for split, if we are in a rowing pause? technically should be infinity...
* set up a Raspberry Pi with the installation instructions to see if they are correct

## Later

* implement the proprietary Concept2 PM BLE protocol as described here [Concept2 PM Bluetooth Smart Communication Interface](https://www.concept2.co.uk/files/pdf/us/monitors/PM5_BluetoothSmartInterfaceDefinition.pdf)
* add some attributes to BLE DeviceInformationService
* add a config file
* presets for rowing machine specific config parameters
* improve the physics model for waterrowers
* validate FTMS with more training applications and harden implementation
* make Web UI a proper Web Application (tooling and SPA framework)
* record the workout and show a visual graph of metrics
* export the workout

## Ideas

* add support for BLE Heart Rate Sensor and show pulse
* add video playback in background of Web UI
* implement or integrate some rowing games
* add possibility to define workouts (i.e. training intervals with goals)
* directly attach a touchscreen to the Raspberry Pi and automatically show WebUI on this in kiosk mode