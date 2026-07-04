# Karachi Naseeb — Customer App (Flutter)

Native customer ordering app (Android now, iOS later) for the Karachi Naseeb
platform. Talks to the existing FastAPI backend (`../backend`) — no separate
API. Customers only (no admin/POS).

## Status

Built so far (**P0**): project foundation + auth vertical slice.

- `lib/core/` — config, secure token storage, Dio client (Bearer interceptor), error type
- `lib/features/auth/` — customer model, repository (`/customer/login|register|me|logout`, FCM token), Riverpod controller, login + register screens
- `lib/features/home/` — post-login landing (menu goes here in P1)
- `lib/app/router.dart` — go_router with auth redirect + splash
- Backend: `POST/DELETE /api/customer/fcm-token` added; auth endpoints already
  return the JWT in the response body.

Roadmap: **P1** menu→cart→checkout→order→tracking · **P2** wallet+diamonds ·
**P3** automated PK payment gateway · **P4** reviews/offers/FAQ · **P5** FCM
push · **P6** Play Store release.

## Prerequisites

- Flutter SDK 3.19+ (`flutter --version`) — **not currently installed on this machine**
- Android Studio / Android SDK + an emulator or device
- The backend running and reachable (see below)

## First-time setup

This folder contains `pubspec.yaml` + `lib/` but not the generated native
shells (`android/`, `ios/`). Generate them once, without overwriting the source:

```bash
cd mobile
flutter create --org com.karachinaseeb --project-name knb_customer .
flutter pub get
```

`flutter create .` fills in `android/`, `ios/`, etc. and leaves existing
`lib/` and `pubspec.yaml` in place.

## Running

Point the app at your backend with `--dart-define`:

```bash
# Android emulator -> host machine's localhost (default is http://10.0.2.2:8000)
flutter run

# Physical device / staging / prod
flutter run --dart-define=API_BASE_URL=https://api.karachinaseeb.com
```

The base URL has `/api` appended automatically (FastAPI's router prefix).

## Backend contract used so far

| Endpoint | Purpose |
|---|---|
| `POST /api/customer/register` | Sign up → returns `{id,email,name,phone,token}` |
| `POST /api/customer/login` | Sign in → returns `{..., token}` |
| `GET  /api/customer/me` | Hydrate profile from a stored token (Bearer) |
| `POST /api/customer/logout` | Server-side cookie clear (app also clears token) |
| `POST /api/customer/fcm-token` | Register device for push (P5) |

Auth is header-based: the JWT is stored in the platform keystore and sent as
`Authorization: Bearer <token>` on every request.

## Still needed from the project owner

- **Firebase** project + `google-services.json` (Android) for FCM push (P5)
- **Google / Facebook** Android OAuth client IDs + app SHA-1 (social sign-in)
- **Google Maps** API key (delivery-location picker in checkout, P1)
- **Payment gateway** merchant account/keys — JazzCash / Easypaisa / PayFast /
  Safepay (P3)
