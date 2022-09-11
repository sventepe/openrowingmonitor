//replay von Recordings ans Laufen bringen und dann Anzeige mit LIT Playground Möglichkeiten um Transition erweitern
//wie replay von bestimmtem File auslösen?

// Aktive Quests und Fortschritt speichern, für Anzeige aufbereitet weitergeben
// Anzeige statt PerformanceDashboard -> Index.js
// ODER als Overlay von PerformanceDashboard?
//
// Quest Fortschritt soll in kleiner Kachel, aber auch im Vollbild funktionieren
// Overlay!

// Replay über RowingRecorder
// Auswahl des Recordings
// Über Button in Liste das Replay starten
// Tcx files auslesen, nach Datum sortieren, StartTime, TotalTimeSeconds, DistanceMeters ausgeben

'use strict'
/*
  Open Rowing Monitor, https://github.com/sventepe/openrowingmonitor

  A class to implement Gamification features
*/
import { fork } from 'child_process'
import fs from 'fs'
import readline from 'readline'
import log from 'loglevel'



function LoadHistory(){
  // rekursiv Tcx Dateien crawlen, parsen und Objekte erstellen
}















function recordRowingSession (filename) {
  // measure the gpio interrupts in another process, since we need
  // to track time close to realtime
  const gpioTimerService = fork('./app/gpio/GpioTimerService.js')
  gpioTimerService.on('message', (dataPoint) => {
    log.debug(dataPoint)
    fs.appendFile(filename, `${dataPoint}\n`, (err) => { if (err) log.error(err) })
  })
}

async function replayRowingSession (rotationImpulseHandler, options) {
  if (!options?.filename) {
    log.error('can not replay rowing session without filename')
    return
  }

  do {
    await replayRowingFile(rotationImpulseHandler, options)
  // infinite looping only available when using realtime
  } while (options.loop && options.realtime)
}

async function replayRowingFile (rotationImpulseHandler, options) {
  const fileStream = fs.createReadStream(options.filename)
  const readLine = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of readLine) {
    const dt = parseFloat(line)
    // if we want to replay in the original time, wait dt seconds
    if (options.realtime) await wait(dt * 1000)
    rotationImpulseHandler(dt)
  }
}

async function wait (ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export {
  recordRowingSession,
  replayRowingSession
}