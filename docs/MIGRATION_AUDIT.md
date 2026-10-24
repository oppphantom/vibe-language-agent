# Migration audit · 2026-10-24

Source: `../riize-clip-prototype/` (a directory inside the parent Git workspace, itself untracked there). The running prototype used Node.js on `127.0.0.1:8766`; its entry was `server.js`, which compiled `ocr.swift` at startup. The new project uses Node.js 24.11.1 during migration, built-ins only, and a separate `npm start` server on port 8767. No old `.git` history was copied. The prototype was not modified or stopped.

| Capability | Old location | New location / decision | Evidence and limit |
| --- | --- | --- | --- |
| LRCLIB search, duration match, LRC timestamps | `vibe-data.js` | `backend/media/lyrics.js` · modified | Parser and version mismatch tested offline; live LRCLIB access not verified in CI. Full lyric cache excluded. |
| Library song matching | `vibe-data.js`, `music-bridge.js` | `backend/media/mac-music.js`, `backend/media/library-index.js`, `frontend/music.js` · modified | Local RIIZE library listing and one short Memories seek/pause checked on 2026-10-24; not run in CI. Personal library contents never copied. |
| Local line playback, loop, speed | `vibe.html` | `frontend/app.js` · modified | Browser file selection and line bounds implemented; no bundled audio; manual playback still needs a rights-cleared file. |
| Mac Music line seek and automatic pause | `music-bridge.js` | `backend/media/mac-music.js` · preserved behind macOS route | Local Memories 5–8 second sample returned a verified seek and was paused at 8.06 seconds; broader song versions and latency remain unverified. |
| Model call and output validation | `vibe-study-agent.js`, `vibe-detective-agent.js` | `backend/agent/model.js` · narrowed | Optional server environment configuration and shape checking; no claim of live adaptive teaching. External key/provider not tested. |
| Two-song teaching samples | `vibe-analysis.js`, `vibe-detective-agent.js` | `content/fixtures/demo.js` · replaced with original text | Prior reviewed cases refer to commercial lyrics, so only their teaching pattern was used. New sample is explicitly original and deterministic. |
| Learning state | `vibe-study-ui.js` and in-memory turn maps | `backend/agent/session.js` · modified | Wrong-answer transition and duplicate submission tested; restart persistence pending. |
| Discover text search | `vibe-data.js`, `vibe.html` | `backend/media/library-index.js`, `frontend/music.js` · modified | Local index matched 14/18 RIIZE tracks; three source requests failed and one version did not match. `다시` produced five hits across four songs. Text hits do not imply distinct meanings. |
| OCR and video frame capture | `server.js`, `ocr.swift`, `frames/` | Deferred | Outside song-centered starter; captured frames not copied. |
| Other platforms and old pages | `korean.html`, `synced.html`, etc. | Deferred | Not part of a minimal, auditable base. |

Sensitive/material review: old `data/lyric-cache/` holds bulk external lyrics and was excluded; old `data/` and `frames/` contain learning/video capture outputs and were excluded; old `audio/`, `word-audio/`, and screenshots were excluded because provenance or redistribution rights were not established. The previous UI accepted a user-entered API Key per request; this was not migrated. A filename-only secret-pattern scan of selected source did not identify a literal key, but that is not a complete credential audit of old history. No personal path, account data, or library export was intentionally copied. The new staged tree must be checked again before upload.
