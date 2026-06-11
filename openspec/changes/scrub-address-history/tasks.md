# Tasks

## 1. Prevent recurrence (code)

- [x] 1.1 Mapper sanitization: address-bearing or empty device names are replaced by
      the device category (or `device_<id>` fallback) before reaching InfluxDB tags;
      3 tests (1 happy clean-name, 2 unhappy address/empty)
- [x] 1.2 `sam_digital_devices.json` deleted and gitignored. (It turned out to be an
      orphaned API dump — nothing referenced it, so no runtime cache was needed)
- [x] 1.3 Collector verified on the Pi after the pull (the new mapper code is live;
      sanitized `device_name` tag values appear with the next collection runs)

## 2. History rewrite + branch rename (one maintenance window)

- [x] 2.1 Orphanable refs resolved: dependabot pytest PR superseded 2026-06-10;
      stale `upgrade_tibber_0.32.2` deleted (its one commit was already in master);
      a fresh dependabot PR (black) closed pre-rewrite; no forks
- [x] 2.2 `master` → `main` renamed via the GitHub API (redirects active)
- [x] 2.3 Bare clone + `git filter-repo`: `sam_digital_devices.json` dropped from all
      history, plus a replace-text rule redacting the address string anywhere else —
      which also caught two OpenSpec documents that quoted it
- [x] 2.4 Verified: zero matches across all 429 rewritten commits; tip tree identical
      to pre-rewrite except the intended redactions; CI green on the rewritten main
- [x] 2.5 Force-pushed `main` (`2f0e744`); Mac and Pi clones reset to the new main,
      local `master` branches deleted

## 3. Verification & follow-up

- [ ] 3.1 GitHub still serves the file at the old unreachable SHA (cached objects
      survive until GitHub's GC). **User action**: open a GitHub support request
      ("repo BigCrunsh/home-monitoring had a sensitive-data history rewrite; please
      remove cached/unreachable commits", per GitHub's removing-sensitive-data guide)
- [x] 3.2 README notes the 2026-06-11 history rewrite (old clones must re-clone)

## 4. Added during execution

- [x] 4.1 Branch protection on `main`: force-pushes and deletions blocked
      (user request 2026-06-11); normal pushes unaffected
