'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  Component that renders quests in the dashboard
*/

import { AppElement, html, css } from '../components/AppElement.js'
import { customElement, property } from 'lit/decorators.js'

@customElement('rpm-interval-quest')
export class RPMIntervalQuest extends AppElement {
  constructor() {
    super()
    this.totalMinutes = 30
    this.dampeningValue = 16
    var maximumMetricValue = 29
    var mediumMetricValue = 25
    var minimumMetricValue = 21

    this.maximumDampenedValue = maximumMetricValue - this.dampeningValue//13
    var mediumDampenedValue = mediumMetricValue - this.dampeningValue//9
    var minimumDampenedValue = minimumMetricValue - this.dampeningValue //5

    var minimumPercentage = 100 / this.maximumDampenedValue * minimumDampenedValue //35?38,46
    var mediumPercentage = 100 / this.maximumDampenedValue * mediumDampenedValue //70?69
    var maximumPercentage = 100 //100

    //input 26
    // var percentToDisplay = 100 / maximumDampenedValue * (26 - dampeningValue)
    //Pattern Ladder Up
    this.interval = [
      mediumPercentage,
      mediumPercentage,
      maximumPercentage,
      minimumPercentage,
      mediumPercentage,
      maximumPercentage,
      minimumPercentage,
      mediumPercentage,
      maximumPercentage,
      mediumPercentage
    ]
    var intervalCount = this.interval.length
    var intervalLength = this.totalMinutes / intervalCount


  }
  @property({ type: String })
  fillPercentage = css`0`

  @property({ type: Number })
  maximumDampenedValue = 0

  @property({ type: Number })
  totalMinutes = 0

  @property({ type: Number })
  dampeningValue = 0

  @property({ type: Array })
  interval = []

  @property({ type: Number })
  totalTime = 0

  @property({ type: Number })
  distanceTotal = 0

  @property({ type: Number })
  strokesTotal = 0

  @property({ type: Number })
  rpm = 0
  //padding an graph table entfernen, dann passt position der hr
  //      bottom: 35%;
  static styles = css`


    body, table, input, select, textarea {

    }
    .progressFill {
      background-color: seagreen;
      height: 100%;
      position: absolute;
      margin-top: -20%;
    }
    .hrContainer {
      position: relative;
    }
    .content {
      width: 100%;
      height: 100%;
      position: sticky;
    }
    .currentValue {
      position: relative;
      border-bottom-width: thick;
      width: 100%;
      z-index: 1;
      margin: 0px;
      transition: transform 1s;
    }
    
    .graph {
      margin-bottom:1em;
      font:normal 100%/150% arial,helvetica,sans-serif;
      box-sizing: border-box;
      position: fixed;
      z-index: 2;
    }
    
    .graph caption {
      font:bold 150%/120% arial,helvetica,sans-serif;
      padding-bottom:0.33em;
    }
    .graph tbody th {
      text-align:right;
    }
    @supports (display:grid) {
    
    
    
    
    .graph tbody th {
      text-align:right;
    }
    
    @supports (display:grid) {
    
      @media (min-width:32em) {
        .graph {
          display:contents;
          width:100%;
          height:100%;
        }
    
        .graph caption {
          display:block;
        }
    
        .graph thead {
          display:none;
        }
    
        .graph tbody {
          position:relative;
          display:flex;
          grid-template-columns:repeat(auto-fit, minmax(2em, 1fr));
          align-items:end;
          height:100%;
          column-gap:-1em;
        }
    
        .graph tbody:before,
        .graph tbody:after {
          position:absolute;
          left:-3.2em;
          width:2.8em;
          text-align:right;
          font:bold 80%/120% arial,helvetica,sans-serif;
        }
    
    
        .graph tr {
          position:relative;
          display:block;
          width: 10%;
          border-color: rgb(255, 102, 51);
          border-style: solid solid none solid;
          background-color: rgb(255, 102, 51);
        }

    
        .graph tr:hover {
          z-index:999;
        }
    
        .graph th,
        .graph td {
          display:block;
          text-align:center;
          margin: -2px;
          background: unset;
        }
    
        .graph tbody th {
          position:absolute;
          left:0;
          width:100%;
          font-weight:normal;
          text-align:center;
          white-space:nowrap;
          text-indent:0;
          transform:rotate(-45deg);
        }
    

        .graph td {
          height:100%;
          transition:background 0.5s;
        }
    
        .graph tr:hover td {
          opacity:0.7;
        }
    
        .graph td span {
          overflow:hidden;
          position:absolute;
          left:50%;
          top:50%;
          width:0;
          padding:0.5em 0;
          margin:-1em 0 0;
          font:normal 85%/120% arial,helvetica,sans-serif;
    /* 			background:white; */
    /* 			box-shadow:0 0 0.25em rgba(0,0,0,0.6); */
          font-weight:bold;
          opacity:0;
          transition:opacity 0.5s;
          color:white;
        }
    
        .toggleGraph:checked + table td span,
        .graph tr:hover td span {
          width:4em;
          margin-left:-2em; /* 1/2 the declared width */
          opacity:1;
        }
    
    
    
        
    
    
      } /* min-width:32em */
    
    } /* grid only */

  `


  //   .graph tr:after {
  //     content:'';
  //     position:absolute;
  //     background:rgb(255, 102, 51);
  //     top:0; bottom:0;
  //     left:0; 
  //     width:${this.fillPercentage}%;
  // }

  //von oben nach unten die Balken anzeigen und den Rest füllen??
  render() {
    // console.log('maximumDampenedValue is: ' + this.maximumDampenedValue)
    // console.log('rpm is: ' + this.rpm)
    // console.log('dampenedValue is: ' + this.dampeningValue)
    // console.log('totalTime is: ' + this.totalTime)
    console.log('Strokes: ' + this.strokesTotal + ' distanceTotal: ' + this.distanceTotal)
    this.fillPercentage = css`90`
    return html`
    <div class="content">
    <div class="progressFill" style="width:${(100/this.totalMinutes) * (this.totalTime / 60)}%"></div>
    <table class="graph">
    <tbody>
    <tr style="height:${this.interval[0]}%">
    <td></td>
    </tr>
    <tr style="height:${this.interval[1]}%">
    <td></td>
    </tr>
    <tr style="height:${this.interval[2]}%">
    <td></td>
    </tr>
      <tr style="height:${this.interval[3]}%">
      <td></td>
      </tr>
      <tr style="height:${this.interval[4]}%">
        <td></td>
        </tr>
      <tr style="height:${this.interval[5]}%">
        <td></td>
      </tr>
      <tr style="height:${this.interval[6]}%">
        <td></td>
        </tr>
        <tr style="height:${this.interval[7]}%">
        <td></td>
        </tr>
        <tr style="height:${this.interval[8]}%">
        <td></td>
        </tr>
        <tr style="height:${this.interval[9]}%">
        <td></td>
        </tr>
        </tbody>
        </table>
        <hr class="currentValue" style="bottom:${(this.rpm - this.dampeningValue) > 0 ? 100 / this.maximumDampenedValue * (this.rpm - this.dampeningValue) : 0}%;">
        </div>
    
  

    `
  }
  //   <div class="label">${this.icon}</div>
  //   <div class="content">
  //     <span class="metric-value">${this.value !== undefined ? this.value : '--'}</span>
  //     <span class="metric-unit">${this.unit}</span>
  //   </div>
  //   <slot></slot>

}
