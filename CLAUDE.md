# GCP Chatbot — Claude Code Context

## Project Overview

A personal GCP-hosted chatbot web app using Gemini AI with short-term (session) and long-term (user profile/facts) memory. Google OAuth authentication, Next.js frontend deployed on Cloud Run.

## Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **AI**: Gemini `gemini-2.0-flash-001` via Vertex AI (`@google-cloud/vertexai`)
- **Auth**: NextAuth.js v4 with Google OAuth provider
- **Database**: Firestore (Native mode, us-east1) — sessions + user profiles
- **Hosting**: Cloud Run (us-east1), Docker (linux/amd64)
- **Registry**: Artifact Registry — `us-east1-docker.pkg.dev/mvanemmerik-ai/chatbot-repo/gcp-chatbot`
- **CI/CD**: Cloud Build trigger on push to `main` using `cloudbuild.yaml`
- **Secrets**: Secret Manager (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL)

## GCP Project

- **Project**: `mvanemmerik-ai`
- **Org**: `159824466078`
- **Region**: `us-east1`
- **Cloud Run service**: `gcp-chatbot`
- **Service account**: `chatbot-sa@mvanemmerik-ai.iam.gserviceaccount.com`
  - Roles: `aiplatform.user`, `datastore.user`, `secretmanager.secretAccessor`, `viewer`
- **Custom domain**: `gcp.vanemmerik.ai` (cert provisioning in progress)

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/gemini.ts` | Vertex AI client, function calling loop, fact extraction |
| `src/lib/gcp-tools.ts` | 7 GCP tool implementations + Gemini declarations |
| `src/lib/firestore.ts` | Firestore data layer (sessions, user profiles) |
| `src/lib/auth.ts` | NextAuth config with Google provider |
| `src/app/api/chat/route.ts` | POST handler — auth guard, Gemini call, fact extraction |
| `src/components/ChatLayout.tsx` | Main chat UI with sidebar |
| `src/components/MessageInput.tsx` | Chat input with auto-focus after send |
| `src/components/MessageList.tsx` | Message rendering |
| `src/types/index.ts` | Shared TypeScript interfaces |
| `Dockerfile` | Multi-stage build (linux/amd64) |
| `cloudbuild.yaml` | CI/CD: build → push → deploy to Cloud Run |

## Firestore Collections

- `chat_sessions/{sessionId}` — `{ userId, messages: Message[], createdAt, updatedAt }`
- `user_profiles/{userId}` — `{ facts: Record<string, unknown>, updatedAt }`

## GCP Function Calling Tools

The bot has 7 live tools to query the user's GCP project:
`listCloudRunServices`, `listGCSBuckets`, `listFirestoreCollections`, `listVMs`, `getProjectInfo`, `listEnabledAPIs`, `getIAMPolicy`

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

Push to `main` → Cloud Build auto-triggers → builds image → deploys to Cloud Run.

Manual deploy check:
```bash
gcloud run services describe gcp-chatbot --region=us-east1 --project=mvanemmerik-ai
```

## Important Notes

- Gemini can return multiple `functionCall` parts in one turn — always send all responses back together (not one at a time)
- Firestore `saveMessage` uses `FieldValue.arrayUnion` for atomic appends (no read-modify-write race)
- Docker build must use `--platform linux/amd64` (Cloud Run requires it; dev machine is Apple Silicon)
- OAuth consent screen is "External" + Testing mode; test user: `mvanemmerik.gcp@gmail.com`
