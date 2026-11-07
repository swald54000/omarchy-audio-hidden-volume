import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const SM = createRequire(import.meta.url)("../StreamModel.js");

function obj(id, props, propsParam) {
  const info = { props };
  if (propsParam) info.params = { Props: [propsParam] };
  return { id, type: "PipeWire:Interface:Node", info };
}
const dumpOf = (...objs) => JSON.stringify(objs);

function stream(id, nodeName, binary, appName, volume, channelVolumes, mute = false) {
  return obj(id,
    { "media.class": "Stream/Output/Audio", "node.name": nodeName,
      "application.process.binary": binary, "application.name": appName },
    { volume, channelVolumes, mute });
}
const chromium = () => stream(145, "Chromium", "chatgpt", "Chromium", 0.25, [0.736267, 0.736267]);
const parsedOne = (o) => SM.parseDump(dumpOf(o)).streams[String(o.id)];

test("parseDump › reads a stream", () => {
  const r = SM.parseDump(dumpOf(chromium()));
  assert.equal(r.ok, true);
  const s = r.streams["145"];
  assert.equal(s.id, 145);
  assert.equal(s.global, 0.25);
  assert.equal(s.binary, "chatgpt");
  assert.equal(s.appName, "Chromium");
  assert.equal(s.nodeName, "Chromium");
  assert.deepEqual(s.channels, [0.736267, 0.736267]);
  assert.equal(s.muted, false);
});

test("parseDump › ignores non-streams", () => {
  const sink = obj(44, { "media.class": "Audio/Sink", "node.name": "spk" }, { volume: 1, channelVolumes: [1, 1] });
  const r = SM.parseDump(dumpOf(sink, chromium()));
  assert.deepEqual(Object.keys(r.streams), ["145"]);
});

test("parseDump › empty graph", () => {
  const r = SM.parseDump("[]");
  assert.deepEqual(r, { ok: true, streams: {} });
  assert.equal(SM.anyBarWarning(r.streams), false);
});

test("parseDump › invalid", () => {
  for (const t of ["", "{", "{}", "x".repeat(8000001)]) assert.equal(SM.parseDump(t).ok, false, JSON.stringify(t.slice(0, 5)));
});

test("parseDump › missing Props", () => {
  const o = obj(7, { "media.class": "Stream/Output/Audio", "node.name": "x", "application.name": "X" });
  const s = parsedOne(o);
  assert.equal(s.global, 1);
  assert.deepEqual(s.channels, []);
  assert.equal(s.muted, false);
});

test("realVolume", () => {
  assert.ok(Math.abs(SM.realVolume(parsedOne(chromium())) - 0.184) < 0.001);
  assert.equal(SM.realVolume({ global: 0.5, channels: [] }), 0.5);
});

test("warnings › hiddenGlobal threshold", () => {
  assert.deepEqual(SM.warnings(parsedOne(stream(1, "a", "a", "A", 0.97, [1, 1]))), ["hiddenGlobal"]);
  assert.deepEqual(SM.warnings(parsedOne(stream(1, "a", "a", "A", 0.98, [1, 1]))), []);
});

test("warnings › imbalance", () => {
  assert.ok(SM.warnings(parsedOne(stream(1, "a", "a", "A", 1, [1.0, 0.7]))).includes("imbalance"));
  assert.ok(!SM.warnings(parsedOne(stream(1, "a", "a", "A", 1, [1.0, 0.85]))).includes("imbalance"));
  assert.ok(!SM.warnings(parsedOne(stream(1, "a", "a", "A", 1, [0.5]))).includes("imbalance"));
  assert.equal(SM.balance({ channels: [0, 0] }), 0);
});

test("warnings › muted, and anyBarWarning ignores muted-only", () => {
  const s = parsedOne(stream(3, "m", "m", "M", 1, [1, 1], true));
  assert.deepEqual(SM.warnings(s), ["muted"]);
  assert.equal(SM.anyBarWarning({ "3": s }), false);
  assert.equal(SM.anyBarWarning({ "145": parsedOne(chromium()) }), true);
});

test("label", () => {
  assert.equal(SM.label({ binary: "chatgpt", appName: "Chromium" }), "chatgpt (Chromium)");
  assert.equal(SM.label({ binary: "firefox", appName: "Firefox" }), "Firefox");
  assert.equal(SM.label({ binary: "", appName: "Zen" }), "Zen");
  assert.equal(SM.label({ binary: "", appName: "n".repeat(300) }).length, 120);
});

test("label › keeps markup literal", () => {
  assert.ok(SM.label({ binary: "x", appName: "<img src=x>" }).includes("<img src=x>"));
});

test("detail", () => {
  assert.equal(SM.detail(parsedOne(chromium())), "global 25 % × canaux 74 % · G 74 / D 74");
});

test("explain hiddenGlobal", () => {
  const t = SM.explain("hiddenGlobal", parsedOne(chromium()));
  assert.ok(t.includes("25 %"));
  assert.ok(t.includes("« Chromium »"));
});

test("isValidId", () => {
  for (const ok of [145, "145"]) assert.equal(SM.isValidId(ok), true);
  for (const bad of ["145; rm", -1, "", "12345678901"]) assert.equal(SM.isValidId(bad), false);
});

test("matches only same node name", () => {
  const s = parsedOne(chromium());
  assert.equal(SM.matches(s, "Chromium"), true);
  assert.equal(SM.matches(s, "Firefox"), false);
  assert.equal(SM.matches(undefined, "x"), false);
});

test("fixSucceeded › pw-cli reports errors with exit code 0", () => {
  assert.equal(SM.fixSucceeded(0, "Object: size 32, type Spa:Pod:Object:Param:Props\n  Float 1,000000\n"), true);
  assert.equal(SM.fixSucceeded(0, "Error: \"set-param: unknown global '999999'\"\n"), false);
  assert.equal(SM.fixSucceeded(1, ""), false);
});
