## 1. Stage 1: walking skeleton

- [ ] 1.1 Tests, then `musik_v2.js`: publish `javascript.0.music_ground_floor` (playing, artist, title, album, cover URL, URI, volume, next track's cover) for Wohnzimmer, Küche, Fernsehzimmer; TV input (`x-sonos-htastream:`), muted rooms and other floors do not count
- [ ] 1.2 Tests, then `musik_v2.js`: "Musiklicht" pill in the Musik band header, `light:toggle` flips `javascript.0.music_light_enabled` (persisted, default on)
- [ ] 1.3 Tests, then `music_light.js`: snapshot the ambient lamps on music start, set a fixed warm scene on the reachable ones, restore each lamp exactly on stop or toggle off, snapshot persisted across restarts
- [ ] 1.4 Render the Musik band locally with the pill on and off; add the pill overlay to `vis/main/vis-views.json`
- [ ] 1.5 Deploy (create `music_light.js` on the Pi disabled, then enable), `make deploy-vis`, README inventory entry; owner tries it on the wall

## 2. Stage 2: genre

- [ ] 2.1 Tests, then MusicBrainz artist-genre lookup (timeout, cache per artist, fallback)
- [ ] 2.2 Tests, then genre → brightness, character and dining-table white tone; volume scales the intensity (quiet = dim and calm); owner tunes the palette
- [ ] 2.3 Tests, then prefetch genre (and later cover and tempo) of the next track so the scene changes right at the track switch

## 3. Stage 3: cover colours

- [ ] 3.1 Add `jpeg-js` to the javascript adapter's additional modules (one adapter restart)
- [ ] 3.2 Tests, then dominant colours from the cover (coarse histogram, skip near-black/white), cached per cover URL, applied to kitchen and wall washers

## 4. Stage 4: tempo

- [ ] 4.1 Tests, then Deezer BPM lookup per track (timeout, cache, calm fallback)
- [ ] 4.2 Tests, then pace: rotate the cover colours across the colour lamps, interval from BPM, never faster than every 4 s
