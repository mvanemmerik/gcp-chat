# GCP Chatbot — Claude Code Context

## Project Overview

A personal GCP-hosted chatbot web app using Gemini AI with short-term (session) and long-term (user profile/facts) memory. Google OAuth authentication, Next.js frontend deployed on Cloud Run.

**Architecture diagram:** `/Users/monty/Desktop/Claude/outputs/gcp-chatbot-architecture.svg`

## Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **AI**: Gemini `gemini-2.0-flash-001` via Vertex AI (`@google-cloud/vertexai`)
- **Auth**: NextAuth.js v4 with Google OAuth provider
- **Database**: Firestore (Native mode, us-east1) — sessions + user profiles
- **Hosting**: Cloud Run (us-east1), Docker (linux/amd64)
- **Registry**: Artifact Registry — `us-east1-docker.pkg.dev/mvanemmerik-ai/chatbot-repo/gcp-chatbot`
- **CI/CD**: Cloud Build trigger (`deploy-on-push-to-main`) on push to `main` using `cloudbuild.yaml`
- **Secrets**: Secret Manager (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL)
- **Markdown**: `react-markdown` + `remark-gfm` for rendering bot responses

## GCP Project

- **Project**: `mvanemmerik-ai`
- **Org**: `159824466078`
- **Region**: `us-east1`
- **Cloud Run service**: `gcp-chatbot`
- **Service account**: `chatbot-sa@mvanemmerik-ai.iam.gserviceaccount.com`
  - Roles: `aiplatform.user`, `datastore.user`, `secretmanager.secretAccessor`, `viewer`, `billing.viewer` (on billing account)
- **Custom domain**: `gcp.vanemmerik.ai` ✅ (cert provisioned, HTTPS live)
- **Billing account**: `01AEC3-8AA1BE-E5511A`

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/gemini.ts` | Vertex AI client, `chat()`, `chatStream()` generator, tool routing, fact extraction |
| `src/lib/gcp-tools.ts` | 8 GCP tool implementations + Gemini declarations |
| `src/lib/firestore.ts` | Firestore data layer (sessions, user profiles, session metadata) |
| `src/lib/auth.ts` | NextAuth config with Google provider |
| `src/app/api/chat/route.ts` | POST handler — SSE streaming response |
| `src/app/api/sessions/route.ts` | GET handler — list session metadata or load full session by `?id=` |
| `src/components/ChatLayout.tsx` | Main chat UI, SSE stream reader, session history sidebar |
| `src/components/MessageInput.tsx` | Chat input with auto-focus, predefined suggestion chips |
| `src/components/MessageList.tsx` | Markdown rendering, copy buttons, animated typing dots, error bubbles |
| `src/types/index.ts` | Shared TypeScript interfaces |
| `Dockerfile` | Multi-stage build (linux/amd64) |
| `cloudbuild.yaml` | CI/CD: build → push to Artifact Registry → deploy to Cloud Run |

## Firestore Collections

- `chat_sessions/{userId}/sessions/{sessionId}` — `{ sessionId, title, messages: Message[], createdAt }`
  - `title` is set from the first user message (50 char truncation) on session creation
- `user_profiles/{userId}` — `{ userId, email, name, facts: Record<string, unknown>, createdAt, lastUpdated }`

## GCP Function Calling Tools (8 total)

`listCloudRunServices`, `listGCSBuckets`, `listFirestoreCollections`, `listVMs`, `getProjectInfo`, `listEnabledAPIs`, `getIAMPolicy`, `getGCPCosts`

## Tool Routing (gemini.ts)

Gemini cannot mix `googleSearch` grounding with `functionDeclarations` in the same request — they are mutually exclusive in Vertex AI.

Routing logic in `isGCPQuery()`:
- **GCP keywords detected** → use `GCP_TOOL_DECLARATIONS` (live resource queries)
- **Non-GCP question** → use `{ googleSearch: {} }` grounding (real-time web search)

Use `googleSearch` (Gemini 2.0 format) — `googleSearchRetrieval` is deprecated and not supported for `gemini-2.0-flash-001`.

## Streaming (chat/route.ts + gemini.ts + ChatLayout.tsx)

`/api/chat` returns `text/event-stream` (SSE). Each chunk is `data: {"chunk":"..."}`, terminated by `data: [DONE]`.

- **Non-GCP queries** (Google Search path): real token-by-token streaming via `sendMessageStream()`
- **GCP tool queries**: function calling loop runs synchronously, then full text yielded in one chunk
- Frontend (`ChatLayout`): typing dots show until first chunk, then transitions to streamed text being appended in place
- Full reply accumulated in stream handler before saving to Firestore and running fact extraction

## Session History

- Sessions listed in sidebar, loaded via `GET /api/sessions` (metadata only: sessionId, title, createdAt)
- Click a session → `GET /api/sessions?id={sessionId}` → loads full messages
- `listSessionsMeta` uses Firestore `.select()` for efficient metadata-only reads (no messages fetched)
- Session title set from first user message on creation (50 char truncation with ellipsis)
- History refreshes after each `[DONE]` event

## UI Features

- **Streaming**: text appears progressively as Gemini generates
- **Session history**: past conversations in sidebar with auto-generated titles
- **Copy buttons**: hover any code block → "Copy" button appears top-right, shows "Copied!" for 2s
- **Suggestion chips**: 6 predefined prompts shown on fresh chat (hidden once conversation starts)
- **Markdown rendering**: code blocks, tables, lists, links rendered in bot responses
- **Animated typing indicator**: 3 bouncing dots while waiting for first chunk
- **Error bubbles**: failed requests show red message in chat (not silent)
- **Auto-focus**: input refocuses after every message send

## OAuth Configuration

- Consent screen: "External" + Testing mode
- Test user: `mvanemmerik.gcp@gmail.com`
- Authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://gcp-chatbot-1049796559731.us-east1.run.app/api/auth/callback/google`
  - `https://gcp.vanemmerik.ai/api/auth/callback/google`

## Development Commands

```bash
npm run dev        # Start local dev server (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm test           # Jest tests
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=        # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLOUD_PROJECT=mvanemmerik-ai
VERTEX_AI_LOCATION=us-east1
GEMINI_MODEL=gemini-2.0-flash-001
GEMINI_FLASH_MODEL=gemini-2.0-flash-001
```

## Deployment

Push to `main` → Cloud Build auto-triggers → builds image → deploys to Cloud Run (~4 min).

```bash
# Check build status
gcloud builds list --project=mvanemmerik-ai --limit=3

# Check cert/domain status
gcloud beta run domain-mappings describe --domain gcp.vanemmerik.ai --region us-east1 --project mvanemmerik-ai

# Manual redeploy (e.g. after secret update)
gcloud run services update gcp-chatbot --region=us-east1 --project=mvanemmerik-ai --update-secrets=NEXTAUTH_URL=NEXTAUTH_URL:latest
```

## Important Notes

- **Multi-function calls**: Gemini can return multiple `functionCall` parts in one turn — collect all with `.filter()`, execute in parallel with `Promise.all()`, send all responses back in one `sendMessage()` call. Using `.find()` (only first) causes a 400 INVALID_ARGUMENT error.
- **SSE streaming**: `/api/chat` uses `ReadableStream` with `text/event-stream`. Firestore save and fact extraction happen after stream completes (inside the `[DONE]` handler, not before streaming starts).
- **Firestore saves**: use `FieldValue.arrayUnion(message)` for atomic appends — no read-modify-write race condition.
- **Docker**: must use `--platform linux/amd64` — Cloud Run requires it; dev machine is Apple Silicon.
- **Google Search vs function calling**: cannot be combined in one request. Route via `isGCPQuery()` keyword detection.
- **`googleSearch` (not `googleSearchRetrieval`)**: use the former for Gemini 2.0 models — `googleSearchRetrieval` is deprecated and returns a 400 error.
- **Cloud Build SA**: trigger runs as `1049796559731-compute@developer.gserviceaccount.com`, granted `artifactregistry.writer`, `run.developer`, and `iam.serviceAccountUser` on `chatbot-sa`.
