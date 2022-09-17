'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  Component that renders a metric of the dashboard
*/

import { AppElement, html, css } from './AppElement.js'
import { customElement, property } from 'lit/decorators.js'

@customElement('gamification-metric-gauge')
export class GamificationMetricGauge extends AppElement {
  constructor () {
    super()
    this.dampeningValue = 20
    const maximumMetricValue = 29

    this.maximumDampenedValue = maximumMetricValue - this.dampeningValue// 13
  }

  static styles = css`
  .currentValue {
    position: absolute;
    width: 100%;
    height: 0.4em;
    z-index: 2;
    background-color: crimson;
    -webkit-transition: all 1s;
    transition: all 1s;
  }
  
  .value {
    position: absolute;
    z-index: 3;
    width: 100%;
  }
  
  .optimalZone {
    position: absolute;
    height: 33.3%;
    width: 100%;
    background-color: green;
    -webkit-transition: all 1s;
    transition: all 1s;
  }
  dashboard-actions {
    position: absolute;
    bottom: 0.5em;
    width: 100%;
    left: 0em;
  }  
  `

  @property({ type: Object })
    icon

  @property({ type: String })
    unit = ''

  @property({ type: Number })
    value = 0

  @property({ type: Number })
    maximumDampenedValue = 0

  @property({ type: Number })
    totalMinutes = 0

  @property({ type: Number })
    dampeningValue = 0

  render () {
    const rangeIntervals = ['l', 'm', 'h']
    const remainder = Math.trunc(this.totalMinutes) % rangeIntervals.length
    const optimalZone = rangeIntervals[remainder]
    let optimalZoneMinPercentage
    switch (optimalZone) {
      case 'l':
        optimalZoneMinPercentage = 0
        break
      case 'm':
        optimalZoneMinPercentage = 33.3
        break
      case 'h':
        optimalZoneMinPercentage = 66.6
        break
    }

    return html`
    <div class="currentValue" style="bottom:${Math.min((this.value - this.dampeningValue) > 0 ? 100 / this.maximumDampenedValue * (this.value - this.dampeningValue) : 0, 100)}%;"></div>
    <div class="value">${this.value} ${this.unit}</div>
    <div class="optimalZone" style="bottom: ${optimalZoneMinPercentage}%;"></div>
    <dashboard-actions .appState=${this.appState}></dashboard-actions>
    `
  }
}
