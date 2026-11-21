## Why

When music plays in the living area downstairs, the lights stay whatever they were, often bright
work light. The owner wants the ambient lights there to follow the music while it plays and to go
back exactly as they were when it stops, with a switch on the wall dashboard to turn the behaviour
off when it gets annoying. The pieces exist already: the Musik band knows what each Sonos room
plays, and ioBroker switches the Hue lamps over HTTPS.

## What Changes

- New ioBroker script `music_light.js`: while the toggle is on and music (not TV sound) plays in a
  ground-floor Sonos room (Wohnzimmer, Küche, Fernsehzimmer), it sets the ambient lamps (kitchen
  colour lamp, the two colour wall washers behind the TV, the dining-table white lamps when they have
  power) and restores each lamp's exact previous state the moment the music stops or the toggle goes
  off. Always active, no daylight limit.
- `musik_v2.js` publishes the ground floor's music state (playing, artist, title, cover URL, track
  URI) and excludes TV audio, which the TV soundbar also reports as playing.
- A "Musiklicht" toggle pill in the Musik band of the Steuerung tab, with its native tap overlay.
- The light matches the music in stages, each live and judged before the next:
  1. walking skeleton: toggle, detection, a fixed warm scene, immediate restore;
  2. genre (artist genres from the MusicBrainz database, no key, cached per artist) sets brightness
     and character;
  3. album cover colours (dominant colours, decoded with the new `jpeg-js` library in the javascript
     adapter, owner approved 2026-11-21) set the colours;
  4. tempo (track BPM from the Deezer public API, no key; calm fallback) sets the pace of colour
     changes.
- No beat sync: Sonos reports no beat phase and the Hue bridge accepts only a few commands per second.

## Capabilities

### New Capabilities
- `music-ambient-light`: ambient lights downstairs follow the music while it plays (toggle, music
  detection without TV sound, scene from the music, exact restore on stop).

### Modified Capabilities
<!-- none: the Musik band gains a pill, but no existing spec covers the dashboard's Musik band -->

## Impact

- New: `integrations/iobroker/music_light.js` and its tests in `tests/iobroker/`.
- Changed: `integrations/iobroker/musik_v2.js` (ground-floor state, toggle pill),
  `integrations/iobroker/vis/main/vis-views.json` (one tap overlay), `integrations/iobroker/README.md`.
- New states: `javascript.0.music_light_enabled`, `javascript.0.music_ground_floor`,
  `javascript.0.music_light_snapshot`.
- Dependency (stage 3): `jpeg-js` as an additional module of the ioBroker javascript adapter; adding
  it restarts the adapter once (all scripts pause for about 30 s).
- External lookups (stages 2 and 4): MusicBrainz and Deezer over HTTPS, at most one per new artist or
  track, cached.
- Interplay: the Hue Sync Box drives the wall washers while the TV runs; excluding TV audio keeps the
  two from competing.
