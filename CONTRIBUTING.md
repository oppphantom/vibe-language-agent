# Contributing

The team works in short branches and pull requests: `feat/...`, `fix/...`, and `content/...`. Run `npm ci`, `npm run check`, and `npm run smoke` before requesting review. Include the material provenance and actual validation in each PR. No long-lived personal branches are required.

Initial responsibilities:

- **A · Frontend:** page interaction, later map and card presentation. First task: make the offline lesson's context comparison easier to read on mobile; acceptance: answer and retry still work after refresh.
- **B · Agent/API:** session state, grading, model adapter. First task: persist non-sensitive learning sessions across server restarts; acceptance: idempotent submissions and schema migration tests pass.
- **C · Media:** lyric matching, local audio, Mac Music adapter. First task: test the migrated Mac Music bridge on a permitted local track and document measured seek/pause behavior; acceptance: no false playback success, platform absence graceful.
- **D · Learning content:** objectives, source review, grading criteria, learner testing. First task: create one original Korean context pair with a documented answer rationale; acceptance: another learner can explain the target expression after incorrect-answer remediation.

The schema in `shared/contract.js` and API examples in `docs/API_CONTRACT.md` are shared. Coordinate changes to either before merging; file ownership does not block needed collaboration. Do not add personal library exports, full commercial lyrics, recordings, secrets, or unlicensed third-party code. Do not treat a model explanation as a verified source. Unknown GitHub usernames are intentionally absent from CODEOWNERS.
