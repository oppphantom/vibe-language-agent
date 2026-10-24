# Codex project instructions

- Run `npm ci`, `npm run check`, and `npm run smoke` from this folder. The app uses Node.js built-ins; do not install unnecessary frameworks.
- `shared/contract.js` is the runtime contract. Update `docs/API_CONTRACT.md` and tests with any public shape change.
- `content/fixtures/demo.js` is original teaching text. Label generated text and external lyrics by source and review state.
- Browser code belongs in `frontend/`; learning state and answers remain in `backend/agent/`; source and playback adapters belong in `backend/media/`.
- Never commit `.env`, keys, personal music/library data, copyrighted recordings, bulk lyric caches, logs, or local study records.
- The Mac bridge is local-only. Bind server to `127.0.0.1`; allow only current loopback origin for browser POST requests. Never accept executable script text from requests.
- Do not claim model reasoning or tool execution that did not occur. Expose only real tool status summaries.
