// Logique pure de swald.audio (pas de Qt) : lecture de la sortie de pw-dump, volume réel
// (global × canaux), alertes et libellés. Testé sous node par tests/StreamModel.test.mjs.

var MAX_DUMP = 8000000
var MAX_TEXT = 120

function pct(x) { return Math.round(Number(x) * 100) }

function clip(s) {
  s = String(s === undefined || s === null ? "" : s)
  return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s
}

function num(v, fallback) {
  var n = Number(v)
  return isFinite(n) ? n : fallback
}

function parseDump(text) {
  var bad = { ok: false, streams: {} }
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_DUMP) return bad
  var data
  try { data = JSON.parse(text) } catch (e) { return bad }
  if (!Array.isArray(data)) return bad

  var streams = {}
  for (var i = 0; i < data.length; i++) {
    var o = data[i]
    var info = o && o.info
    var props = info && info.props
    if (!props || props["media.class"] !== "Stream/Output/Audio") continue
    if (typeof o.id !== "number") continue
    var p = info.params && Array.isArray(info.params.Props) && info.params.Props[0] ? info.params.Props[0] : {}
    var channels = Array.isArray(p.channelVolumes) ? p.channelVolumes.map(function(c) { return num(c, 0) }) : []
    streams[String(o.id)] = {
      id: o.id,
      nodeName: String(props["node.name"] || ""),
      binary: String(props["application.process.binary"] || ""),
      appName: String(props["application.name"] || props["node.name"] || ""),
      global: num(p.volume, 1),
      channels: channels,
      muted: p.mute === true
    }
  }
  return { ok: true, streams: streams }
}

function mean(list) {
  if (!list || list.length === 0) return 0
  var t = 0
  for (var i = 0; i < list.length; i++) t += list[i]
  return t / list.length
}

function realVolume(s) {
  return s.channels && s.channels.length ? s.global * mean(s.channels) : s.global
}

// Volume affiché par le curseur : canaux en direct (shell) × global relevé par pw-dump.
// globalFixed : une correction du global vient d'être demandée, on le suppose à 1.
function liveVolume(s, liveChannels, globalFixed) {
  if (!s || globalFixed) return liveChannels
  return s.global * liveChannels
}

function balance(s) {
  if (!s.channels || s.channels.length !== 2) return 0
  var l = s.channels[0], r = s.channels[1], m = Math.max(l, r)
  return m > 0 ? (r - l) / m : 0
}

function warnings(s) {
  var w = []
  if (s.global < 0.98) w.push("hiddenGlobal")
  if (Math.abs(balance(s)) > 0.2) w.push("imbalance")
  if (s.muted) w.push("muted")
  return w
}

function anyBarWarning(streams) {
  for (var k in streams) {
    var w = warnings(streams[k])
    if (w.indexOf("hiddenGlobal") !== -1 || w.indexOf("imbalance") !== -1) return true
  }
  return false
}

function label(s) {
  var app = String(s.appName || ""), bin = String(s.binary || "")
  if (bin === "" || bin.toLowerCase() === app.toLowerCase()) return clip(app)
  return clip(bin + " (" + app + ")")
}

function detail(s) {
  var t = "global " + pct(s.global) + " % × canaux " + pct(mean(s.channels)) + " %"
  if (s.channels && s.channels.length === 2) t += " · G " + pct(s.channels[0]) + " / D " + pct(s.channels[1])
  return t
}

function explain(code, s) {
  if (code === "hiddenGlobal")
    return "Volume global caché à " + pct(s.global) + " % : les autres mixeurs ne l'affichent pas. "
      + "Le réglage est mémorisé pour toutes les applications nommées « " + clip(s.appName) + " »."
  if (code === "imbalance")
    return "Gauche " + pct(s.channels[0]) + " % / Droite " + pct(s.channels[1]) + " %"
  if (code === "muted") return "Ce flux est muet"
  return ""
}

function isValidId(id) { return /^[0-9]{1,10}$/.test(String(id)) }

// pw-cli renvoie 0 même en cas d'échec ; il signale l'erreur par une ligne « Error: … ».
function fixSucceeded(exitCode, output) {
  return exitCode === 0 && !/(^|\n)\s*Error:/.test(String(output || ""))
}

function matches(s, nodeName) { return !!s && s.nodeName === nodeName }

if (typeof module !== "undefined") {
  module.exports = {
    parseDump: parseDump, realVolume: realVolume, balance: balance, warnings: warnings,
    anyBarWarning: anyBarWarning, label: label, detail: detail, explain: explain,
    isValidId: isValidId, matches: matches, pct: pct, fixSucceeded: fixSucceeded, liveVolume: liveVolume
  }
}
