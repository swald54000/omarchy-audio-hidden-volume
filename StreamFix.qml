// Corrige le volume global caché d'un flux : pw-cli set-param <id> Props '{ volume: X }'.
// Identifiant validé, valeur bornée à 0–1.5, une commande à la fois (file d'attente).
import QtQuick
import Quickshell.Io
import "StreamModel.js" as SM

Item {
  id: fix
  visible: false

  signal done(int id, bool ok)

  property var queue: []
  property int currentId: -1

  function setGlobal(id, value) {
    var v = Number(value)
    if (!SM.isValidId(id) || !isFinite(v) || v < 0 || v > 1.5) {
      done(Number(id) || -1, false)
      return
    }
    queue.push({ id: Number(id), value: v })
    next()
  }

  function next() {
    if (fixProc.running || queue.length === 0) return
    var job = queue.shift()
    currentId = job.id
    fixProc.command = ["pw-cli", "set-param", String(job.id), "Props", "{ volume: " + job.value.toFixed(3) + " }"]
    fixProc.running = true
  }

  property string lastOutput: ""

  Process {
    id: fixProc
    stdout: StdioCollector { waitForEnd: true; onStreamFinished: fix.lastOutput += String(text) }
    stderr: StdioCollector { waitForEnd: true; onStreamFinished: fix.lastOutput += String(text) }
    onStarted: fix.lastOutput = ""
    onExited: function(exitCode) {
      // Laisse les collecteurs finir avant de juger la sortie.
      var id = fix.currentId, code = exitCode
      Qt.callLater(function() {
        fix.done(id, SM.fixSucceeded(code, fix.lastOutput))
        fix.next()
      })
    }
  }
}
