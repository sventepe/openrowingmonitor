'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  This file contains the default configuration of the Open Rowing Monitor.

  !!! Note that changes to this file will be OVERWRITTEN when you update to a new version
  of Open Rowing Monitor. !!!

  To change the settings you should modify the 'config/config.js' file. Simply copy the
  options that you would like to change into that file. If 'config.js' does not exist, you
  can use the example file from the 'install' folder.
*/
import rowerProfiles from './rowerProfiles.js'

export default {
  // Available log levels: trace, debug, info, warn, error, silent
  loglevel: {
    // The default log level
    default: 'info',
    // The log level of of the rowing engine (stroke detection and physics model)
    RowingEngine: 'warn'
  },

  // Defines the GPIO Pin that is used to read the sensor data from the rowing machine
  // see: https://www.raspberrypi.org/documentation/usage/gpio for the pin layout of the device
  // If you want to use the internal pull-up resistor of the Raspberry Pi you should
  // also configure the pin for that in /boot/config.txt, i.e. 'gpio=17=pu,ip'
  // see: https://www.raspberrypi.org/documentation/configuration/config-txt/gpio.md
  gpioPin: 17,

  // Experimental setting: enable this to boost the system level priority of the thread that
  // measures the rotation speed of the flywheel. This might improve the precision of the
  // measurements (especially on rowers with a fast spinning flywheel)
  gpioHighPriority: false,

  // Selects the Bluetooth Low Energy Profile
  // Supported modes: FTMS, FTMSBIKE, PM5
  bluetoothMode: 'FTMS',

  // Turn this on if you want support for Bluetooth Low Energy heart rate monitors
  // Will currenty connect to the first device found
  heartrateMonitorBLE: true,

  // Turn this on if you want support for ANT+ heart rate monitors
  // You will need an ANT+ USB stick for this to work, the following models might work:
  // - Garmin USB or USB2 ANT+ or an off-brand clone of it (ID 0x1008)
  // - Garmin mini ANT+ (ID 0x1009)
  heartrateMonitorANT: false,

  // The directory in which to store user specific content
  // currently this directory holds the recorded training sessions
  dataDirectory: 'data',

  // Stores the training sessions as TCX files
  createTcxFiles: true,

  // Stores the raw sensor data in CSV files
  createRawDataFiles: false,

  // Apply gzip compression to the recorded tcx training sessions file (tcx.gz)
  // This will drastically reduce the file size of the files (only around 4% of the original file)
  // Some training tools can directly work with gzipped tcx file, however for most training websites
  // you will have to unzip the files before uploading
  gzipTcxFiles: false,

  // Apply gzip compression to the ras sensor data recording files (csv.gz)
  gzipRawDataFiles: true,

  // Defines the name that is used to announce the FTMS Rower via Bluetooth Low Energy (BLE)
  // Some rowing training applications expect that the rowing device is announced with a certain name
  ftmsRowerPeripheralName: 'OpenRowingMonitor',

  // Defines the name that is used to announce the FTMS Bike via Bluetooth Low Energy (BLE)
  // Most bike training applications are fine with any device name
  ftmsBikePeripheralName: 'OpenRowingBike',

  // The interval for updating all web clients (i.e. the monitor) in ms.
  // Advised is to update at least once per second, to make sure the timer moves nice and smoothly.
  // Around 100 ms results in a very smooth update experience
  // Please note that a smaller value will use more network and cpu ressources
  webUpdateInterval: 1000,

  // The number of stroke phases (i.e. Drive or Recovery) used to smoothen the data displayed on your
  // screens (i.e. the monitor, but also bluetooth devices, etc.). A nice smooth experience is found at 6
  // phases, a much more volatile (but more accurate and responsive) is found around 3. The minimum is 1,
  // but for recreational rowers that might feel much too restless to be useful
  numOfPhasesForAveragingScreenData: 6,

  // The time between strokes in seconds before the rower considers it a pause. Default value is set to 10.
  // It is not recommended to go below this value, as not recognizing a stroke could result in a pause
  // (as a typical stroke is between 2 to 3 seconds for recreational rowers). Increase it when you have
  // issues with your stroke detection and the rower is pausing unexpectedly
  maximumStrokeTime: 10,

  // The rower specific settings. Either choose a profile from config/rowerProfiles.js or
  // define the settings individually. If you find good settings for a new rowing device
  // please send them to us (together with a raw recording of 10 strokes) so we can add
  // the device to the profiles.
  // !! Only change this setting in the config/config.js file, and leave this on DEFAULT as that
  // is the fallback for the default profile settings
  rowerSettings: rowerProfiles.DEFAULT,

  // command to shutdown the device via the user interface, leave empty to disable this feature
  shutdownCommand: 'halt',

  // Configures the connection to Strava (to directly upload workouts to Strava)
  // Note that these values are not your Strava credentials
  // Instead you have to create a Strava API Application as described here:
  // https://developers.strava.com/docs/getting-started/#account and use the corresponding values
  // When creating your Strava API application, set the "Authorization Callback Domain" to the IP address
  // of your Raspberry Pi
  // WARNING: if you enabled the network share via the installer script, then this config file will be
  // exposed via network share on your local network. You might consider disabling (or password protect)
  // the Configuration share in smb.conf
  // The "Client ID" of your Strava API Application
  stravaClientId: '',

  // The "Client Secret" of your Strava API Application
  stravaClientSecret: ''
}
