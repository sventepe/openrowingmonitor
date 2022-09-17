'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  Component that renders a metric of the dashboard
*/

import { AppElement, html, css } from './AppElement.js'
import { customElement, property } from 'lit/decorators.js'

@customElement('gamification-metric')
export class GamificationMetric extends AppElement {
  static styles = css`
    .icon {
      height: 0.8em;
    }
    
    .metric-value {
      bottom: 0.1em;
      position: absolute;
      right: 0.1em;
    }

    .progress-bar {

    }

    .achievements {

    }
  `

  @property({ type: Object })
    icon

  @property({ type: String })
    unit = ''

  @property({ type: Number })
    value = 0

  @property({ type: Number })
    rawValue = 0

  @property({ type: Number })
    achievementGoal = 0

  @property({ type: Number })
    largeAchievementGoal = 0

  render () {
    let fillPercentage = 100 * (((this.rawValue > 0 ? this.rawValue : this.value) % this.achievementGoal) / this.achievementGoal)
    if ((this.rawValue > 0 ? this.rawValue : this.value) > 0 && fillPercentage === 0) {
      fillPercentage = 100
    }
    return html`
    <style>
      .progress-bar:after{
        content: '\';
        position: absolute;
        background: crimson;
        height: 20%;
        top: 0;
        left: 0; 
        width: ${fillPercentage}%;
        -webkit-transition: all 1s;
        transition: all 1s;
      }
    </style>
    <div class="progress-bar"></div>
    <div class="achievements"></div>
    <div class="metric-value">
      ${this.icon} ${this.value !== undefined ? this.value : '--'} ${this.unit}
    </div>
    <slot></slot>
    `
  }
}
