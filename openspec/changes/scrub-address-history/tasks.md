# Tasks

## 1. Prevent recurrence (code)

- [ ] 1.1 Add name sanitization to the SAM Digital mapper (strip/alias address-like
      device names); unit tests: 1 happy (clean name passes), 2 unhappy (address name
      sanitized, empty name fallback)
- [ ] 1.2 Make `sam_digital_devices.json` a runtime cache: fetch from API, write to a
      gitignored cache path; delete the tracked file; update `.gitignore`
- [ ] 1.3 Verify the collector runs end-to-end on the Pi with the cache file removed

## 2. History rewrite + branch rename (one maintenance window)

- [ ] 2.1 Resolve orphan-able refs: merge or close the open dependabot PR (pytest
      9.0.3); delete or rebase the stale `upgrade_tibber_0.32.2` branch; confirm no
      forks
- [ ] 2.2 Rename default branch `master` → `main` via GitHub (Settings → Branches);
      confirm dependabot config (if any) follows
- [ ] 2.3 Mirror-clone, run `git filter-repo` with a replacement rule for the address
      strings (and dropping `sam_digital_devices.json` from history)
- [ ] 2.4 Verify: scan all refs for the address string — zero matches; tests still pass
- [ ] 2.5 Force-push `main`; update the Pi checkout and the local Mac clone (re-clone
      or `fetch` + `reset --hard origin/main` + `branch -m`)

## 3. Verification & follow-up

- [ ] 3.1 Confirm GitHub UI/raw URLs of old commits no longer serve the file
- [ ] 3.2 Note in README/CONTRIBUTING that history was rewritten on this date
