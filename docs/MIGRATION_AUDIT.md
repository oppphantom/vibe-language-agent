# Migration audit · 2026-10-24

Source: `../riize-clip-prototype/` (a directory inside the parent Git workspace, itself untracked there). The running prototype used Node.js on `127.0.0.1:8766`; its entry was `server.js`, which compiled `ocr.swift` at startup. The new project uses Node.js 24.11.1 during migration, built-ins only, and a separate `npm start` server on port 8767. No old `.git` history was copied. The prototype was not modified or stopped.

| Capability | Old location | New location / decision | Evidence and limit |
| --- | --- | --- | --- |
| LRCLIB search, duration match, LRC timestamps | `vibe-data.js` | `backend/media/lyrics.js` · modified | Parser and version mismatch tested offline; live LRCLIB access not verified in CI. Full lyric cache excluded. |
| Library song matching | `vibe-data.js`, `music-bridge.js` | `backend/media/mac-music.js` · isolated | AppleScript adapter copied, not run in CI; UI integration pending. Personal library contents never copied. |
| Local line playback, loop, speed | `vibe.html` | `frontend/app.js` · modified | Browser file selection and line bounds implemented; no bundled audio; manual playback still needs a rights-cleared file. |
| Mac Music line seek and automatic pause | `music-bridge.js` | `backend/media/mac-music.js` · preserved behind macOS route | Static review shows fixed commands and numeric seek; post-migration live Mac verification pending. |
| Model call and output validation | `vibe-study-agent.js`, `vibe-detective-agent.js` | `backend/agent/model.js` · narrowed | Optional server environment configuration and shape checking; no claim of live adaptive teaching. External key/provider not tested. |
| Two-song teaching samples | `vibe-analysis.js`, `vibe-detective-agent.js` | `content/fixtures/demo.js` · replaced with original text | Prior reviewed cases refer to commercial lyrics, so only their teaching pattern was used. New sample is explicitly original and deterministic. |
| Learning state | `vibe-study-ui.js` and in-memory turn maps | `backend/agent/session.js` · modified | Wrong-answer transition and duplicate submission tested; restart persistence pending. |
| OCR and video frame capture | `server.js`, `ocr.swift`, `frames/` | Deferred | Outside song-centered starter; captured frames not copied. |
| Other platforms and old pages | `korean.html`, `synced.html`, etc. | Deferred | Not part of a minimal, auditable base. |

Sensitive/material review: old `data/lyric-cache/` holds bulk external lyrics and was excluded; old `data/` and `frames/` contain learning/video capture outputs and were excluded; old `audio/`, `word-audio/`, and screenshots were excluded because provenance or redistribution rights were not established. The previous UI accepted a user-entered API Key per request; this was not migrated. A filename-only secret-pattern scan of selected source did not identify a literal key, but that is not a complete credential audit of old history. No personal path, account data, or library export was intentionally copied. The new staged tree must be checked again before upload.
