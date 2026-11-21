## 1. Stage 1: walking skeleton

- [x] 1.1 Tests, then `musik_v2.js`: publish `javascript.0.music_ground_floor` (playing, artist, title, album, cover URL, URI, volume, next track's cover) for Wohnzimmer, Küche, Fernsehzimmer; TV input (`x-sonos-htastream:`), muted rooms and other floors do not count
- [x] 1.2 Tests, then `musik_v2.js`: "Musiklicht" pill in the Musik band header, `light:toggle` flips `javascript.0.music_light_enabled` (persisted, default on)
- [x] 1.3 Tests, then `music_light.js`: snapshot the ambient lamps on music start, set a fixed warm scene on the reachable ones, restore each lamp exactly on stop or toggle off, snapshot persisted across restarts
- [x] 1.4 Render the Musik band locally with the pill on and off; add the pill overlay to `vis/main/vis-views.json`
- [x] 1.5 Deploy (create `music_light.js` on the Pi disabled, then enable), `make deploy-vis`, README inventory entry; owner tries it on the wall

## 1b. Zones and audiobooks (owner, 2026-11-21)

- [x] 1b.1 Tests, then a private zone config on the Pi (`javascript.0.music_light_zones`: label, Sonos rooms, lamps per zone; the repo holds only a neutral ground-floor default) and the artist list for audiobooks (`javascript.0.music_light_audiobook_artists`)
- [x] 1b.2 Tests, then `musik_v2.js` publishes music per zone (`javascript.0.music_zones`) with audiobook detection (episode/chapter/part naming, "Hörspiel"/"Hörbuch", artist list)
- [x] 1b.3 Tests, then `music_light.js` runs every zone independently (own snapshot, own switch)
- [x] 1b.4 Tests, then one pill per zone in the Musik band header (up to four, label from the config) with four overlay slots; render locally
- [x] 1b.5 Deploy, write the private zone config on the Pi, owner tries each zone

## 2. Stage 2: genre

- [ ] 2.1 Tests, then MusicBrainz artist-genre lookup (timeout, cache per artist, fallback)
- [ ] 2.2 Tests, then genre → brightness, character and dining-table white tone; volume scales the intensity (quiet = dim and calm); owner tunes the palette
- [ ] 2.3 Tests, then prefetch genre (and later cover and tempo) of the next track so the scene changes right at the track switch

## 3. Stage 3: cover colours

- [ ] 3.1 Add `jpeg-js` to the javascript adapter's additional modules (one adapter restart)
- [ ] 3.2 Tests, then a cover palette: 4-6 dominant colours with their share of the cover (coarse histogram, skip near-black/white/grey, lift washed-out saturation), cached per cover URL
- [ ] 3.3 Tests, then slow weighted cycling (owner idea, 2026-11-21): each colour lamp drifts through the palette with long transitions, each colour held in proportion to its share; kitchen and the two wall washers run offset, so the room shows several cover colours at once

## 4. Stage 4: tempo

- [ ] 4.1 Tests, then Deezer BPM lookup per track (timeout, cache, calm fallback)
- [ ] 4.2 Tests, then pace: the cycle speed follows the BPM (calm: one pass in 2-4 min, fast: 30-60 s), never more than one command per lamp every 4 s
