## Context

- `musik_v2.js` polls the Sonos HTTP API (jishi, `localhost:5005/zones`) every 4 s, keeps a per-room
  cache (`ZONES`) and renders the Musik band. It already knows playing state, title and artist per
  room; the track URI and cover URL are in the same answer but not kept yet.
- The ground floor is the preset group "Wohnen": Wohnzimmer (coordinator), Küche, Fernsehzimmer. The
  Fernsehzimmer soundbar reports `PLAYING` while it plays TV sound; its track URI then starts with
  `x-sonos-htastream:`.
- Lamps: kitchen (Hue extended colour), two Hue Play wall washers (colour, also driven by the Hue Sync
  Box during TV), three dining-table lamps (Hue white, behind a wall switch, often unreachable).
- The hue adapter takes atomic commands with a transition on `hue.0.<lamp>.command`
  (`{"on":true,"bri":…,"xy":[…],"transitiontime":…}`) and reports state in `.on`, `.bri`/`.level`,
  `.xy`, `.ct`, `.colormode`, `.reachable` (polled every 10 s).
- Dashboard taps are native vis-2 overlays placed from the layout each script logs
  (`MUSIK_LAYOUT`); a new pill needs one overlay in `vis/main/vis-views.json`.

## Goals / Non-Goals

**Goals:**
- A working end-to-end path first (stage 1), then richer scenes without touching that path.
- Never leave the lamps in the music scene after the music ends; restore exactly.
- One switch on the wall to turn it all off.

**Non-Goals:**
- Beat-synchronous light (needs Hue Entertainment streaming plus audio analysis).
- Rooms other than the ground floor, and a daylight limit (owner: always).
- Fighting the Hue Sync Box: TV sound never triggers the scene.

## Decisions

- **Split detection from light control.** `musik_v2.js` already owns the Sonos poll, so it publishes
  `javascript.0.music_ground_floor` (JSON: playing, artist, title, cover URL, URI); the new
  `music_light.js` only reacts to that state and the toggle. Alternative: a second Sonos poll in the
  light script; rejected as duplicate polling and duplicated room knowledge.
- **TV detection by URI**, not by room: the soundbar can also play real music, so only the
  `x-sonos-htastream:` URI marks TV sound.
- **Snapshot before the first command, restore with one command per lamp.** The snapshot holds
  on/bri/colour mode and xy or ct per lamp and is persisted in `javascript.0.music_light_snapshot`, so
  a restart mid-song still restores. A lamp that was off is restored with `{"on":false}`. The snapshot
  is taken only on the transition from "not active" to "active", never overwritten mid-song.
- **Restore immediately** on stop (owner choice); a pause counts as stop.
- **Toggle pill in the Musik band header**, left of the group presets; it writes `musik_cmd`
  `light:toggle` like the other pills (one overlay type, the existing alternating-value trick), and
  `musik_v2.js` flips `javascript.0.music_light_enabled`.
- **Stages 2-4 compute a scene object** `{bri, colours[], whiteCt, pace}` from cached lookups
  (MusicBrainz artist genres, cover via `jpeg-js` with a coarse colour histogram, Deezer track BPM);
  the light script applies it with transitions and, for pace, re-applies rotated colours on a timer
  no faster than every 4 s (bridge rate limit: 3 colour lamps per step).

## Risks / Trade-offs

- [The owner changes a lamp by hand during the song] → it is overwritten at the next scene change and
  restored to the pre-music state at the end. Accepted for stage 1; revisit if annoying.
- [Hue Sync Box starts while music plays] → TV sound does not count, so the music scene ends with the
  music; the Sync Box then owns the wall washers.
- [External lookups slow or down] → each has a timeout and the calm fallback; the scene never waits on
  the network.
- [Dining-table lamps unreachable at snapshot time] → not recorded, not commanded.
- [`jpeg-js` adds a dependency to the javascript adapter] → small pure-JS library, approved; adding it
  restarts all scripts once.

## Migration Plan

Deploy `musik_v2.js` (new state + pill) and `music_light.js` (created disabled on the Pi, then
enabled), add the overlay to `vis-views.json` via `make deploy-vis`. Rollback: disable
`music_light.js`; the snapshot restore runs on the toggle-off path, so turning the pill off first
leaves the lamps as they were.

## Open Questions

- Stage 2 palette per genre: start with a small table and tune on the wall with the owner.
