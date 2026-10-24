# Architecture

The dependency-free Node HTTP server binds only to `127.0.0.1`. It serves a static UI and a small JSON API. The browser stores only the session ID; lesson progress and correct answers live in the server process. This keeps the answer key out of learner-visible option payloads but means a server restart loses progress. Durable, private persistence is a later task.

`frontend/` handles presentation and user-selected local audio through an object URL. `backend/agent/session.js` runs a fixed offline teaching state machine. `backend/agent/model.js` optionally calls a configured, trusted Chat Completions endpoint; output is checked for shape but not semantically verified. `backend/media/lyrics.js` matches LRCLIB metadata and parses synchronized lines. `backend/media/mac-music.js` is a migrated AppleScript adapter loaded only on macOS, with numeric time and fixed operations. `shared/contract.js` validates key cross-boundary objects. `content/fixtures/demo.js` is original, reviewable teaching data.

Data flow: choose fixture song → create session → get lesson node → submit answer → server grades and updates progress → get session after reload. In live experiment: user supplies metadata → server queries LRCLIB → browser receives unverified timed lines → user supplies local audio → browser seeks and pauses. The audio never reaches the server.

Local trust boundary: browser POST requests with an Origin header must come from the exact loopback server origin; the server accepts no arbitrary script. It is not a public deployment target. Configured model endpoint and credentials come from server environment, and the endpoint must be HTTPS with no embedded credentials. The configured endpoint is trusted by the operator. There is no anonymous arbitrary-URL relay.

Known limitations: no durable state, no cross-song index in the new project yet, no AI-driven route selection, no word-level timing, no macOS playback validation after migration, and no rights-cleared commercial media. The original prototype remains available separately for experiments.
