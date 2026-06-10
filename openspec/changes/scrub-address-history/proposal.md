# Scrub home address from repository and history

## Why

The repo is public and `sam_digital_devices.json` contains the home street address in
two device-name strings (`"G Bornitzstr. 90F"`, `"R Bornitzstr. 90F"`, added in commit
`8a74f7a`). Combined with the repo's purpose this links identity, address, and detailed
energy/occupancy data. Decision (2026-06-10): rewrite history and stay public.

## What Changes

- Sanitize SAM Digital device names at collection time (mapper strips/aliases address
  substrings) so the leak cannot reoccur.
- Remove `sam_digital_devices.json` from the repo; treat it as a runtime cache
  (gitignored), fetched from the SAM Digital API.
- **BREAKING**: rewrite git history with `git filter-repo` to purge the address strings
  from all commits; force-push. Existing clones must re-clone.
- **BREAKING**: rename the default branch `master` → `main` in the same maintenance
  window (the rewrite already invalidates all clones, so the rename adds no extra
  disruption). Uses GitHub's branch-rename (web redirects, PR retargeting).
- Resolve the refs the rewrite would orphan first: the open dependabot PR (pytest
  9.0.3) and the stale `upgrade_tibber_0.32.2` branch.
- Verify zero matches for the address across all refs afterwards.

## Capabilities

### New Capabilities
- `data-privacy`: personal data (addresses, names) must not enter the repository or
  collected measurement metadata.

### Modified Capabilities
- (none — no existing specs)

## Impact

- `src/home_monitoring/core/mappers/sam_digital.py`, `services/sam_digital/`
- `.gitignore`, `sam_digital_devices.json` (deleted)
- Git history rewritten; force push; default branch becomes `main`; any open
  clones/forks invalidated (Pi checkout and the local Mac clone must be reset).
- Note: copies fetched before the rewrite (clones, caches) cannot be recalled.
