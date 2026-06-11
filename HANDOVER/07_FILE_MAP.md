# 07 — File / Folder Map

> Every file with engineering significance is annotated below. Lines counts are as of iter 2 close.

## /app

```
/app/
├── backend/                     # FastAPI single-file backend
│   ├── server.py                # 3,479 lines — ALL endpoints + models + scheduler + seed
│   ├── requirements.txt         # 128 deps (pip freeze output)
│   ├── .env                     # JWT_SECRET, MONGO_URL, ADMIN_*, optional integration keys
│   └── tests/
│       ├── test_merged_iteration.py    # 37 regression tests (iter 1)
│       └── test_iteration2_outsourced.py # 8 outsourced + permissions tests (iter 2)
│
├── frontend/                    # React 19 + Tailwind + shadcn/ui
│   ├── package.json             # 56 deps + 13 devDeps
│   ├── craco.config.js          # CRA override config
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── jsconfig.json
│   ├── components.json          # shadcn registry
│   ├── .env                     # REACT_APP_BACKEND_URL (do not change in Emergent preview)
│   ├── public/
│   │   ├── index.html
│   │   ├── order-alert.wav      # Loop audio for GlobalOrderAlert / AdminOrders
│   │   ├── favicon, logo, etc.
│   └── src/
│       ├── App.js               # 147 lines — single router root, all providers
│       ├── App.css, index.css, index.js
│       ├── lib/
│       │   ├── api.js           # axios.create instance with knb_token / knb_admin_token interceptor
│       │   └── utils.js         # cn() helper for tailwind class merging
│       ├── contexts/
│       │   ├── AuthContext.js          # Customer JWT (knb_token) — for /api/customer/*
│       │   ├── StaffAuthContext.js     # 100 lines — Staff JWT (staff_auth_token), dedicated staffAxios
│       │   └── CartContext.js          # Customer cart state (localStorage-persisted)
│       ├── components/
│       │   ├── AdminLayout.jsx         # 173 lines — unified shell, POS Ops first, Online second, perm-gated
│       │   ├── GlobalOrderAlert.jsx    # 140 lines — global notifications (NEW iter 2)
│       │   ├── Layout.jsx              # Customer site layout (Header + Footer + Outlet)
│       │   ├── Header.jsx, Footer.jsx
│       │   ├── FloatingCart.jsx        # Customer site sticky cart
│       │   ├── FloatingWhatsApp.jsx    # Customer "chat with us" button
│       │   ├── ThermalReceipt.jsx      # Online-order receipt template (TO BE UNIFIED — see roadmap #10)
│       │   ├── PeopleAlsoBuy.jsx       # Upsell cards
│       │   ├── ui/                     # shadcn/ui primitives (button, dialog, input, select, badge, separator, scroll-area, ...)
│       │   └── legacy/                 # Components ported verbatim from OLD POS
│       │       ├── ColorPicker.js              # Used by MenuManagement for category/item colors
│       │       ├── ReceiptModal.js             # ★ CANONICAL invoice template (POS receipts)
│       │       └── VoiceAssistantModal.js      # Voice ordering UI (mic + transcript + confirm)
│       ├── pages/                      # Customer-facing site (NEW)
│       │   ├── HomePage.jsx
│       │   ├── MenuPage.jsx, CartPage.jsx, CheckoutPage.jsx
│       │   ├── LoginPage.jsx           # Customer login (NOT staff — that's UnifiedLoginPage)
│       │   ├── RegisterPage.jsx
│       │   ├── ProfilePage.jsx
│       │   ├── OffersPage.jsx, EventsPage.jsx
│       │   ├── ReviewPage.jsx
│       │   ├── OrderSuccessPage.jsx
│       │   ├── BankPaymentPage.jsx, PaymentResultPage.jsx
│       │   ├── TrackingPage.jsx        # Customer order tracking
│       │   └── UnifiedLoginPage.jsx    # ★ 160 lines — staff/admin sign-in (NEW iter 2)
│       ├── pages/admin/                # Online-store admin (NEW)
│       │   ├── AdminDashboard.jsx      # /admin
│       │   ├── AdminOrders.jsx         # /admin/orders — Smart Order Alert + accept/reject/modify
│       │   ├── AdminMenu.jsx           # /admin/menu — online menu (with variations)
│       │   ├── AdminCategories.jsx     # /admin/categories
│       │   ├── AdminOffers.jsx, AdminEvents.jsx
│       │   ├── AdminSettings.jsx       # /admin/settings (online-store-only settings)
│       │   └── AdminLoginPage.jsx      # Legacy login page (now hidden at /admin/legacy-login)
│       └── pages/legacy/               # 11 OLD operational POS pages (PRESERVED VERBATIM — DO NOT REFACTOR)
│           ├── POSPage.js                      # 407 lines — cashier punching screen
│           ├── MenuManagement.js               # 482 lines — categories + items CRUD + DnD + outsourced UI
│           ├── InventoryPage.js                # Stock management with low-stock alerts
│           ├── VendorsPage.js                  # Vendor master + transactions + payments
│           ├── ExpensesPage.js                 # Daily expenses
│           ├── RefundsPage.js                  # Refund processing
│           ├── OldOrdersPage.js                # Order history with date range filter
│           ├── ReportsPage.js                  # X / Z reports + export
│           ├── SettingsPage.js                 # 1,347 lines — comprehensive operational settings
│           ├── DashboardPage.js                # Classic operational dashboard
│           └── StaffLoginPage.js               # OLD staff login (now hidden; redirects via /admin/staff-login)
│       └── hooks/
│           └── use-toast.js
│
├── whatsapp-service/            # Node WhatsApp Web bridge (DO NOT DELETE)
│   ├── index.js                 # Express server using whatsapp-web.js
│   ├── package.json
│   └── package-lock.json
│
├── windows-setup/               # On-premise Windows install (DO NOT DELETE)
│   ├── 1_INSTALL.bat            # Installs Python + Node + Mongo deps
│   ├── 2_START_RestoPOS.vbs     # Silent launcher: Mongo + uvicorn + CRA + cloudflared
│   ├── STOP_RESTOPOS.bat
│   ├── cloudflared.exe          # Cloudflare tunnel binary (Windows)
│   └── README.txt
│
├── memory/                      # Cross-iteration memory
│   ├── PRD.md                   # Cumulative product log (updated on every finish)
│   └── test_credentials.md      # Seeded by backend on every startup
│
├── HANDOVER/                    # ← THIS PACKAGE
│   ├── 00_README.md
│   ├── 01_PROJECT_SUMMARY.md
│   ├── 02_IMPLEMENTATION_STATUS.md
│   ├── 03_BUSINESS_CRITICAL_RULES.md
│   ├── 04_ROADMAP.md
│   ├── 05_AI_CONTINUATION_INSTRUCTIONS.md
│   ├── 06_TECHNICAL_SETUP.md
│   ├── 07_FILE_MAP.md
│   ├── 08_LOGIN_TEST_INFO.md
│   └── 09_SAFE_CONTINUATION_CHECKLIST.md
│
└── test_reports/                # Testing agent outputs
    ├── iteration_1.json         # Iter 1 merge — 37/37 backend + 13/13 frontend
    ├── iteration_2.json         # Iter 2 production-readiness — 45/45 backend + 12/13 frontend
    └── iteration_3.json         # Iter 2 redirect-bug retest — 100% pass
```

## By concern

### Auth files (4)
- `backend/server.py` — JWT helpers + `/auth/*` endpoints + `/customer/*` endpoints (lines ~30-65 helpers, ~244-310 staff auth, ~355-410 customer auth)
- `frontend/src/contexts/AuthContext.js` — customer auth context
- `frontend/src/contexts/StaffAuthContext.js` — staff auth context (with dedicated `staffAxios`)
- `frontend/src/pages/UnifiedLoginPage.jsx` — single sign-in page

### Notification logic (3)
- `frontend/src/components/GlobalOrderAlert.jsx` — global polling + pill + audio
- `frontend/src/pages/admin/AdminOrders.jsx` — page-local alert + audio (works with GlobalOrderAlert; auto-mutes when AdminOrders is visible)
- `frontend/public/order-alert.wav` — the loop audio asset

### POS modules (4 frontend + 1 backend)
- `frontend/src/pages/legacy/POSPage.js` — order punching
- `frontend/src/pages/legacy/MenuManagement.js` — menu CRUD with outsourced UI
- `frontend/src/pages/legacy/InventoryPage.js` — stock management
- `frontend/src/components/legacy/ReceiptModal.js` — receipt printing
- `backend/server.py` — `/orders`, `/menu-items`, `/categories`, `/refunds`, `/reports/*` endpoints

### Vendor logic (2 frontend + 1 backend)
- `frontend/src/pages/legacy/VendorsPage.js` — vendor master + transactions + payments UI
- `frontend/src/pages/legacy/MenuManagement.js` — outsourced product checkbox + vendor select + cost input (in Item Dialog)
- `backend/server.py` — `/vendors/*` endpoints + outsourced hooks in `create_order` / `create_refund` + `/sales-summary`

### Invoice logic (2 — to be unified)
- `frontend/src/components/legacy/ReceiptModal.js` — ★ canonical (used by POS)
- `frontend/src/components/ThermalReceipt.jsx` — online order receipt (TO BE REPLACED)

### Offline / sync logic
- `whatsapp-service/index.js` — Node WhatsApp Web bridge
- `windows-setup/*.bat`, `*.vbs`, `cloudflared.exe` — on-premise launcher
- `backend/server.py` — `/api/tunnel/*`, `/api/whatsapp/*` endpoints
- `frontend/src/pages/legacy/SettingsPage.js` — UI for tunnel + WhatsApp + scheduling

### Permissions
- `backend/server.py` — `ALL_PERMISSIONS` const (line 65), `ADMIN_PERMISSIONS = ALL_PERMISSIONS.copy()` (line 73), `seed_admin()` (line 1852) syncs admin's perms on every startup
- `frontend/src/components/AdminLayout.jsx` — `OPS_NAV` and `ONLINE_NAV` arrays with `perm` field; `filterByPerm()` function
- `frontend/src/App.js` — `<Op perm="...">` wrapper using `<StaffGate>`

### Settings
- `backend/server.py` — `/settings` endpoints + `DEFAULT_SETTINGS` const
- `frontend/src/pages/legacy/SettingsPage.js` — comprehensive operational settings UI
- `frontend/src/pages/admin/AdminSettings.jsx` — online-store-only settings UI
- MongoDB: `settings` collection (single doc, key="global") + `online_settings` collection
