# API contract · schema version 1

`shared/contract.js` is the runtime validator for lyric lines and answer submissions. This document describes the broader v1 shapes. Times are integer **milliseconds**. Unknown start and end are `null`; a known start may have an unknown end. An unknown end disables bounded playback.

| Object | Required fields and meaning |
| --- | --- |
| Song | Stable `id`, `title`, `artist`, `language`, `version`, `durationMs`, `source`; `audio.available` and reason in offline fixture |
| LyricLine | `id`, `songId`, `text`, `startMs`, `endMs`, `source`, `reviewStatus` (`original`, `verified`, `unverified`) |
| PlaybackCapabilities | `seek`, `lineLoop`, `speed`, `wordSeek` booleans and `reason` for unsupported actions |
| LearningTarget | `expression`, `skill`, `evidenceLineIds`, `prerequisites` |
| LessonNode | `id`, `type`, `target`, `prompt`, `material`, `options`, `status`, `provenance` |
| AnswerSubmission | `sessionId`, `nodeId`, `submissionId` idempotency key, `choice`, `attempt`, `hintUsed` |
| Feedback | `verdict`, `explanation`, `errorType`, `evidenceLineIds`, `nextAction`, actual `toolLog` |
| LearningSession | `id`, `schemaVersion`, `mode`, `currentNodeId`, `route`, `history`, `progress`, `songId` |

Correct option index and answer rationale remain server-side. The model endpoint is a server configuration, not an anonymous proxy target.

```http
POST /api/sessions
Content-Type: application/json

{"songId":"demo-morning"}
```

Then `GET /api/sessions/{id}/node`, `POST /api/answers` with `{"sessionId":"...","nodeId":"demo-dasi","submissionId":"attempt-1","choice":1,"attempt":1,"hintUsed":false}`, and `GET /api/sessions/{id}`. Repeating the same `submissionId` returns the same result without adding history. A wrong answer returns `feedback.nextAction.type="remediate"` and keeps the node active.

`POST /api/lyrics/search` accepts `{"title":"...","artist":"...","durationMs":180000}`. Results are `unverified` or `no_matched_version`; this endpoint does not return a song if version matching fails. `POST /api/agent/explain` accepts `{"expression":"다시","lines":["..."]}` only when the server model is configured. Its output is explicitly `AI 生成，未人工核对`.

Mac Music: `GET /api/mac/status` checks the current player; `GET /api/mac/library?artist=RIIZE` lists matching local-library metadata; `POST /api/mac/play-line` accepts `{"title":"Memories","artist":"RIIZE","startMs":5000,"endMs":8000}` and reports whether the bridge verified the seek and scheduled pause. `POST /api/mac/discover` accepts `{"artist":"RIIZE","expression":"다시"}` and returns source-matched hits with neighboring lines and the indexing coverage. The Discover endpoint performs text matching, not word-form or meaning verification. These routes are available only on macOS and the server remains bound to loopback.

Errors use `{"error":{"code":"INVALID_INPUT","message":"..."}}` with appropriate HTTP status. Upstream source errors and model errors remain explicit. Tool logs contain names, statuses, and sanitized summaries, never hidden model reasoning.
