# VIBE RECORDS · Language Agent starter

This is a local, song-centered language-learning agent foundation. The initial offline lesson teaches Korean `다시` with **original fictional teaching text**, not commercial lyrics or live AI output. It exists separately from the earlier RIIZE prototype.

## Requirements and start

- Node.js 20 or newer (developed and checked with Node.js 24.11.1)
- No package dependencies, API key, Mac Music app, or personal library for the offline flow

```sh
npm ci
npm start
```

Open `http://127.0.0.1:8767/`. If port 8767 is taken, run `PORT=8768 npm start` and open the matching URL.

Run `npm run check` for syntax and risk-focused tests; run `npm run smoke` for the HTTP flow.

## Modes and actual boundaries

**Offline demonstration:** choose an original demo song, inspect material, answer a context question, receive distinct correct/incorrect feedback, see a remedial action, and retry. A session lives in server memory; the browser stores only its opaque session ID. Refreshing the page restores it while the server remains running. Restarting the server expires it. There is no audio asset, so no playback is claimed.

**My Music library:** the first tab now connects to the local Mac Music app, lists tracks for a chosen artist, obtains version-matched synced lyrics, and plays a clicked line in Music with automatic pause. Discover searches matching text across indexed songs from that artist, shows neighboring lines, and plays each hit without leaving the page. In a local check, 18 RIIZE library tracks were listed, 14 had matched lyrics, and `다시` occurred in four songs; one 5–8 second Memories segment played and paused at 8.06 seconds. This is a device-specific observation, not a general latency or accuracy guarantee. A missing lyric source or unmatched version remains unavailable rather than being silently replaced.

**Local audio experiment:** search LRCLIB by title, artist, and track duration; the returned lyrics and line timestamps are marked unverified. Select your own local audio file in the browser and click a timed lyric line to hear it; pause and loop use the browser audio element. Audio is not uploaded. The song version and offset must be checked manually. Last lines without an end time cannot be played as a bounded segment.

Optional model explanation reads `VIBE_MODEL_API_KEY`, `VIBE_MODEL_NAME`, and `VIBE_MODEL_ENDPOINT` from the server environment. It supports a Chat Completions JSON-mode endpoint and returns explicitly unreviewed explanation. It does **not** create a full adaptive lesson, grade live lyrics, or prove the model's interpretation is right. Keep the key on the server. `.env.example` is a template; export environment variables before `npm start` or use a local environment loader of your choice. The original feature-rich prototype is linked from the new Music tab while its remaining learning features are migrated.

## Common failures

- **No synced lyrics:** the source has no matching version or the duration differs by more than 8 seconds. Verify title, artist and duration.
- **Source request fails:** external lyrics access is unavailable. The offline sample still works.
- **No audio:** pick a local file you may use; the app never supplies commercial recordings.
- **Model unavailable:** set all three model environment variables, or continue offline.
- **Session missing:** the server restarted; select a sample song again.
- **Mac Music unavailable:** this optional adapter only runs on macOS; the main web app works elsewhere.

See [architecture](docs/ARCHITECTURE.md), [contract](docs/API_CONTRACT.md), [migration audit](docs/MIGRATION_AUDIT.md), and [roadmap](docs/ROADMAP.md).
