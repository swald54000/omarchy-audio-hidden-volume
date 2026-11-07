// Lit le graphe PipeWire avec pw-dump et expose les volumes cachés de chaque flux de lecture.
// Cadence : 1 s quand `fast` (panneau ouvert), 10 s sinon. Un seul pw-dump à la fois.
import QtQuick
import Quickshell.Io
import "StreamModel.js" as SM

Item {
  id: details
  visible: false

  property bool fast: false
  property bool available: false
  property var byId: ({})
  property bool anyWarning: false

  function refresh() {
    if (dumpProc.running) return
    dumpProc.running = true
  }

  onFastChanged: if (fast) refresh()
  Component.onCompleted: refresh()

  Timer {
    interval: details.fast ? 1000 : 10000
    running: true
    repeat: true
    onTriggered: details.refresh()
  }

  Process {
    id: dumpProc
    command: ["pw-dump"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var r = SM.parseDump(String(text))
        if (r.ok) {
          details.byId = r.streams
          details.available = true
          details.anyWarning = SM.anyBarWarning(r.streams)
        } else {
          details.byId = ({})
          details.available = false
          details.anyWarning = false
        }
      }
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) {
        details.byId = ({})
        details.available = false
        details.anyWarning = false
      }
    }
  }
}
