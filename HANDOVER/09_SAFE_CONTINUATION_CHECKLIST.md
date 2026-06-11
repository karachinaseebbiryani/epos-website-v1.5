# 09 — Safe Continuation Checklist

> **Run through this BEFORE making any code change. Especially for new AI agents.**

## A. Pre-flight (every session)

- [ ] I have read `00_README.md`, `03_BUSINESS_CRITICAL_RULES.md`, and `05_AI_CONTINUATION_INSTRUCTIONS.md`.
- [ ] I have read the latest `/app/test_reports/iteration_*.json` to know the current test status.
- [ ] I have read `/app/memory/PRD.md` to see what previous iterations did.
- [ ] I understand that `pages/legacy/`, `components/legacy/`, `whatsapp-service/`, and `windows-setup/` are PRESERVED business logic — not refactor candidates.
- [ ] I know that `MONGO_URL`, `DB_NAME`, and `REACT_APP_BACKEND_URL` are protected by the Emergent platform.
- [ ] I know there are 2 separate auth contexts (customer + staff) and they MUST stay separate.
- [ ] I know the unified login at `/admin/sign-in` sets BOTH `staff_auth_token` AND `knb_admin_token`.

## B. Before editing the backend

- [ ] If touching `/api/auth/*` or `/api/customer/*` (any auth logic): I will call `integration_playbook_expert_v2` first.
- [ ] If touching `create_order` or `create_refund`: I understand the auto-vendor-payable hook depends on this exact code path. Outsourced items in cart auto-spawn `vendor_transactions` rows.
- [ ] If adding a Pydantic field to an existing model: it is `Optional[T]` with a sensible default.
- [ ] If adding a new permission: I will append to `ALL_PERMISSIONS` (NEVER remove or reorder existing entries).
- [ ] If touching `seed_admin()`: the function MUST remain idempotent and run on every startup.
- [ ] I know that bare `except: pass` is a code smell here (silently hides outsourced reversal failures); use `except Exception as e: logger.warning(...)`.
- [ ] If adding a new endpoint: it's prefixed `/api/...` and uses `await get_current_user(request)` for auth.

## C. Before editing the frontend

- [ ] If touching anything under `pages/legacy/`: I am making an ADDITIVE change, not a refactor.
- [ ] If touching `App.js` routes: I will not remove any existing route (only add).
- [ ] If touching `AdminLayout.jsx`: POS Operations section stays FIRST, Online Store SECOND.
- [ ] If touching `UnifiedLoginPage.jsx`: I will continue to set BOTH `staff_auth_token` AND `knb_admin_token` on success.
- [ ] If adding a new admin route: I have wrapped it in `<Op perm="...">` and added a corresponding entry to `OPS_NAV` or `ONLINE_NAV`.
- [ ] I am NOT replacing the dedicated `staffAxios` instance with raw `axios` (cookies + headers logic is purposeful).
- [ ] I am NOT lazy-loading login pages or critical entry routes.
- [ ] I am using `mcp_search_replace` for surgical edits (NOT `mcp_create_file overwrite=True` unless creating a new file).

## D. Before adding integrations

- [ ] I have called `integration_playbook_expert_v2` to get the playbook.
- [ ] If the integration is OpenAI / Anthropic / Gemini text or image: I am using the **Emergent LLM Key** (`EMERGENT_LLM_KEY`) via `emergentintegrations`, NOT installing the SDK directly.
- [ ] I have asked the user for required API keys before writing code.
- [ ] I have added env vars to `.env` (without removing existing keys).
- [ ] I have added graceful no-op when the env var is empty (do not hard-fail).

## E. Before declaring success

- [ ] I have restarted the affected service (`sudo supervisorctl restart backend` or relied on frontend hot-reload).
- [ ] I have run a quick curl smoke test (login → list categories → list menu).
- [ ] If non-trivial: I have called `testing_agent_v3` with a clear test plan + previous iteration context.
- [ ] I have read the resulting `iteration_*.json` and addressed any blocking issues.
- [ ] I have updated `/app/memory/PRD.md` with date + summary of changes.
- [ ] I have updated `/app/memory/test_credentials.md` if any credentials changed.
- [ ] I have updated relevant HANDOVER docs if the architecture changed.

## F. Forbidden operations checklist

If ANY of these applies, STOP and ask the user first:

- [ ] Renaming or dropping a MongoDB collection
- [ ] Splitting `server.py` into multiple files
- [ ] Removing files from `pages/legacy/` or `components/legacy/`
- [ ] Changing the JWT_SECRET
- [ ] Switching `_id: ObjectId` to `id: str(uuid())`
- [ ] Merging customer auth and staff auth into one context
- [ ] Removing the `/admin/login` or `/admin/staff-login` redirects
- [ ] Removing `whatsapp-service/` or `windows-setup/` folders
- [ ] Changing backend port from 8001 or frontend port from 3000
- [ ] Adding a required (non-Optional) field to an existing Pydantic model
- [ ] Removing an existing permission from `ALL_PERMISSIONS`
- [ ] Reordering POS Operations and Online Store sections in the sidebar
- [ ] Replacing `bcrypt` with another hashing algorithm
- [ ] Switching from CRA to Vite
- [ ] Switching frontend package manager from yarn to npm
- [ ] Hardcoding any URL that should come from env (`REACT_APP_BACKEND_URL`)
- [ ] Logging sensitive data (passwords, JWT tokens, customer payment info)

## G. Common mistakes self-check

Ask yourself:

- [ ] Am I using ObjectId for Mongo queries and string for responses?
- [ ] Am I excluding `_id` from response dicts (or popping it)?
- [ ] Am I using `datetime.now(timezone.utc)` (NOT deprecated `utcnow()`)?
- [ ] Am I storing dates as ISO strings (not datetime objects)?
- [ ] Am I using the right axios instance? (`api` for online, `staffAxios` for legacy POS)
- [ ] Am I checking permissions on the backend, not just hiding UI?
- [ ] Am I using `data-testid` on every interactive/critical-info element?
- [ ] Am I avoiding emojis in source files?
- [ ] Am I keeping new components < 200 lines?
- [ ] Am I matching the existing code style (no semi-aggressive reformatting)?

## H. After making changes

- [ ] Lint runs clean: `mcp_lint_python` (acceptable for pre-existing E701/E401 only) and `mcp_lint_javascript` (zero issues).
- [ ] Both `supervisorctl status` shows `RUNNING` for backend and frontend.
- [ ] No errors in `/var/log/supervisor/backend.err.log` or `frontend.err.log` since restart.
- [ ] Smoke test passes (curl + browser screenshot if UI).
- [ ] Test agent run is green or all blocking issues are addressed.

## I. Handover-specific (when ending a session)

- [ ] `finish` tool called with summary including: completed work, test status, next action items, smart enhancement idea.
- [ ] PRD.md updated.
- [ ] If creds changed: test_credentials.md updated.
- [ ] If new files of significance: 07_FILE_MAP.md updated.
- [ ] If new architecture decisions: 01_PROJECT_SUMMARY.md updated.
- [ ] If new business-critical rule emerges: 03_BUSINESS_CRITICAL_RULES.md updated.

---

## Quick "what should I do now?" decision tree

```
User said: "fix bug X"
  ├─ Reproduce first (curl or screenshot)
  ├─ Check 03_BUSINESS_CRITICAL_RULES.md — is X in protected zone?
  │     └─ YES → ask user for confirmation before editing
  │     └─ NO  → fix with mcp_search_replace
  ├─ Restart only what's needed (or rely on hot-reload)
  ├─ Smoke test
  ├─ If non-trivial: call testing_agent_v3
  └─ finish with summary

User said: "add feature Y"
  ├─ Check if Y is on roadmap (04_ROADMAP.md) — note the priority
  ├─ Check if Y needs an integration → call integration_playbook_expert_v2
  ├─ Plan: what files do I touch? (use 07_FILE_MAP.md)
  ├─ Run through Section B/C of THIS checklist
  ├─ Implement (parallel mcp_create_file / mcp_search_replace)
  ├─ Restart, smoke test, testing_agent_v3
  └─ finish with summary + update HANDOVER docs

User asked a question / wants info
  ├─ Answer directly, no tools
  └─ If they want capabilities info: call support_agent

User unhappy / refund / GitHub push
  └─ call support_agent (do not handle yourself)
```
