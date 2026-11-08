# Audio (hidden volumes) — Omarchy bar widget

A fork of Omarchy's built-in `omarchy.audio` widget that shows and fixes the
hidden per-stream volume in PipeWire.

## The problem

Each PipeWire output stream has two volume controls:

- `channelVolumes`, the value shown by the Omarchy audio widget, pavucontrol
  and `wpctl`;
- a separate global `volume` Prop, which none of these tools display.

The level you hear is the product of the two. If the global `volume` drops
below 1.0, the mixer still shows the stream at 100 % while it is quiet.
WirePlumber saves this value per application name
(`~/.local/state/wireplumber/stream-properties`), so it comes back every time
the app restarts.

## What this widget adds

- Each stream slider shows the real volume (global × channels).
- A warning appears when the global volume is below 98 %, when left/right
  balance is strongly off, or when a stream is muted.
- A "Corriger" (fix) link resets the global volume to 100 % with
  `pw-cli set-param`, and reports failure (`pw-cli` exits 0 even on error, so
  its output is checked).

It does not address what lowers the global volume in the first place; that
cause is still unknown.

## Install

```sh
omarchy plugin add https://github.com/swald54000/omarchy-audio-hidden-volume.git --enable
```

Requires PipeWire with `pw-dump` and `pw-cli`. Tested with PipeWire 1.6.10 and
WirePlumber 0.5.18.

## Tests

The stream logic (`StreamModel.js`) has no Qt dependency and is tested with
Node:

```sh
node --test tests/
```

## Language

The interface text is in French.

## License

MIT. Based on Omarchy's `omarchy.audio` widget, © David Heinemeier Hansson.
See `LICENSE`.
