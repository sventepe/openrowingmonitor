'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  Component that renders a metric of the dashboard
*/

import { AppElement, html, css } from './AppElement.js'
import { customElement, property } from 'lit/decorators.js'

@customElement('gamification-metric')
export class GamificationMetric extends AppElement {
  script() {

  }
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
    let currentValue = (this.rawValue > 0 ? this.rawValue : this.value)
    let largeAchievements = Math.trunc(currentValue / this.largeAchievementGoal)
    currentValue = currentValue - (largeAchievements*this.largeAchievementGoal)
    let smallAchievements = Math.trunc(currentValue / this.achievementGoal)
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
      .d1 {
        color: ${smallAchievements>=1?"crimson;":"#00091c;"}
      }
      .d2 {

        color: ${smallAchievements>=2?"crimson;":"#00091c;"}
      }
      .d3 {
        color: ${smallAchievements>=3?"crimson;":"#00091c;"}
      }
      .d4 {
        color: ${smallAchievements>=4?"crimson;":"#00091c;"}
      }
      .d5 {
        color: ${smallAchievements>=5?"crimson;":"#00091c;"}
      }
      .s1 {
        color: ${largeAchievements>=1?"crimson;":"#00091c;"}
      }
      .s2 {
        color: ${largeAchievements>=2?"crimson;":"#00091c;"}
      }
      .s3 {
        color: ${largeAchievements>=3?"crimson;":"#00091c;"}
      }
      .s4 {
        color: ${largeAchievements>=4?"crimson;":"#00091c;"}
      }
      .s5 {
        color: ${largeAchievements>=5?"crimson;":"#00091c;"}
      }
    </style>
    <div class="progress-bar"></div>
    <div class="achievements">
    <span class="d1">&diams;</span><span class="d2">&diams;</span><span class="d3">&diams;</span><span class="d4">&diams;</span><span class="d5">&diams;</span><BR>
    <span class="s1">&bigstar;</span><span class="s2">&bigstar;</span><span class="s3">&bigstar;</span><span class="s4">&bigstar;</span><span class="s5">&bigstar;</span>
    </div>
    <div class="metric-value">
      ${this.icon} ${this.value !== undefined ? this.value : '--'} ${this.unit}
    </div>
    <slot></slot>
    `
  }
}