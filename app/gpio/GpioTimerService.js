'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  Measures the time between impulses on the GPIO pin. Started in a
  separate thread, since we want the measured time to be as close as
  possible to real time.
*/
import process from 'process'
import { Gpio } from 'onoff'
import os from 'os'
import config from '../tools/ConfigManager.js'
import log from 'loglevel'

log.setLevel(config.loglevel.default)

export function createGpioTimerService () {
  if (Gpio.accessible) {
    if (config.gpioHighPriority) {
      // setting top (near-real-time) priority for the Gpio process, as we don't want to miss anything
      log.debug('setting priority for the Gpio-service to maximum (-20)')
      try {
        // setting priority of current process
        os.setPriority(-20)
      } catch (err) {
        log.debug('need root permission to set priority of Gpio-Thread')
      }
    }
    // read the sensor data from one of the Gpio pins of Raspberry Pi
    const sensor = new Gpio(config.gpioPin, 'in', 'rising')
    // use hrtime for time measurement to get a higher time precision
    let hrStartTime = process.hrtime()
    if (config.gpioPin2) {
      let sensor1time = process.hrtime.bigint()
      let sensor2time = process.hrtime.bigint()
      log.debug('setting up second sensor at GPIO pin ' + config.gpioPin2)
      const sensor2 = new Gpio(config.gpioPin2, 'in', 'rising')
      let direction
      sensor.watch((err, value) => {
        if (err) {
          throw err
        }
        sensor1time = process.hrtime.bigint()
        const sensorDelta = sensor1time - sensor2time
        direction = sensorDelta > 40000000 ? 'Recovery' : 'Drive'

        const hrDelta = process.hrtime(hrStartTime)
        hrStartTime = process.hrtime()
        const delta = hrDelta[0] + hrDelta[1] / 1e9
        const deltaToSend = direction === 'Drive' ? delta : delta * -1
        // log.info('Sending delta: ' + deltaToSend)
        process.send(deltaToSend)
        // log.info(direction + '! sensor1: ' + sensor1time + ' sensor2: ' + sensor2 + ' Delta: ' + sensorDelta)
        // process.send(direction)
      })
      // sensor2 callback
      sensor2.watch((err, value) => {
        if (err) {
          throw err
        }
        // log.info('sensor2 hit at ' + process.hrtime.bigint())
        // const hrDelta = process.hrtime(hrStartTime2)
        sensor2time = process.hrtime.bigint()
        // const delta = hrDelta[0] + hrDelta[1] / 1e9
        // was übergeben? nur drive/recovery? Ausreichend um in Engine weitere Werte zu berechnen?
        // 2->1 drive
        // 1->2 recovery
        // send nur bei sensor1. bei 1 und 2 zeit wegschreiben. wenn bei 1 der 2er zeitstempel innerhalb von x MS liegt, Drive, sonst Recovery
        // process.send(delta)
      })
    } else {
      // assumes that GPIO-Port 17 is set to pullup and reed is connected to GND
      // therefore the value is 1 if the reed sensor is open
      sensor.watch((err, value) => {
        if (err) {
          throw err
        }
        const hrDelta = process.hrtime(hrStartTime)
        hrStartTime = process.hrtime()
        const delta = hrDelta[0] + hrDelta[1] / 1e9
        log.info('sensor1 default hit')
        process.send(delta)
      })
    }
  } else {
    log.info('reading from Gpio is not (yet) supported on this platform')
  }
}

createGpioTimerService()
