# 05 — AI Continuation Instructions

> **Required reading for any AI agent picking up this project.** Past iterations have made specific mistakes that this document is designed to prevent.

## A. How to Continue This Project (workflow)

### Session opening (every new session)
1. **Read `00_README.md`** to know what exists.
2. **Read `03_BUSINESS_CRITICAL_RULES.md`** to know what cannot break.
3. **Read `02_IMPLEMENTATION_STATUS.md`** to know the current state.
4. **Read `04_ROADMAP.md`** to know what to work on next.
5. **Check `/app/test_reports/iteration_*.json`** for last-known test status.
6. **Read `/app/memory/PRD.md`** for cumulative session log.
7. Only THEN ask the user what they want and propose a plan.

### Before any code change
- Run through the checklist in `09_SAFE_CONTINUATION_CHECKLIST.md`.
- If a change touches `pages/legacy/`, `components/legacy/`, or any of the 71 OLD endpoints, **stop and confirm with the user**.

### After any code change
- Restart only what's needed (`sudo supervisorctl restart backend` for backend; frontend hot-reloads automatically).
- Run quick curl smoke test (login → list categories → list menu).
- Call `testing_agent_v3` for non-trivial changes. Do NOT declare success without test agent confirmation.
- Update `/app/memory/PRD.md` with the date + what changed.

### Session closing
- Use the `finish` tool with a clear summary.
- If credentials were changed: update `/app/memory/test_credentials.md`.
- If new files of significance: update `07_FILE_MAP.md`.

## B. What to AVOID (mistakes from past iterations)

### B1. ❌ Lazy-loading routes that the user lands on directly
**What happened**: I lazy-loaded `StaffLoginPage` via `React.lazy(...)`. The Suspense fallback got stuck because of a chunk-loading race in the preview environment. The user saw "Loading…" forever.
**Rule**: Login pages and critical entry routes must be EAGER imports. Only lazy-load deep pages that are unlikely to be the landing.

### B2. ❌ Calling raw axios from a context's submit handler when the route guard depends on context state
**What happened**: `UnifiedLoginPage` initially used `staffAxios.post(...)` directly, then `navigate(target)`. The token was stored in localStorage, but `StaffAuthContext.user` state was never updated, so `<StaffGate>` saw `user === null` and bounced back to `/admin/sign-in`.
**Rules**:
- Always use the context's `login()` function so React state updates atomically.
- For any admin route guarded by a context, prefer `window.location.replace(target)` after sign-in to force a clean reload — bypasses concurrent-render races.

### B3. ❌ Re-writing entire files when a small edit would do
**What happened**: An earlier AI rewrote `frontend/src/App.js` and dropped the customer routes when adding admin routes. That triggered the user's "the new AI replaced my old logic" complaint that started this whole project.
**Rule**: Use `mcp_search_replace` for surgical edits. Only `mcp_create_file` with `overwrite=True` when literally creating a new file or doing a top-to-bottom rewrite that you've validated against existing imports.

### B4. ❌ Removing `pages/legacy/` or `components/legacy/`
**What happened**: An earlier AI deleted the OLD POS pages thinking they were "duplicate code" with `pages/admin/`. They are NOT duplicates — `pages/admin/` is the slim online-store admin; `pages/legacy/` is the rich operational POS. **Both must coexist.**
**Rule**: ANY file in a `legacy/` folder is preserved business logic. Do not refactor, do not "modernize", do not rename.

### B5. ❌ Changing `.env` keys protected by Emergent
**Rule**: NEVER touch `MONGO_URL`, `DB_NAME` in `backend/.env`, or `REACT_APP_BACKEND_URL` in `frontend/.env`. Adding NEW keys is fine.

### B6. ❌ Switching to `id: str = uuid()` for Mongo documents
**What happened**: Earlier projects on this stack converted to UUID for "JSON serializability". This codebase uses ObjectId and converts to string on every read. **Don't switch.**
**Rule**: Use `ObjectId(item_id)` for queries and `str(doc["_id"])` for responses. Always pop `_id` from response dicts (or use `{"_id": 0}` projection).

### B7. ❌ Adding required fields to existing Pydantic models
**Rule**: Any new field on an existing model must be `Optional[...]` with a default. Otherwise existing cashier tablets will get 422 errors on payloads that worked yesterday.

### B8. ❌ Reordering existing nav items
**Rule**: Iter 2 reordered POS Operations FIRST, Online Store SECOND per user instruction. Do not flip them back. Adding new items is fine — append, don't reorder.

### B9. ❌ Removing the `/admin/login` and `/admin/staff-login` redirects
**Rule**: They MUST stay as redirects to `/admin/sign-in`. Old bookmarks depend on them.

### B10. ❌ Calling integration_playbook_expert before implementing custom auth
**What happened**: An earlier AI wrote bcrypt/JWT auth from scratch and got the bcrypt env-var expansion wrong (the `$` in the hash got expanded by the shell). 
**Rule**: For any auth change, read `/app/backend/server.py` lines around `hash_password` / `verify_password` / `create_access_token` first. The implementation is correct as-is; do not "improve" it. If you must add auth features, call `integration_playbook_expert_v2`.

## C. Architecture Principles (must preserve)

### C1. API-first, single-file-pragmatic backend
- One `server.py` is acceptable for now. Do not split unless explicitly asked.
- All routes prefixed `/api/`. All admin routes need `await get_current_user(request)` first.
- Permission gating: `if user.get("role") != "admin" and "perm" not in user.get("permissions", []): raise HTTPException(403)`.

### C2. Three-tier auth, not unified
- Customer (`/api/customer/*`, `knb_token`) — for customer ordering site
- Staff (`/api/auth/*`, `staff_auth_token`) — for POS Operations
- Online admin (`/api/auth/*` reused, `knb_admin_token`) — for online-store admin pages
- The unified login page sets BOTH `staff_auth_token` AND `knb_admin_token` from the same JWT, so an admin signing in once can navigate everywhere.

### C3. Single MongoDB, additive schema
- One DB. 21 collections. Extending an existing collection means adding `Optional[T]` fields with sensible defaults.
- Inserts MUST use ObjectId; reads MUST convert `_id` → `id` string.

### C4. Frontend as one React app, two render zones
- Customer site (Layout) and admin shell (AdminLayout) both live in the same `App.js` BrowserRouter.
- Public routes are gated only by Layout (no auth).
- Admin routes are gated by `<AdminLayout>` (`useEffect` checks `localStorage`) + `<StaffGate>` (uses `useStaffAuth()`).

### C5. Notifications are global, not page-local
- `<GlobalOrderAlert/>` mounts once in `AdminLayout` and works on every admin page.
- It auto-silences on `/admin/orders` to avoid double-up. Do NOT mount per-page alerts that fight with this.

### C6. Outsourced products: invariant
- Order create writes a vendor_transaction with `auto_source: "order"` and POSITIVE total.
- Refund writes a vendor_transaction with `auto_source: "refund"` and NEGATIVE total.
- `/vendors/{id}/sales-summary` aggregates by `auto_source`. **The sign convention must not change.**

### C7. Receipt = Settings-driven
- All receipt formatting (font, sizes, paper width, header/footer) lives in `settings.receipt_*` fields.
- `ReceiptModal` is the canonical template. When unifying invoices (roadmap #10), extend it; do not start from scratch.

### C8. The on-prem story still matters
- `whatsapp-service/` and `windows-setup/` are part of the product. They support restaurants that don't want cloud.
- Backend gracefully no-ops cloud-only integrations (Twilio, Stripe) when env vars are empty — don't replace this with hard failures.

## D. Mistakes That Should Never Happen Again

| # | Mistake | Why it happened | Prevention |
|---|---|---|---|
| 1 | Replaced OLD operational POS pages | Earlier AI confused them with NEW admin pages | Always check folder name. `legacy/` = preserved. |
| 2 | Lazy-loading login pages broke "Loading..." forever | Suspense + chunk race in preview env | Eager-import login pages. |
| 3 | UnifiedLoginPage redirect didn't fire | Used raw axios bypassing context state | Use context's login() + window.location.replace. |
| 4 | Bare `except: pass` swallowed errors | Quick implementation without logging | Always `except Exception as e: logger.warning(...)`. |
| 5 | Two parallel admin tokens | Historical (legacy used cookies, new uses Authorization header) | Documented; consolidate in roadmap phase 6 only. |
| 6 | server.py grew to 3,479 lines | Each iteration added endpoints inline | Acceptable for now; refactor only when user requests. |
| 7 | Hardcoded `/order-alert.wav` path twice | Copy-paste between AdminOrders and GlobalOrderAlert | Extract to constant when convenient. |
| 8 | Frontend tests missing | CRA test setup unused | Phase 1: add at least sign-in smoke test. |

## E. Tooling Etiquette

### When to call testing agent
- After implementing a multi-file feature.
- After fixing a bug that was caught by a previous testing agent.
- Never call it for trivial CSS-only changes.

### When to call integration_playbook_expert_v2
- ALWAYS for new third-party integrations (Stripe, Twilio, Sendgrid, etc.).
- ALWAYS for any auth changes (login, register, password reset, JWT, OAuth).
- NEVER for changes within an already-implemented integration (just edit the code).

### When to ask the user
- Before any change that touches business-critical logic (POS order creation, refund, Z-report, settings doc).
- Before deferred items in the roadmap (e.g. modularization, token consolidation).
- When integration creds are needed (Twilio, Stripe).

### When NOT to ask
- For trivial bug fixes the user already reported.
- For implementation details within an already-approved feature.

## F. Quick reference card

```
✅ DO                                       ❌ DON'T
────────────────────────────────────────────────────────────
Read 03_BUSINESS_CRITICAL_RULES.md first   Skip rules and "just code"
Use mcp_search_replace for edits           Rewrite files unnecessarily  
Restart backend with supervisorctl         Run uvicorn yourself
Use ObjectId for Mongo queries             Switch to UUID
Add Optional[T] fields                     Add required fields to existing models
Call testing_agent after features          Declare success without testing
Preserve pages/legacy/                     Delete or refactor legacy/
Use context.login(), not raw axios         Bypass auth context for "speed"
window.location.replace after sign-in      navigate() then hope React commits in time
Eager-import login pages                   React.lazy() entry routes
```
