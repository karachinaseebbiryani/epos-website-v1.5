# Karachi Naseeb Unified Restaurant Platform — Handover Package

> **Read-order**: 00 → 01 → 03 → 02 → 05 → 09 → 04 → 06 → 07 → 08
> **Critical first read for any new AI agent**: `03_BUSINESS_CRITICAL_RULES.md` and `05_AI_CONTINUATION_INSTRUCTIONS.md`

## What this is

A merged restaurant management platform combining:
- **OLD** — a fully-operational Windows-installable POS terminal (cashier punching, vendors, expenses, refunds, X/Z reports, voice assistant, offline-first via local Mongo + Cloudflared tunnel).
- **NEW** — a customer-facing ordering website + slim admin panel for online orders.

Both worlds are now under one codebase, one MongoDB, one auth setup, one admin shell. Public site at `/`, unified admin shell at `/admin/*` with two nav sections (POS Operations + Online Store), staff sign-in at `/admin/sign-in`.

## Tech stack (do not change)

- **Backend**: FastAPI 0.110.1 (Python), Motor 3.3.1 (async MongoDB)
- **Frontend**: React 19, react-router-dom v7, Tailwind + shadcn/ui, sonner toasts, lucide-react icons
- **Database**: MongoDB (single DB)
- **Auth**: JWT (PyJWT), bcrypt 4.1.3, HttpOnly cookies + Authorization header (dual)
- **Process**: supervisor (backend on 8001, frontend on 3000, Mongo, nginx)
- **Scheduler**: APScheduler 3.11.2 (daily Z-reports)
- **Optional integrations**: emergentintegrations (Whisper STT, GPT-4o, OpenAI TTS, Gemini Nano Banana), Twilio, Stripe

## Repository layout (top-level)

```
/app/
├── backend/                # FastAPI single-file (server.py, 3,479 lines)
├── frontend/               # CRA-based React app (yarn)
├── whatsapp-service/       # Node WhatsApp Web bridge (DO NOT DELETE)
├── windows-setup/          # On-premise Windows install scripts (DO NOT DELETE)
├── memory/                 # PRD.md, test_credentials.md
├── HANDOVER/               # ← THIS PACKAGE
└── test_reports/           # iteration_*.json from testing agent
```

## Document index

| # | File | Purpose |
|---|---|---|
| 00 | `00_README.md` | This file — entry point and read-order |
| 01 | `01_PROJECT_SUMMARY.md` | Architecture: backend, frontend, DB, auth, sync, permissions, notifications, vendor automation, invoice, deployment |
| 02 | `02_IMPLEMENTATION_STATUS.md` | What's done / partial / deferred / known issues / technical debt / active routes |
| 03 | `03_BUSINESS_CRITICAL_RULES.md` | What MUST NEVER be rewritten or broken |
| 04 | `04_ROADMAP.md` | Prioritized backlog in implementation order |
| 05 | `05_AI_CONTINUATION_INSTRUCTIONS.md` | How future AI must operate (mistakes to avoid) |
| 06 | `06_TECHNICAL_SETUP.md` | Deps, env vars, dev/build/deploy, DB import/export |
| 07 | `07_FILE_MAP.md` | Annotated file/folder map |
| 08 | `08_LOGIN_TEST_INFO.md` | Credentials, routes, test commands |
| 09 | `09_SAFE_CONTINUATION_CHECKLIST.md` | Pre-change checklist (run before EVERY change) |

## Current state (snapshot)

- **Iteration 2 complete** (production-readiness pass). 9/10 user-requested improvements implemented; #10 (unified invoice template) deferred.
- **Backend**: 113 endpoints. 45/45 pytest tests pass.
- **Frontend**: 33 pages (14 customer + 8 online-admin + 11 legacy POS) + 11 components. 100% of last regression run pass.
- **Auth**: 2 coexisting JWT contexts — staff (`/api/auth/*`) and customer (`/api/customer/*`). Plus a unified login at `/admin/sign-in` that sets BOTH `staff_auth_token` and `knb_admin_token` localStorage keys.
- **Vendor automation**: outsourced products auto-create vendor payables on sale; refunds auto-reverse them.
- **Global notifications**: `<GlobalOrderAlert/>` mounted in AdminLayout — pings every admin page every 4s.

## Next session must-reads (in order)

1. `03_BUSINESS_CRITICAL_RULES.md` — to avoid breaking POS
2. `09_SAFE_CONTINUATION_CHECKLIST.md` — to know what to do before any code change
3. `02_IMPLEMENTATION_STATUS.md` — to understand the live state
4. `04_ROADMAP.md` — to know what to work on next
