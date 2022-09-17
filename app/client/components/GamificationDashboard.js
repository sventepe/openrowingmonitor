'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  Component that renders the dashboard
*/

import { AppElement, html, css } from './AppElement.js'
import { APP_STATE } from '../store/appState.js'
import { customElement, property } from 'lit/decorators.js'
import './GamificationMetric.js'
import './GamificationMetricGauge.js'
import './DashboardActions.js'
import './BatteryIcon.js'
import { icon_route, icon_paddle, icon_clock } from '../lib/icons.js'
import './QuestMetric.js'

@customElement('gamification-dashboard')
export class GamificationDashboard extends AppElement {
  static styles = css`
    :host {
      display: grid;
      height: calc(100vh - 2vw);
      padding: 1vw;
      grid-gap: 1vw;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: repeat(3, minmax(0, 1fr));
    }

    @media (orientation: portrait) {
      :host {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: repeat(4, minmax(0, 1fr));
      }
    }

    gamification-metric, gamification-metric-gauge, quest-metric, dashboard-actions {
      background: var(--theme-widget-color);
      text-align: center;
      position: relative;
      padding: 1.5em 0 0 0;
      box-sizing: border-box;
    }

    dashboard-actions {
      padding: 0.5em 0 0 0;
    }
  `
  // padding: 0.5em 0.2em 0 0.2em;
  @property({ type: Object })
    metrics

  @property({ type: Object })
    appState = APP_STATE

  render () {
    const metrics = this.calculateFormattedMetrics(this.appState.metrics)
    return html`
      <gamification-metric style="grid-column:1 / span 3; grid-row:1" .achievementGoal=${1000} .largeAchievementGoal=${1000} .icon=${icon_route} .unit=${metrics?.distanceTotal?.unit || 'm'} .value=${metrics?.distanceTotal?.value}></gamification-metric>
      <gamification-metric style="grid-column:1 / span 3; grid-row:2" .achievementGoal=${50} .largeAchievementGoal=${100} .icon=${icon_paddle} unit="total" .value=${metrics?.strokesTotal?.value}></gamification-metric>
      <gamification-metric style="grid-column:1 / span 3; grid-row:3" .achievementGoal=${5} .largeAchievementGoal=${30} .icon=${icon_clock} .rawValue=${metrics?.durationTotal?.value / 60} .value=${metrics?.durationTotalFormatted?.value}></gamification-metric>
      <gamification-metric-gauge style="grid-column:4; grid-row:1 / span 3"  .value=${metrics?.strokesPerMinute?.value} unit="rpm" .totalMinutes=${metrics?.durationTotal?.value / 60}></gamification-metric-gauge>
      `
  }

  // todo: so far this is just a port of the formatter from the initial proof of concept client
  // we could split this up to make it more readable and testable
  calculateFormattedMetrics (metrics) {
    const fieldFormatter = {
      distanceTotal: (value) => value >= 10000
        ? { value: (value / 1000).toFixed(1), unit: 'km' }
        : { value: Math.round(value), unit: 'm' },
      caloriesTotal: (value) => Math.round(value),
      power: (value) => Math.round(value),
      strokesPerMinute: (value) => Math.round(value)
    }

    const formattedMetrics = {}
    for (const [key, value] of Object.entries(metrics)) {
      const valueFormatted = fieldFormatter[key] ? fieldFormatter[key](value) : value
      if (valueFormatted.value !== undefined && valueFormatted.unit !== undefined) {
        formattedMetrics[key] = {
          value: valueFormatted.value,
          unit: valueFormatted.unit
        }
      } else {
        formattedMetrics[key] = {
          value: valueFormatted
        }
      }
    }
    return formattedMetrics
  }
}
