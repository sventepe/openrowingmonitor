'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  Some PM5 specific constants
*/
const constants = {
  serial: '123456789',
  model: 'PM5',
  name: 'PM5 123456789',
  hardwareRevision: '633',
  // see https://www.concept2.com/service/monitors/pm5/firmware for available versions
  firmwareRevision: '207',
  manufacturer: 'Concept2',
  ergMachineType: [0x05]
}

// PM5 uses 128bit UUIDs that are always prefixed and suffixed the same way
function getFullUUID (uuid) {
  return `ce06${uuid}43e511e4916c0800200c9a66`
}

export {
  getFullUUID,
  constants
}
