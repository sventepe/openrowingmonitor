'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  This start file is currently a mess, as this currently is the devlopment playground to plug
  everything together while figuring out the physics and model of the application.
  todo: refactor this as we progress
*/
import child_process from 'child_process'
import { promisify } from 'util'
import log from 'loglevel'
import config from './tools/ConfigManager.js'
import { createRowingEngine } from './engine/RowingEngine.js'
import { createRowingStatistics } from './engine/RowingStatistics.js'
import { createWebServer } from './WebServer.js'
// eslint-disable-next-line no-unused-vars
import { replayRowingSession } from './tools/RowingRecorder.js'
import { createWorkoutRecorder } from './engine/WorkoutRecorder.js'
import { createWorkoutUploader } from './engine/WorkoutUploader.js'
const exec = promisify(child_process.exec)

// set the log levels
log.setLevel(config.loglevel.default)
for (const [loggerName, logLevel] of Object.entries(config.loglevel)) {
  if (loggerName !== 'default') {
    log.getLogger(loggerName).setLevel(logLevel)
  }
}

log.info(`==== Open Rowing Monitor ${process.env.npm_package_version || ''} ====\n`)
let peripheralManager = null
let antManager
if (config.bluetoothMode !== 'none') {
  import('./ble/PeripheralManager.js').then(exports => {
    peripheralManager = exports.createPeripheralManager()
    peripheralManager.on('control', (event) => {
      if (event?.req?.name === 'requestControl') {
        event.res = true
      } else if (event?.req?.name === 'reset') {
        log.debug('reset requested')
        resetWorkout()
        event.res = true
        // todo: we could use these controls once we implement a concept of a rowing session
      } else if (event?.req?.name === 'stop') {
        log.debug('stop requested')
        peripheralManager.notifyStatus({ name: 'stoppedOrPausedByUser' })
        event.res = true
      } else if (event?.req?.name === 'pause') {
        log.debug('pause requested')
        peripheralManager.notifyStatus({ name: 'stoppedOrPausedByUser' })
        event.res = true
      } else if (event?.req?.name === 'startOrResume') {
        log.debug('startOrResume requested')
        peripheralManager.notifyStatus({ name: 'startedOrResumedByUser' })
        event.res = true
      } else if (event?.req?.name === 'peripheralMode') {
        webServer.notifyClients('config', getConfig())
        event.res = true
      } else {
        log.info('unhandled Command', event.req)
      }
    })
  })
  import('./ant/AntManager.js').then(exports => {
    antManager = exports.createAntManager()
    if (config.heartrateMonitorANT) {
      antManager.on('heartrateMeasurement', (heartrateMeasurement) => {
        rowingStatistics.handleHeartrateMeasurement(heartrateMeasurement)
      })
    }
  })
}

function resetWorkout () {
  workoutRecorder.reset()
  rowingEngine.reset()
  rowingStatistics.reset()
  if (config.bluetoothMode !== 'none') {
    peripheralManager.notifyStatus({ name: 'reset' })
  }
}

const gpioTimerService = child_process.fork('./app/gpio/GpioTimerService.js')
gpioTimerService.on('message', handleRotationImpulse)

function handleRotationImpulse (dataPoint) {
  rowingEngine.handleRotationImpulse(dataPoint)
  if (dataPoint < 0) {
    workoutRecorder.recordRotationImpulse(dataPoint * -1)
  } else {
    workoutRecorder.recordRotationImpulse(dataPoint * -1)
  }
}

const rowingEngine = createRowingEngine(config.rowerSettings)
const rowingStatistics = createRowingStatistics(config)
rowingEngine.notify(rowingStatistics)
const workoutRecorder = createWorkoutRecorder()
const workoutUploader = createWorkoutUploader(workoutRecorder)

rowingStatistics.on('driveFinished', (metrics) => {
  webServer.notifyClients('metrics', metrics)
  if (config.bluetoothMode !== 'none') {
    peripheralManager.notifyMetrics('strokeStateChanged', metrics)
  }
})

rowingStatistics.on('recoveryFinished', (metrics) => {
  log.info(`stroke: ${metrics.strokesTotal}, dur: ${metrics.strokeTime.toFixed(2)}s, power: ${Math.round(metrics.power)}w` +
    `, split: ${metrics.splitFormatted}, ratio: ${metrics.powerRatio.toFixed(2)}, dist: ${metrics.distanceTotal.toFixed(1)}m` +
    `, cal: ${metrics.caloriesTotal.toFixed(1)}kcal, SPM: ${metrics.strokesPerMinute.toFixed(1)}, speed: ${metrics.speed.toFixed(2)}km/h` +
    `, cal/hour: ${metrics.caloriesPerHour.toFixed(1)}kcal, cal/minute: ${metrics.caloriesPerMinute.toFixed(1)}kcal`)
  log.info('Recovery finished: ' + JSON.stringify(metrics))
  webServer.notifyClients('metrics', metrics)
  if (config.bluetoothMode !== 'none') {
    peripheralManager.notifyMetrics('strokeFinished', metrics)
  }
  if (metrics.sessionState === 'rowing') {
    workoutRecorder.recordStroke(metrics)
  }
})

rowingStatistics.on('webMetricsUpdate', (metrics) => {
  webServer.notifyClients('metrics', metrics)
})

rowingStatistics.on('peripheralMetricsUpdate', (metrics) => {
  if (config.bluetoothMode !== 'none') {
    peripheralManager.notifyMetrics('metricsUpdate', metrics)
  }
})

rowingStatistics.on('rowingPaused', () => {
  workoutRecorder.handlePause()
})

if (config.heartrateMonitorBLE) {
  const bleCentralService = child_process.fork('./app/ble/CentralService.js')
  bleCentralService.on('message', (heartrateMeasurement) => {
    rowingStatistics.handleHeartrateMeasurement(heartrateMeasurement)
  })
}

workoutUploader.on('authorizeStrava', (data, client) => {
  webServer.notifyClient(client, 'authorizeStrava', data)
})

workoutUploader.on('resetWorkout', () => {
  resetWorkout()
})

const webServer = createWebServer()
webServer.on('messageReceived', async (message, client) => {
  switch (message.command) {
    case 'switchPeripheralMode': {
      if (config.bluetoothMode !== 'none') {
        peripheralManager.switchPeripheralMode()
      }
      break
    }
    case 'reset': {
      resetWorkout()
      break
    }
    case 'uploadTraining': {
      workoutUploader.upload(client)
      break
    }
    case 'shutdown': {
      if (getConfig().shutdownEnabled) {
        console.info('shutting down device...')
        try {
          const { stdout, stderr } = await exec(config.shutdownCommand)
          if (stderr) {
            log.error('can not shutdown: ', stderr)
          }
          log.info(stdout)
        } catch (error) {
          log.error('can not shutdown: ', error)
        }
      }
      break
    }
    case 'stravaAuthorizationCode': {
      workoutUploader.stravaAuthorizationCode(message.data)
      break
    }
    default: {
      log.warn('invalid command received:', message)
    }
  }
})

webServer.on('clientConnected', (client) => {
  webServer.notifyClient(client, 'config', getConfig())
})

// todo: extract this into some kind of state manager
function getConfig () {
  return {
    peripheralMode: config.bluetoothMode,
    stravaUploadEnabled: !!config.stravaClientId && !!config.stravaClientSecret,
    shutdownEnabled: !!config.shutdownCommand
  }
}

replayRowingSession(handleRotationImpulse, {
  filename: 'recordings/RM50.csv',
  realtime: true,
  loop: true
})
