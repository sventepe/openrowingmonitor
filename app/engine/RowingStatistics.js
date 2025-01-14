'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  This Module calculates the training specific metrics.
*/
import { EventEmitter } from 'events'
import { createMovingIntervalAverager } from './averager/MovingIntervalAverager.js'
import { createWeightedAverager } from './averager/WeightedAverager.js'

import loglevel from 'loglevel'
const log = loglevel.getLogger('RowingEngine')

function createRowingStatistics (config) {
  const numOfDataPointsForAveraging = config.numOfPhasesForAveragingScreenData
  const webUpdateInterval = config.webUpdateInterval
  const minimumStrokeTime = config.rowerSettings.minimumRecoveryTime + config.rowerSettings.minimumDriveTime
  const maximumStrokeTime = config.maximumStrokeTime
  const timeBetweenStrokesBeforePause = maximumStrokeTime * 1000
  const emitter = new EventEmitter()
  const strokeAverager = createWeightedAverager(numOfDataPointsForAveraging)
  const powerAverager = createWeightedAverager(numOfDataPointsForAveraging)
  const speedAverager = createWeightedAverager(numOfDataPointsForAveraging)
  const powerRatioAverager = createWeightedAverager(numOfDataPointsForAveraging)
  const caloriesAveragerMinute = createMovingIntervalAverager(60)
  const caloriesAveragerHour = createMovingIntervalAverager(60 * 60)
  let sessionState = 'waitingForStart'
  let rowingPausedTimer
  let heartrateResetTimer
  let distanceTotal = 0.0
  let durationTotal = 0
  let strokesTotal = 0
  let caloriesTotal = 0.0
  let heartrate = 0
  let heartrateBatteryLevel = 0
  let lastStrokeDuration = 0.0
  let instantaneousTorque = 0.0
  let lastStrokeDistance = 0.0
  let lastStrokeSpeed = 0.0
  let lastStrokeState = 'RECOVERY'
  let lastWebMetrics = {}

  // send metrics to the web clients periodically (but only if the data has changed)
  setInterval(emitWebMetrics, webUpdateInterval)
  function emitWebMetrics () {
    const currentWebMetrics = getMetrics()
    if (Object.entries(currentWebMetrics).toString() !== Object.entries(lastWebMetrics).toString()) {
      emitter.emit('webMetricsUpdate', currentWebMetrics)
      lastWebMetrics = currentWebMetrics
    }
  }

  // notify bluetooth peripherall each second (even if data did not change)
  // todo: the FTMS protocol also supports that peripherals deliver a preferred update interval
  // we could respect this and set the update rate accordingly
  setInterval(emitPeripheralMetrics, 1000)
  function emitPeripheralMetrics () {
    emitter.emit('peripheralMetricsUpdate ', getMetrics())
  }

  function handleDriveEnd (stroke) {
    // if we do not get a drive for timeBetweenStrokesBeforePause milliseconds we treat this as a rowing pause
    if (rowingPausedTimer)clearInterval(rowingPausedTimer)
    rowingPausedTimer = setTimeout(() => pauseRowing(), timeBetweenStrokesBeforePause)

    // based on: http://eodg.atm.ox.ac.uk/user/dudhia/rowing/physics/ergometer.html#section11
    const calories = (4 * powerAverager.getAverage() + 350) * (stroke.duration) / 4200
    durationTotal = stroke.timeSinceStart
    powerAverager.pushValue(stroke.power)
    speedAverager.pushValue(stroke.speed)
    if (stroke.duration < timeBetweenStrokesBeforePause && stroke.duration > minimumStrokeTime) {
      // stroke duration has to be plausible to be accepted
      powerRatioAverager.pushValue(stroke.durationDrivePhase / stroke.duration)
      strokeAverager.pushValue(stroke.duration)
      caloriesAveragerMinute.pushValue(calories, stroke.duration)
      caloriesAveragerHour.pushValue(calories, stroke.duration)
    } else {
      log.debug(`*** Stroke duration of ${stroke.duration} sec is considered unreliable, skipped update stroke statistics`)
    }

    caloriesTotal += calories
    lastStrokeDuration = stroke.duration
    distanceTotal = stroke.distance
    log.debug('Stroke.distance: ' + stroke.distance)
    lastStrokeDistance = stroke.strokeDistance
    lastStrokeState = stroke.strokeState
    lastStrokeSpeed = stroke.speed
    instantaneousTorque = stroke.instantaneousTorque
    emitter.emit('driveFinished', getMetrics())
  }

  // initiated by the rowing engine in case an impulse was not considered
  // because it was too large
  function handlePause (duration) {
    sessionState = 'paused'
    caloriesAveragerMinute.pushValue(0, duration)
    caloriesAveragerHour.pushValue(0, duration)
    emitter.emit('rowingPaused')
  }

  // initiated when the stroke state changes
  function handleRecoveryEnd (stroke) {
    // todo: we need a better mechanism to communicate strokeState updates
    // this is an initial hacky attempt to see if we can use it for the C2-pm5 protocol
    if (sessionState !== 'rowing') startTraining()
    durationTotal = stroke.timeSinceStart
    powerAverager.pushValue(stroke.power)
    speedAverager.pushValue(stroke.speed)
    if (stroke.duration < timeBetweenStrokesBeforePause && stroke.duration > minimumStrokeTime) {
      // stroke duration has to be plausible to be accepted
      powerRatioAverager.pushValue(stroke.durationDrivePhase / stroke.duration)
      // strokeAverager.pushValue(stroke.duration)
    } else {
      log.debug(`*** Stroke duration of ${stroke.duration} sec is considered unreliable, skipped update stroke statistics`)
    }
    distanceTotal = stroke.distance
    strokesTotal = stroke.numberOfStrokes
    lastStrokeDistance = stroke.strokeDistance
    lastStrokeState = stroke.strokeState
    lastStrokeSpeed = stroke.speed
    instantaneousTorque = stroke.instantaneousTorque
    emitter.emit('recoveryFinished', getMetrics())
  }

  // initiated when updating key statistics
  function updateKeyMetrics (stroke) {
    durationTotal = stroke.timeSinceStart
    distanceTotal = stroke.distance
    instantaneousTorque = stroke.instantaneousTorque
  }

  // initiated when a new heart rate value is received from heart rate sensor
  function handleHeartrateMeasurement (value) {
    // set the heart rate to zero if we did not receive a value for some time
    if (heartrateResetTimer)clearInterval(heartrateResetTimer)
    heartrateResetTimer = setTimeout(() => {
      heartrate = 0
      heartrateBatteryLevel = 0
    }, 6000)
    heartrate = value.heartrate
    heartrateBatteryLevel = value.batteryLevel
  }

  function getMetrics () {
    const splitTime = speedAverager.getAverage() !== 0 && lastStrokeSpeed > 0 ? (500.0 / speedAverager.getAverage()) : Infinity
    // todo: due to sanitization we currently do not use a consistent time throughout the engine
    // We will rework this section to use both absolute and sanitized time in the appropriate places.
    // We will also polish up the events for the recovery and drive phase, so we get clean complete strokes from the first stroke onwards.
    const averagedStrokeTime = strokeAverager.getAverage() > minimumStrokeTime && strokeAverager.getAverage() < maximumStrokeTime && lastStrokeSpeed > 0 && sessionState === 'rowing' ? strokeAverager.getAverage() : 0 // seconds
    return {
      sessionState,
      durationTotal,
      durationTotalFormatted: secondsToTimeString(durationTotal),
      strokesTotal,
      distanceTotal: distanceTotal > 0 ? distanceTotal : 0, // meters
      caloriesTotal, // kcal
      caloriesPerMinute: caloriesAveragerMinute.getAverage() > 0 ? caloriesAveragerMinute.getAverage() : 0,
      caloriesPerHour: caloriesAveragerHour.getAverage() > 0 ? caloriesAveragerHour.getAverage() : 0,
      strokeTime: lastStrokeDuration, // seconds
      distance: lastStrokeDistance > 0 && lastStrokeSpeed > 0 && sessionState === 'rowing' ? lastStrokeDistance : 0, // meters
      power: powerAverager.getAverage() > 0 && lastStrokeSpeed > 0 && sessionState === 'rowing' ? powerAverager.getAverage() : 0, // watts
      split: splitTime, // seconds/500m
      splitFormatted: secondsToTimeString(splitTime),
      powerRatio: powerRatioAverager.getAverage() > 0 && lastStrokeSpeed > 0 && sessionState === 'rowing' ? powerRatioAverager.getAverage() : 0,
      instantaneousTorque,
      strokesPerMinute: averagedStrokeTime !== 0 && sessionState === 'rowing' ? (60.0 / averagedStrokeTime) : 0,
      speed: speedAverager.getAverage() > 0 && lastStrokeSpeed > 0 && sessionState === 'rowing' ? (speedAverager.getAverage() * 3.6) : 0, // km/h
      strokeState: lastStrokeState,
      heartrate,
      heartrateBatteryLevel
    }
  }

  function startTraining () {
    sessionState = 'rowing'
  }

  function stopTraining () {
    sessionState = 'stopped'
    if (rowingPausedTimer)clearInterval(rowingPausedTimer)
  }

  function resetTraining () {
    stopTraining()
    distanceTotal = 0.0
    strokesTotal = 0
    caloriesTotal = 0.0
    durationTotal = 0
    caloriesAveragerMinute.reset()
    caloriesAveragerHour.reset()
    strokeAverager.reset()
    powerAverager.reset()
    speedAverager.reset()
    powerRatioAverager.reset()
    sessionState = 'waitingForStart'
    lastStrokeState = 'LET\'S GO'
  }

  // clear the metrics in case the user pauses rowing
  function pauseRowing () {
    strokeAverager.reset()
    powerAverager.reset()
    speedAverager.reset()
    powerRatioAverager.reset()
    lastStrokeState = 'RECOVERY'
    sessionState = 'paused'
    emitter.emit('rowingPaused')
  }

  // converts a timestamp in seconds to a human readable hh:mm:ss format
  function secondsToTimeString (secondsTimeStamp) {
    if (secondsTimeStamp === Infinity) return '∞'
    const hours = Math.floor(secondsTimeStamp / 60 / 60)
    const minutes = Math.floor(secondsTimeStamp / 60) - (hours * 60)
    const seconds = Math.floor(secondsTimeStamp % 60)
    let timeString = hours > 0 ? ` ${hours.toString().padStart(2, '0')}:` : ''
    timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    return timeString
  }

  return Object.assign(emitter, {
    handleDriveEnd,
    handlePause,
    handleHeartrateMeasurement,
    handleRecoveryEnd,
    updateKeyMetrics,
    reset: resetTraining
  })
}

export { createRowingStatistics }
