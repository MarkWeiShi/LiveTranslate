# LinkU Translation Agent (Python) — real-mode only

This directory is a **placeholder** for the production translation worker. In the MVP
(all-mock mode) it is **not used**: the backend's `TranslationSession` drives a server-side
per-second tick loop that emits captions/state and bills trial seconds. The agent here is the
seam to flip `TRANSLATION_PROVIDER=gemini`.

## What it will do (real mode)
- Join the LiveKit room for an active call as a hidden participant.
- For each speaking direction, open a Gemini 3.5 Live Translate session: source-speaker audio
  in → translated audio (voice-preserving) + caption text out, targeting the listener's
  native language.
- Publish a translated audio track per listener; send `caption` over the LiveKit DataChannel.
- Report translated seconds to the backend's **single accounting ingress**:
  `POST /internal/agent/report` with header `x-agent-token: $AGENT_INGRESS_TOKEN`,
  body `{ callId, speakerId, seconds, originalText?, translatedText?, state? }`.
  This is the *same* billing/paywall/guardrail path the mock loop uses — the backend stays the
  sole accountant (BuildSpec §7.3, §2.3).
- On Gemini latency P95 over threshold / failure → report `state: 'degraded'` (captions only).

## Flip to real
1. Provide `GEMINI_API_KEY`, `GEMINI_LIVE_MODEL`, and LiveKit credentials in `backend/.env`.
2. Set `TRANSLATION_PROVIDER=gemini` and `MEDIA_PROVIDER=livekit`.
3. `python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt`
4. Run the agent worker (LiveKit Agents framework) pointed at the same LiveKit project.

No product code in `backend/` or `app/` changes — only env + this worker.

## requirements.txt (to author when flipping to real)
```
livekit-agents[google]
python-dotenv
httpx
```
