'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  This manager creates the different Bluetooth Low Energy (BLE) Peripherals and allows
  switching between them
*/
import config from '../config.js'
import { createFtmsPeripheral } from './FtmsPeripheral.js'
import { createPm5Peripheral } from './Pm5Peripheral.js'
import log from 'loglevel'
import EventEmitter from 'node:events'

const modes = ['FTMS', 'FTMSBIKE', 'PM5']
function createPeripheralManager () {
  const emitter = new EventEmitter()
  let peripheral
  let mode

  createPeripheral(config.bluetoothMode)

  function getPeripheral () {
    return peripheral
  }

  function getPeripheralMode () {
    return mode
  }

  function switchPeripheralMode (newMode) {
    // if now mode was passed, select the next one from the list
    if (newMode === undefined) {
      newMode = modes[(modes.indexOf(mode) + 1) % modes.length]
    }
    createPeripheral(newMode)
  }

  function notifyMetrics (type, metrics) {
    peripheral.notifyData(metrics)
  }

  function notifyStatus (status) {
    peripheral.notifyStatus(status)
  }

  async function createPeripheral (newMode) {
    if (peripheral) {
      await peripheral.destroy()
      peripheral.off('controlPoint', emitControlPointEvent)
    }

    if (newMode === 'PM5') {
      log.info('bluetooth profile: Concept2 PM5')
      peripheral = createPm5Peripheral()
      mode = 'PM5'
    } else if (newMode === 'FTMSBIKE') {
      log.info('bluetooth profile: FTMS Indoor Bike')
      peripheral = createFtmsPeripheral({
        simulateIndoorBike: true
      })
      mode = 'FTMSBIKE'
    } else {
      log.info('bluetooth profile: FTMS Rower')
      peripheral = createFtmsPeripheral({
        simulateIndoorBike: false
      })
      mode = 'FTMS'
    }
    // todo: re-emitting is not that great, maybe use callbacks instead
    peripheral.on('control', emitControlPointEvent)

    peripheral.triggerAdvertising()

    emitter.emit('control', {
      req: {
        name: 'peripheralMode',
        peripheralMode: mode
      }
    })
  }

  function emitControlPointEvent (event) {
    emitter.emit('control', event)
  }

  return Object.assign(emitter, {
    getPeripheral,
    getPeripheralMode,
    switchPeripheralMode,
    notifyMetrics,
    notifyStatus
  })
}

export { createPeripheralManager }