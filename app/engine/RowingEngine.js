'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  The Rowing Engine models the physics of a real rowing boat.
  It takes impulses from the flywheel of a rowing machine and estimates
  parameters such as energy, stroke rates and movement.

  This implementation uses concepts that are described here:
  Physics of Rowing by Anu Dudhia: http://eodg.atm.ox.ac.uk/user/dudhia/rowing/physics
  Also Dave Vernooy has some good explanations here: https://dvernooy.github.io/projects/ergware
*/
import loglevel from 'loglevel'
import { createMovingAverager } from './averager/MovingAverager.js'
import { createMovingFlankDetector } from './MovingFlankDetector.js'
import config from '../tools/ConfigManager.js'

const log = loglevel.getLogger('RowingEngine')

function createRowingEngine (rowerSettings) {
  let workoutHandler
  const flankDetector = createMovingFlankDetector(rowerSettings)
  const angularDisplacementPerImpulse = (2.0 * Math.PI) / rowerSettings.numOfImpulsesPerRevolution
  const movingDragAverage = createMovingAverager(rowerSettings.dampingConstantSmoothing, rowerSettings.dragFactor / 1000000)
  const dragFactorMaxUpwardChange = 1 + rowerSettings.dampingConstantMaxChange
  const dragFactorMaxDownwardChange = 1 - rowerSettings.dampingConstantMaxChange
  const minimumCycleLength = rowerSettings.minimumDriveTime + rowerSettings.minimumRecoveryTime
  let cyclePhase
  let totalTime
  let totalNumberOfImpulses
  let strokeNumber
  let drivePhaseStartTime
  let drivePhaseStartAngularDisplacement
  let drivePhaseLength
  let drivePhaseAngularDisplacement
  let driveLinearDistance
  let recoveryPhaseStartTime
  let recoveryPhaseAngularDisplacement
  let recoveryPhaseStartAngularDisplacement
  let recoveryPhaseLength
  let recoveryStartAngularVelocity
  let recoveryEndAngularVelocity
  let recoveryLinearDistance
  let currentDragFactor
  let dragFactor
  let cycleLength
  let linearCycleVelocity
  let totalLinearDistance
  let averagedCyclePower
  let currentTorque
  let previousAngularVelocity
  let currentAngularVelocity
  // we use the reset function to initialize the variables above
  reset()

  // called if the sensor detected an impulse, currentDt is an interval in seconds
  function handleRotationImpulse (currentDt) {
    const initialDt = currentDt
    const positiveDt = currentDt < 0 ? currentDt * -1 : currentDt

    totalTime += positiveDt
    totalNumberOfImpulses++
    // detect where we are in the rowing phase (drive or recovery)
    flankDetector.pushValue(positiveDt)

    if (config.gpioPin2) {
      log.info('currentDt: ' + currentDt)
      if (initialDt > 0 && cyclePhase === 'Drive') {
        log.info('Continue Drive')
        updateDrivePhase(positiveDt)
      } else if (initialDt < 0 && cyclePhase === 'Recovery') {
        log.info('Continue Recovery')
        updateRecoveryPhase(positiveDt)
      } else if (initialDt > 0 && cyclePhase === 'Recovery') {
        log.info('Starting Drive')
        recoveryPhaseLength = (totalTime - flankDetector.timeToBeginOfFlank()) - recoveryPhaseStartTime
        startDrivePhase(positiveDt)
        cyclePhase = 'Drive'
      }
      if (initialDt < 0 && cyclePhase === 'Drive') {
        log.info('Starting Recovery')
        drivePhaseLength = (totalTime - flankDetector.timeToBeginOfFlank()) - drivePhaseStartTime
        startRecoveryPhase(positiveDt)
        cyclePhase = 'Recovery'
      }
      // impulses that take longer than maximumImpulseTimeBeforePause seconds are considered a pause
      if (currentDt > rowerSettings.maximumImpulseTimeBeforePause) {
        workoutHandler.handlePause(positiveDt)
      }
    } else {
      // we implement a finite state machine that goes between "Drive" and "Recovery" phases,
      // which allows a phase-change if sufficient time has passed and there is a plausible flank
      if (cyclePhase === 'Drive') {
        // We currently are in the "Drive" phase, lets determine what the next phase is
        if (flankDetector.isFlywheelUnpowered()) {
          // The flank detector detects that the flywheel has no power exerted on it
          drivePhaseLength = (totalTime - flankDetector.timeToBeginOfFlank()) - drivePhaseStartTime
          if (drivePhaseLength >= rowerSettings.minimumDriveTime) {
            // We change into the "Recovery" phase since we have been long enough in the Drive phase, and we see a clear lack of power
            // exerted on the flywheel
            startRecoveryPhase(currentDt)
            cyclePhase = 'Recovery'
          } else {
            // We seem to have lost power to the flywheel, but it is too early according to the settings. We stay in the Drive Phase
            log.debug(`Time: ${totalTime.toFixed(4)} sec, impulse ${totalNumberOfImpulses}: flank suggests no power (${flankDetector.accelerationAtBeginOfFlank().toFixed(1)} rad/s2), but waiting for for recoveryPhaseLength (${recoveryPhaseLength.toFixed(4)} sec) to exceed minimumRecoveryTime (${rowerSettings.minimumRecoveryTime} sec)`)
            updateDrivePhase(currentDt)
          }
        } else {
          // We stay in the "Drive" phase as the acceleration is lacking
          updateDrivePhase(currentDt)
        }
      } else {
        // We currently are in the "Recovery" phase, lets determine what the next phase is
        if (flankDetector.isFlywheelPowered()) {
          // The flank detector consistently detects some force on the flywheel
          recoveryPhaseLength = (totalTime - flankDetector.timeToBeginOfFlank()) - recoveryPhaseStartTime
          if (recoveryPhaseLength >= rowerSettings.minimumRecoveryTime) {
            // We change into the "Drive" phase if we have been long enough in the "Recovery" phase, and we see a consistent force being
            // exerted on the flywheel
            startDrivePhase(currentDt)
            cyclePhase = 'Drive'
          } else {
            // We see a force, but the "Recovery" phase has been too short, we stay in the "Recovery" phase
            log.debug(`Time: ${totalTime.toFixed(4)} sec, impulse ${totalNumberOfImpulses}: flank suggests power (${flankDetector.accelerationAtBeginOfFlank().toFixed(1)} rad/s2), but waiting for recoveryPhaseLength (${recoveryPhaseLength.toFixed(4)} sec) to exceed minimumRecoveryTime (${rowerSettings.minimumRecoveryTime} sec)`)
            updateRecoveryPhase(currentDt)
          }
        } else {
          // No force on the flywheel, let's continue the "Drive" phase
          updateRecoveryPhase(currentDt)
        }
      }
    }
  }

  function startDrivePhase (currentDt) {
    // First, we conclude the "Recovery" phase
    log.debug('*** recovery phase completed')
    if (rowerSettings.minimumRecoveryTime <= recoveryPhaseLength && rowerSettings.minimumDriveTime <= drivePhaseLength) {
      // We have a plausible cycle time
      cycleLength = recoveryPhaseLength + drivePhaseLength
    } else {
      log.debug(`CycleLength isn't plausible: recoveryPhaseLength ${recoveryPhaseLength.toFixed(4)} sec, drivePhaseLength = ${drivePhaseLength.toFixed(4)} s, maximumImpulseTimeBeforePause ${rowerSettings.maximumImpulseTimeBeforePause} s`)
    }
    recoveryPhaseAngularDisplacement = ((totalNumberOfImpulses - flankDetector.noImpulsesToBeginFlank()) - recoveryPhaseStartAngularDisplacement) * angularDisplacementPerImpulse

    // Calculation of the drag-factor
    if (flankDetector.impulseLengthAtBeginFlank() > 0) {
      recoveryEndAngularVelocity = angularDisplacementPerImpulse / flankDetector.impulseLengthAtBeginFlank()
      if (recoveryPhaseLength >= rowerSettings.minimumRecoveryTime && recoveryStartAngularVelocity > 0 && recoveryEndAngularVelocity > 0) {
        // Prevent division by zero and keep useless data out of our calculations
        currentDragFactor = -1 * rowerSettings.flywheelInertia * ((1 / recoveryStartAngularVelocity) - (1 / recoveryEndAngularVelocity)) / recoveryPhaseLength
        if (rowerSettings.autoAdjustDragFactor) {
          if (currentDragFactor > (movingDragAverage.getAverage() * dragFactorMaxDownwardChange) && currentDragFactor < (movingDragAverage.getAverage() * dragFactorMaxUpwardChange)) {
            // If the calculated drag factor is close to what we expect
            movingDragAverage.pushValue(currentDragFactor)
            dragFactor = movingDragAverage.getAverage()
            log.info(`*** Calculated drag factor: ${(currentDragFactor * 1000000).toFixed(2)}`)
          } else {
            // The calculated drag factor is outside the plausible range
            log.info(`Calculated drag factor: ${(currentDragFactor * 1000000).toFixed(2)}, which is too far off the currently used dragfactor of ${movingDragAverage.getAverage() * 1000000}`)
            log.debug(`Time: ${totalTime.toFixed(4)} sec, impulse ${totalNumberOfImpulses}: recoveryStartAngularVelocity = ${recoveryStartAngularVelocity.toFixed(2)} rad/sec, recoveryEndAngularVelocity = ${recoveryEndAngularVelocity.toFixed(2)} rad/sec, recoveryPhaseLength = ${recoveryPhaseLength.toFixed(4)} sec`)
            if (currentDragFactor < (movingDragAverage.getAverage() * dragFactorMaxDownwardChange)) {
              // The current calculated dragfactor makes an abrupt downward change, let's follow the direction, but limit it to the maximum allowed change
              movingDragAverage.pushValue(movingDragAverage.getAverage() * dragFactorMaxDownwardChange)
            } else {
              // The current calculated dragfactor makes an abrupt upward change, let's follow the direction, but limit it to the maximum allowed change
              movingDragAverage.pushValue(movingDragAverage.getAverage() * dragFactorMaxUpwardChange)
            }
            dragFactor = movingDragAverage.getAverage()
            log.debug(`*** Applied drag factor: ${dragFactor * 1000000}`)
          }
        } else {
          log.info(`*** Calculated drag factor: ${(currentDragFactor * 1000000).toFixed(2)}`)
        }
      } else {
        log.error(`Time: ${totalTime.toFixed(4)} sec, impulse ${totalNumberOfImpulses}: division by 0 prevented, recoveryPhaseLength = ${recoveryPhaseLength} sec, recoveryStartAngularVelocity = ${recoveryStartAngularVelocity} rad/sec, recoveryEndAngularVelocity = ${recoveryEndAngularVelocity} rad/sec`)
      }
    } else {
      log.error(`Time: ${totalTime.toFixed(4)} sec, impulse ${totalNumberOfImpulses}: division by 0 prevented, impulseLengthAtBeginFlank = ${flankDetector.impulseLengthAtBeginFlank()} sec`)
    }

    // Calculate the key metrics
    recoveryLinearDistance = Math.pow((dragFactor / rowerSettings.magicConstant), 1.0 / 3.0) * recoveryPhaseAngularDisplacement
    totalLinearDistance += recoveryLinearDistance
    currentTorque = calculateTorque(currentDt)
    linearCycleVelocity = calculateLinearVelocity()
    averagedCyclePower = calculateCyclePower()

    // Next, we start the "Drive" Phase
    log.debug(`*** DRIVE phase started at time: ${totalTime.toFixed(4)} sec, impulse number ${totalNumberOfImpulses}`)
    strokeNumber++
    drivePhaseStartTime = totalTime - flankDetector.timeToBeginOfFlank()
    drivePhaseStartAngularDisplacement = totalNumberOfImpulses - flankDetector.noImpulsesToBeginFlank()

    // Update the metrics
    if (workoutHandler) {
      log.debug('startDrivePhase totalLinearDistance: ' + totalLinearDistance)
      workoutHandler.handleRecoveryEnd({
        timeSinceStart: totalTime,
        power: averagedCyclePower,
        duration: cycleLength,
        strokeDistance: driveLinearDistance + recoveryLinearDistance,
        durationDrivePhase: drivePhaseLength,
        speed: linearCycleVelocity,
        distance: totalLinearDistance,
        numberOfStrokes: strokeNumber,
        instantaneousTorque: currentTorque,
        strokeState: 'DRIVING'
      })
    }
  }

  function updateDrivePhase (currentDt) {
    // Update the key metrics on each impulse
    drivePhaseAngularDisplacement = ((totalNumberOfImpulses - flankDetector.noImpulsesToBeginFlank()) - drivePhaseStartAngularDisplacement) * angularDisplacementPerImpulse
    driveLinearDistance = Math.pow((dragFactor / rowerSettings.magicConstant), 1.0 / 3.0) * drivePhaseAngularDisplacement
    currentTorque = calculateTorque(currentDt)
    if (workoutHandler) {
      log.debug('updateDrivePhase distance: ' + (totalLinearDistance + driveLinearDistance) + 'totalLinearDistance: ' + totalLinearDistance + ' driveLinearDistance: ' + driveLinearDistance)
      workoutHandler.updateKeyMetrics({
        timeSinceStart: totalTime,
        distance: totalLinearDistance + driveLinearDistance,
        instantaneousTorque: currentTorque
      })
    }
  }

  function startRecoveryPhase (currentDt) {
    // First, we conclude the "Drive" Phase
    log.debug('*** drive phase completed')
    if (rowerSettings.minimumRecoveryTime <= recoveryPhaseLength && rowerSettings.minimumDriveTime <= drivePhaseLength) {
      // We have a plausible cycle time
      cycleLength = recoveryPhaseLength + drivePhaseLength
    } else {
      log.debug(`CycleLength wasn't plausible: recoveryPhaseLength ${recoveryPhaseLength.toFixed(4)} sec, drivePhaseLength = ${drivePhaseLength.toFixed(4)} s`)
    }
    drivePhaseAngularDisplacement = ((totalNumberOfImpulses - flankDetector.noImpulsesToBeginFlank()) - drivePhaseStartAngularDisplacement) * angularDisplacementPerImpulse
    // driveEndAngularVelocity = angularDisplacementPerImpulse / flankDetector.impulseLengthAtBeginFlank()
    driveLinearDistance = Math.pow((dragFactor / rowerSettings.magicConstant), 1.0 / 3.0) * drivePhaseAngularDisplacement
    totalLinearDistance += driveLinearDistance
    currentTorque = calculateTorque(currentDt)
    // We display the AVERAGE speed in the display, NOT the top speed of the stroke
    linearCycleVelocity = calculateLinearVelocity()
    averagedCyclePower = calculateCyclePower()

    // Next, we start the "Recovery" Phase
    log.debug(`*** RECOVERY phase started at time: ${totalTime.toFixed(4)} sec, impuls number ${totalNumberOfImpulses}`)
    recoveryPhaseStartTime = totalTime - flankDetector.timeToBeginOfFlank()
    recoveryPhaseStartAngularDisplacement = totalNumberOfImpulses - flankDetector.noImpulsesToBeginFlank()
    if (flankDetector.impulseLengthAtBeginFlank() > 0) {
      recoveryStartAngularVelocity = angularDisplacementPerImpulse / flankDetector.impulseLengthAtBeginFlank()
    } else {
      log.error(`Time: ${totalTime.toFixed(4)} sec, impuls ${totalNumberOfImpulses}: division by 0 prevented, flankDetector.impulseLengthAtBeginFlank() is ${flankDetector.impulseLengthAtBeginFlank()} sec`)
    }

    // Update the metrics
    if (workoutHandler) {
      log.debug('startRecoveryPhase totalLinearDistance: ' + totalLinearDistance)
      workoutHandler.handleDriveEnd({
        timeSinceStart: totalTime,
        power: averagedCyclePower,
        duration: cycleLength,
        strokeDistance: driveLinearDistance + recoveryLinearDistance,
        durationDrivePhase: drivePhaseLength,
        speed: linearCycleVelocity,
        distance: totalLinearDistance,
        instantaneousTorque: currentTorque,
        strokeState: 'RECOVERY'
      })
    }
  }

  function updateRecoveryPhase (currentDt) {
    // Update the key metrics on each impulse
    recoveryPhaseAngularDisplacement = ((totalNumberOfImpulses - flankDetector.noImpulsesToBeginFlank()) - recoveryPhaseStartAngularDisplacement) * angularDisplacementPerImpulse
    recoveryLinearDistance = Math.pow((dragFactor / rowerSettings.magicConstant), 1.0 / 3.0) * recoveryPhaseAngularDisplacement
    currentTorque = calculateTorque(currentDt)
    if (workoutHandler) {
      log.debug('updateRecoveryPhase distance: ' + (totalLinearDistance + recoveryLinearDistance) + 'totalLinearDistance: ' + totalLinearDistance + ' recoveryLinearDistance: ' + recoveryLinearDistance)
      workoutHandler.updateKeyMetrics({
        timeSinceStart: totalTime,
        distance: totalLinearDistance + recoveryLinearDistance,
        instantaneousTorque: currentTorque
      })
    }
  }

  function calculateLinearVelocity () {
    // Here we calculate the AVERAGE speed for the displays, NOT the topspeed of the stroke
    let tempLinearVelocity = linearCycleVelocity
    if (drivePhaseLength > rowerSettings.minimumDriveTime && cycleLength > minimumCycleLength) {
      // There is no division by zero and the data data is plausible
      tempLinearVelocity = Math.pow((dragFactor / rowerSettings.magicConstant), 1.0 / 3.0) * ((recoveryPhaseAngularDisplacement + drivePhaseAngularDisplacement) / cycleLength)
    } else {
      log.error(`Time: ${totalTime.toFixed(4)} sec, impuls ${totalNumberOfImpulses}: cycle length was not plausible, CycleLength = ${cycleLength} sec`)
    }
    return tempLinearVelocity
  }

  function calculateCyclePower () {
    // Here we calculate the AVERAGE power for the displays, NOT the top power of the stroke
    let cyclePower = averagedCyclePower
    if (drivePhaseLength > rowerSettings.minimumDriveTime && cycleLength > minimumCycleLength) {
      // There is no division by zero and the data data is plausible
      cyclePower = dragFactor * Math.pow((recoveryPhaseAngularDisplacement + drivePhaseAngularDisplacement) / cycleLength, 3.0)
    } else {
      log.error(`Time: ${totalTime.toFixed(4)} sec, impulse ${totalNumberOfImpulses}: cycle length was not plausible, CycleLength = ${cycleLength} sec`)
    }
    return cyclePower
  }

  function calculateTorque (currentDt) {
    let torque = currentTorque
    if (currentDt > 0) {
      previousAngularVelocity = currentAngularVelocity
      currentAngularVelocity = angularDisplacementPerImpulse / currentDt
      torque = rowerSettings.flywheelInertia * ((currentAngularVelocity - previousAngularVelocity) / currentDt) + dragFactor * Math.pow(currentAngularVelocity, 2)
    }
    return torque
  }

  function reset () {
    // to init displacements with plausible defaults we assume, that one rowing cycle transforms to nine meters of distance...
    const defaultDisplacementForRowingCycle = 8.0 / Math.pow(((rowerSettings.dragFactor / 1000000) / rowerSettings.magicConstant), 1.0 / 3.0)

    movingDragAverage.reset()
    cyclePhase = 'Recovery'
    totalTime = 0.0
    totalNumberOfImpulses = 0.0
    strokeNumber = 0.0
    drivePhaseStartTime = 0.0
    drivePhaseStartAngularDisplacement = 0.0
    drivePhaseLength = 2.0 * rowerSettings.minimumDriveTime
    // split defaultDisplacementForRowingCycle to aprox 1/3 for the drive phase
    drivePhaseAngularDisplacement = (1.0 / 3.0) * defaultDisplacementForRowingCycle
    driveLinearDistance = 0.0
    // Make sure that the first CurrentDt will trigger a detected stroke by faking a recovery phase that is long enough
    recoveryPhaseStartTime = -2 * rowerSettings.minimumRecoveryTime
    // and split defaultDisplacementForRowingCycle to aprox 2/3 for the recovery phase
    recoveryPhaseAngularDisplacement = (2.0 / 3.0) * defaultDisplacementForRowingCycle
    // set this to the number of impulses required to generate the angular displacement as assumed above
    recoveryPhaseStartAngularDisplacement = Math.round(-1.0 * (2.0 / 3.0) * defaultDisplacementForRowingCycle / angularDisplacementPerImpulse)
    recoveryPhaseLength = 2.0 * rowerSettings.minimumRecoveryTime
    recoveryStartAngularVelocity = angularDisplacementPerImpulse / rowerSettings.minimumTimeBetweenImpulses
    recoveryEndAngularVelocity = angularDisplacementPerImpulse / rowerSettings.maximumTimeBetweenImpulses
    recoveryLinearDistance = 0.0
    currentDragFactor = rowerSettings.dragFactor / 1000000
    dragFactor = movingDragAverage.getAverage()
    cycleLength = minimumCycleLength
    linearCycleVelocity = 0.0
    totalLinearDistance = 0.0
    averagedCyclePower = 0.0
    currentTorque = 0.0
    previousAngularVelocity = 0.0
    currentAngularVelocity = 0.0
  }

  function notify (receiver) {
    workoutHandler = receiver
  }

  return {
    handleRotationImpulse,
    reset,
    notify
  }
}

export { createRowingEngine }
