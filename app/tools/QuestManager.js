//Aktive Quests und Fortschritt speichern, für Anzeige aufbereitet weitergeben
//Anzeige statt PerformanceDashboard -> Index.js
//ODER als Overlay von PerformanceDashboard? 
//
//Quest Fortschritt soll in kleiner Kachel, aber auch im Vollbild funktionieren
//Overlay!

//Replay über RowingRecorder
//Auswahl des Recordings
//Über Button in Liste das Replay starten

'use strict'
/*
  Open Rowing Monitor, https://github.com/sventepe/openrowingmonitor

  A class to implement Gamification features
*/
import { fork } from 'child_process'
import fs from 'fs'
import log from 'loglevel'