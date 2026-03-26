# AI-Agent Driven Context-Aware Release Testing System

A production-grade MVP that uses AI agents to analyze software requirements and code changes, automatically generating **traceable, prioritized test cases**, detecting missing scenarios, analyzing code change impact, and predicting release risk with a **confidence-scored explanation**.

---

## Demo

> 📹 **Demo video coming soon**
>
> A walkthrough video demonstrating the Release Sentinel system will be added here.

---

## What Makes This Different

Most AI testing tools do: `Input → LLM → Output`

This system does: `Input → Structured Context → Reasoning → Output (with proof)`

Every test case includes **traceability** (where it came from), every test has a **priority** (why it matters), and every risk score has a **confidence score** with **specific factors** — not guesses.

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Traceability** | Every test case includes `derivedFrom.requirement` + `derivedFrom.code` — proves what it tests |
| **Context Builder** | Structured understanding layer built before any LLM call (entities, constraints, changed functions, risk signals) |
| **Risk Model** | Weighted score 0-100 with `confidence` (0-1) and specific `factors` — no fake coverage numbers |
| **Test Prioritization** | HIGH / MEDIUM / LOW priority with reasoning per test case (auth/payment = HIGH) |
| **Input Validation** | Bad/vague input is rejected with a clear error — prevents hallucination |
| **Requirement Understanding** | Extracts entities, actions, and constraints from natural language |
| **Feedback Loop** | Users mark tests as useful/not useful + 1-5 star ratings (stored for future training) |
| **GitHub Webhook** | `POST /api/webhooks/github` triggers automatic analysis on push/PR |
| **Dashboard UI** | Dark-mode React dashboard with risk gauge, test case viewer, tabs, history |
| **Failure Prediction** | AI predicts potential failures based on code changes and requirements |
| **Multi-stage Analysis Pipeline** | Status tracking: pending → processing → parsing → analyzing_risk → predicting_failures → generating_tests → completed |

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, Recharts, TanStack Query, Radix UI, Wouter |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI SDK (openai ^4) |
| Validation | Zod v4, drizzle-zod |
| Logging | Pino (pino ^9, pino-http ^10) |
| API Contract | OpenAPI 3.1 + Orval codegen |
| Package Manager | pnpm (monorepo with catalogs) |

---

## Project Structure

```
├── artifacts/
│   ├── api-server/                  # Express REST API
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── health.ts
│   │       │   ├── requirements.ts  # Requirements CRUD + AI entity extraction
│   │       │   ├── analyses.ts      # Analysis pipeline (validation → context → LLM → risk → failures → tests)
│   │       │   ├── test-cases.ts    # Feedback endpoint
│   │       │   └── webhooks.ts      # GitHub webhook handler
│   │       └── services/
│   │           └── ai-engine.ts     # All AI + ML logic (see breakdown below)
│   └── release-testing-ui/          # React dashboard
│       └── src/
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   ├── NewAnalysis.tsx
│           │   ├── AnalysisDetail.tsx
│           │   ├── Requirements.tsx
│           │   └── History.tsx
│           └── components/
│               ├── Layout.tsx
│               └── Gauge.tsx
├── lib/
│   ├── api-spec/openapi.yaml        # Single source of truth for API contract
│   ├── api-client-react/            # Generated React Query hooks
│   ├── api-zod/                     # Generated Zod schemas
│   └── db/src/schema/
│       ├── requirements.ts
│       ├── analyses.ts
│       ├── test_cases.ts            # Includes priority, derivedFrom fields
│       └── risk_scores.ts           # Includes confidence, factors, predictedFailures, riskBreakdown
```

---

## AI Engine Breakdown (`ai-engine.ts`)

### 1. `validateInput(gitDiff, requirementText)` — Input Validation
Rejects bad input before it reaches the LLM. Returns a structured error:
```json
{
  "error": "Insufficient input",
  "message": "Provide detailed code changes. The diff is too short to analyze."
}
```

### 2. `parseGitDiff(diff)` — Diff Parser
Parses raw git diff output to extract:
- Files changed, lines added/deleted (code churn)
- Impacted function/class names (via regex)
- Critical module detection (auth, payments, external APIs)

### 3. `buildAnalysisContext(diff, requirementText)` — Context Builder
Builds a structured context object **before** the LLM call:
```json
{
  "requirement_summary": ["OAuth login", "24-hour session", "invalidate on logout"],
  "constraints": ["reject invalid tokens", "handle network failure"],
  "changed_functions": ["loginWithGoogle", "logout"],
  "risk_signals": { "authModule": true, "externalApi": true }
}
```
This makes the system **data-driven**, not prompt-driven.

### 4. `predictRisk(diff, context)` — Risk Model
Weighted formula:
```
risk = churn(30%) + filesChanged(20%) + complexity(25%) + coverageSignal(25%)
     + criticalModuleBonus + externalApiBonus + paymentModuleBonus
```
Output includes `confidence` (based on signal count) and `factors` (specific reasons):
```json
{
  "score": 40,
  "confidence": 0.69,
  "level": "medium",
  "factors": [
    "Authentication module modified (critical path)",
    "External API dependency introduced or modified"
  ]
}
```

### 5. `predictFailures(gitDiff, reqText, diffAnalysis, context)` — Failure Prediction
AI-powered prediction of potential failures based on code changes:
```json
[
  {
    "issue": "Token expiration not handled",
    "reason": "Auth module modified but no validation added",
    "affected_module": "authentication",
    "severity": "HIGH"
  }
]
```

### 6. `generateTestCases(diff, requirement, diffAnalysis, context, failures)` — LLM + Traceability
Sends the structured context (not raw text) to GPT. Each returned test case includes:
- **`derivedFrom.requirement`** — exact phrase from the requirement
- **`derivedFrom.code`** — function call chain (e.g. `loginWithGoogle -> verifyIdToken`)
- **`priority`** — HIGH / MEDIUM / LOW (classified by `classifyPriority()`)
- **`priorityReason`** — human-readable explanation
- **`linkedIssue`** — links test case to predicted failure

### 7. `extractRequirementEntities(description)` — Requirement Understanding
Uses AI to extract structured entities from natural language requirements:
```json
{
  "entities": ["user", "session", "token"],
  "actions": ["login", "logout", "invalidate"],
  "constraints": ["24-hour expiry", "reject invalid tokens"]
}
```

---

## Full Output Example

```json
{
  "status": "completed",
  "testCases": [
    {
      "type": "negative",
      "priority": "HIGH",
      "priorityReason": "Security-critical authentication path — must not regress",
      "title": "Reject expired Google ID token",
      "steps": [
        "Generate an expired Google ID token",
        "Call loginWithGoogle() with expired token",
        "Assert verifyIdToken() throws"
      ],
      "expectedResult": "401 error returned, no session created",
      "derivedFrom": {
        "requirement": "Invalid or expired tokens must be rejected",
        "code": "loginWithGoogle -> client.verifyIdToken -> throws on invalid payload"
      },
      "linkedIssue": "Token expiration not handled"
    }
  ],
  "riskScore": {
    "score": 40,
    "confidence": 0.69,
    "level": "medium",
    "factors": [
      "Authentication module modified (critical path)",
      "External API dependency introduced or modified"
    ],
    "explanation": "Moderate risk. Changes affect 1 file with identifiable impact on: loginWithGoogle, logout. Regression tests recommended.",
    "riskBreakdown": {
      "changeSize": 15,
      "criticalModule": 25,
      "concurrencyRisk": 0,
      "validationMissing": 10
    },
    "predictedFailures": [
      {
        "issue": "Token expiration not handled",
        "reason": "Auth module modified but no validation added",
        "affected_module": "authentication",
        "severity": "HIGH"
      }
    ]
  }
}
```

---

## Database Schema

```sql
-- requirements: natural language feature descriptions
requirements (id, title, description, entities[], actions[], constraints[], created_at)

-- analyses: each code review session (with multi-stage status tracking)
analyses (id, requirement_id, title, git_diff, status, created_at)
-- status: pending | processing | parsing | analyzing_risk | predicting_failures | generating_tests | completed | failed

-- test_cases: AI-generated tests with traceability + priority
test_cases (
  id, analysis_id, type, priority, priority_reason,
  title, description, steps[], expected_result,
  derived_from_requirement,   -- traceability: requirement phrase
  derived_from_code,          -- traceability: code function chain
  linked_issue,               -- links to predicted failure
  relevance_score, feedback, created_at
)

-- risk_scores: ML-predicted risk with confidence + factors + failures
risk_scores (
  id, analysis_id, score, confidence, level, explanation,
  factors[],                  -- specific contributing factors
  code_churn, files_changed, complexity,
  test_coverage_signal,       -- inferred based on churn patterns
  impacted_modules[],
  predicted_failures[],        -- AI-predicted potential failures
  risk_breakdown{},           -- detailed risk component breakdown
  created_at
)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET | `/api/requirements` | List all requirements |
| POST | `/api/requirements` | Create requirement (AI extracts entities/actions/constraints) |
| GET | `/api/requirements/:id` | Get a requirement |
| GET | `/api/analyses` | List all analyses |
| POST | `/api/analyses` | Submit diff for full AI analysis |
| GET | `/api/analyses/:id` | Full result: test cases + risk score |
| POST | `/api/test-cases/:id/feedback` | Submit feedback (useful/not_useful + relevance score) |
| POST | `/api/webhooks/github` | GitHub push webhook trigger |

### Analysis Status Pipeline

The analysis goes through multiple stages, providing real-time progress:

```
pending → processing → parsing → analyzing_risk → predicting_failures → generating_tests → completed
                                    ↓ (on error)
                                  failed
```

### Input Validation — POST `/api/analyses`

The endpoint validates input **before** hitting the LLM:

| Scenario | Response |
|----------|----------|
| `gitDiff: "hello"` | `422 { "error": "Insufficient input", "message": "..." }` |
| Empty diff | `422 { "error": "Insufficient input" }` |
| No diff-like structure | `422 { "error": "Invalid git diff" }` |
| Valid diff | `201 { "id": 1, "status": "processing" }` |

---

## Priority Classification Logic

| Condition | Priority |
|-----------|----------|
| Negative test + auth/payment module | HIGH |
| Any test touching auth/security | HIGH |
| Any test touching payment/billing | HIGH |
| External API dependency | MEDIUM |
| Negative test (general) | MEDIUM |
| Edge case test | MEDIUM |
| General functional test | LOW |

---

## GitHub Webhook Setup

Point your GitHub repository webhook to `POST /api/webhooks/github`:

```
Repository Settings → Webhooks → Add webhook
Payload URL: https://your-domain.com/api/webhooks/github
Content type: application/json
Events: Push / Pull request
```

The system automatically creates an analysis for every push, extracting changed files and functions from the commit list.

---

## Evaluation Metrics

- **Traceability score**: Every test case links back to a requirement phrase and code path — reviewable by humans
- **Test case relevance**: Captured via feedback (useful/not_useful) and 1-5 star `relevance_score`, stored in DB
- **Risk confidence**: Model confidence (0-1) based on number of detected signals
- **Failure prediction accuracy**: Linked issues can be validated against actual bugs discovered
- **All AI outputs are logged** via structured pino logging for offline analysis

---

## Setup & Installation

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL database
- OpenAI API key

### 1. Clone the repository

```bash
git clone https://github.com/Harshad071/ai-release-testing.git
cd ai-release-testing
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Create a `.env` file (or set in your environment):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/release_testing

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Server
PORT=8080
NODE_ENV=development
```

### 4. Run database migrations

```bash
pnpm --filter @workspace/db run push
```

### 5. Start development servers

```bash
# Terminal 1 — API server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend
pnpm --filter @workspace/release-testing-ui run dev
```

API available at `http://localhost:8080/api`, frontend at `http://localhost:5173`.

---

## Development Commands

```bash
# Type check all packages
pnpm run typecheck

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push database schema changes
pnpm --filter @workspace/db run push

# Build API for production
pnpm --filter @workspace/api-server run build

# Build frontend for production
pnpm --filter @workspace/release-testing-ui run build
```

---

## Roadmap

- **Real GitHub Integration** — Fetch diffs directly via GitHub API + OAuth app
- **Historical Bug Dataset Training** — Train the risk model on real defect data
- **Reinforcement Learning from Feedback** — Fine-tune prompts using collected relevance ratings
- **Test Export** — Export generated tests as Jest, Pytest, or Postman collections
- **Multi-user Support** — Team collaboration with role-based access
- **Coverage API Integration** — Pull real test coverage from Jest/Pytest-cov instead of inferring

---

## License

MIT
