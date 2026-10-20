# Enhancements Tracker

Tracks upcoming features and improvements. Each item includes status, priority, technical notes, and open questions.

**Status values:** Backlog · In Progress · Done  
**Priority values:** P1 (highest) · P2 · P3

---

## 1 — Notification Permission Banner Stacking

**Status:** Done | **Priority:** P2

> Done with the active-session work: banners now sit above whatever holds the slot over the bottom nav (rest countdown, rest-timer offer, or workout-in-progress bar) — see `bottomSlot` in `src/lib/logic/bottomSlot.svelte.ts`.

The allow-notifications banner currently renders on top of the rest timer bar and overlaps it. It should stack _above_ the rest timer in the visual hierarchy so both are fully visible simultaneously.

### Technical Notes

- Likely a z-index / stacking-order issue between the banner and `RestTimerBar.svelte`
- Fix: ensure the banner is positioned above the rest timer in DOM order or on the z-axis
- May require adjusting layout flow in `+layout.svelte` so the banner pushes the rest timer down rather than overlapping it

---

## 2 — Guided PWA Onboarding (iOS / Android)

**Status:** Backlog | **Priority:** P2

Before a user signs up, the app should detect whether they are running in a browser vs. the installed PWA and encourage installation for the best experience. Once installed and signed in, onboarding should ask the user if they want to enable push notifications. Notification permission and the notification preference toggle are **PWA-only** — they are hidden entirely when the app is running in a browser tab.

### Desired Flow

1. User opens the app in a browser (not installed)
2. A prompt/screen encourages them to install the PWA before signing up
3. User installs, reopens the app in standalone mode
4. After sign-up, onboarding asks: "Would you like to use the rest timer between sets?"
5. If yes and in standalone PWA, follow up: "Get notified when your rest ends, even if you leave the app?"
6. Allow / Decline → subscribe or skip silently (both settings adjustable later in Preferences)

### Technical Notes

- **iOS/Safari**: no `beforeinstallprompt` event — must instruct the user via Share menu → "Add to Home Screen"
- **Android/Chrome**: intercept `beforeinstallprompt` for a native install prompt
- Standalone mode detection: `window.matchMedia('(display-mode: standalone)').matches` (also check `navigator.standalone` for iOS)
- Device detection via `navigator.userAgent` to show platform-specific install instructions
- Onboarding notification step only shown once — persist a `pwaOnboardingSeen` flag to `localStorage`
- Gate all notification UI (onboarding step, Preferences toggle) behind the standalone mode check
- On iOS, `Notification.requestPermission()` is only available in standalone mode — calling it in Safari will fail; the standalone gate prevents this

---

## 3 — Rest Timer Notification Toggle

**Status:** Backlog | **Priority:** P2

> Narrowed 2026-10-19: the rest timer's own on/off already exists — the "Global rest timer" toggle in Preferences (`preferences.timerEnabled`, default off), with routines' own timers taking precedence. What's left is a separate switch for rest-end _notifications_.

Users should be able to keep the rest timer but turn off rest-end push notifications. The toggle is **PWA-only**, and offered during onboarding (Enhancement #2).

### Technical Notes

- Add `preferences.restTimerNotifications: boolean` to the `Preferences` type (default `true`), with a default in `DEFAULT_PREFERENCES` (`src/lib/constants.ts`)
- Add the toggle to the Notifications section of `src/routes/preferences/+page.svelte`, shown only in standalone mode (where `pwa.notifStatus` isn't `needs-install`/`unsupported`)
- When it's `false`, run the timer UI but don't schedule a push: gate `push.start` in `src/lib/logic/restTimer.svelte.ts` (the `canNotify` check in its `createRestPush` api is the natural place)
- The toggle controls whether a push is _scheduled_ — not the OS-level permission (that is handled during PWA onboarding in Enhancement #2)

---

## 4 — Feedback Button & Page

**Status:** Done | **Priority:** P3

> Shipped as **Report a bug** in v0.12.0: Account → Report a bug files a GitHub issue with device diagnostics and a hashed account ref (`src/lib/components/BugReportSheet.svelte`, `src/routes/api/bug-report/+server.ts`). It took a different shape from the plan below — GitHub issues instead of a `feedback` collection and admin dashboard, and no photo upload yet.

Add a "Feedback" option in the avatar/profile menu. Tapping it opens a dedicated page where users can submit a message and optionally attach a photo (bug reports, feature requests, general feedback).

### Technical Notes

- New Firestore collection: `feedback/{id}` with fields `uid`, `message`, `photoURL?`, `timestamp`, `status`
- Photo upload via Firebase Storage
- New route: `src/routes/feedback/+page.svelte`
- Admin dashboard needed to review submissions — see Open Questions

### Open Questions

- [ ] Should the admin dashboard live inside this app (behind an admin role) or as a separate standalone app?
- [ ] Who are the designated reviewers / dashboard owners?

---

## 5 — Coach vs. Client Mode

**Status:** Backlog | **Priority:** P1

Users sign up as either a **Coach** or a **Client**. Coaches get a full dashboard to create exercises, routines, and programs and assign them to clients. Clients receive a simplified, read-only view showing only coach-assigned content.

### User Flow

1. A user registers and selects their role (Coach or Client)
2. A coach generates a shareable invite link
3. The client signs up via that link and is associated with the coach
4. The coach assigns exercises, routines, and programs to the client
5. The client sees a simplified app view — assigned content only, non-editable

### Technical Notes

- Add `role: 'coach' | 'client'` field to `UserData`
- Coaches need a `clients: uid[]` relationship, or a separate `coach-clients` collection
- Assigned content should be stored separately from the client's own data (or tagged `assignedBy: coachUid`)
- Invite link flow: coach generates a token → client signs up with token → relationship is established in Firestore
- Client's assigned exercises/routines/programs are read-only in the UI
- Coach dashboard needs full CRUD for exercises, routines, and programs on behalf of clients

### Open Questions

- [ ] Can a user be both a coach and a self-training client simultaneously?
- [ ] Can a client have multiple coaches?
- [ ] Do coaches have visibility into their clients' workout history and progress?
- [ ] Is there a billing/subscription model for coach accounts?

---

## 6 — JSON Import / Export (Exercises, Routines & Programs)

**Status:** Backlog | **Priority:** P3

Allow users to import and export exercises, routines, and programs via JSON. Import supports full fidelity — rest times, notes, rep ranges, and all structured fields. Export is scoped to data portability and backup.

### Duplicate Handling

On import, duplicates are surfaced to the user (matched by name, case-insensitive). The user decides per conflict: skip, keep both, or replace. No overwriting without explicit user consent.

### Technical Notes

- Scope: all three types — `Workout` (exercise), `Routine`, and `Program` with all existing fields
- The accepted JSON schema must be documented and versioned alongside the app
- File upload via `<input type="file">` on a dedicated import page
- Server-side validation via a `/api/import` SvelteKit server route before writing to Firestore
- Export: serialize from Firestore → JSON file download, same schema as import (round-trip safe)

### Note on Social Sharing

In-app social sharing of routines (via shareable links or short codes) is a **separate future feature** and is not solved by JSON export. That feature would use a `shared-routines/{id}` Firebase collection with deep links, and intersects with the Coach/Client mode roadmap.

### Open Questions

- [ ] Should export be scoped per-type (e.g. export only routines) or always a full data dump?

---

## 7 — CI: Checks and Tests on Every PR

**Status:** Done | **Priority:** P2

> Done: `.github/workflows/ci.yml` runs two jobs on every pull request and on pushes to `main` — `checks` (`pnpm check`, `pnpm lint`, `pnpm test:unit`) and `e2e` (Playwright against the Firebase emulators, uploading `test-results/` on failure). Making them required status checks on `main` is a repository setting, still to do.

The only workflow today is `.github/workflows/release.yml`. Nothing runs type checks, lint or tests on pull requests, so a broken change is only caught if someone runs them locally.

### Technical Notes

- New `.github/workflows/ci.yml` on `pull_request` and pushes to `main`: checkout, pnpm (version from `packageManager`), Node 24 (from `.node-version`), `pnpm install --frozen-lockfile`
- Steps: `pnpm check`, `pnpm lint`, `pnpm test:unit`
- `pnpm check` and the build need the `$env/static/*` variables to exist: provide placeholders in CI (the values aren't used by type checking or unit tests)
- Make the job a required status check on `main` once it's green

---

## 8 — End-to-End Test Coverage

**Status:** Done | **Priority:** P3

> Done in v0.15.0: `pnpm test:e2e` runs Playwright against the Firebase Auth and Firestore emulators, signing in through a test-only hook (`src/lib/e2e.ts`, built only when `PUBLIC_FIREBASE_EMULATORS=true`) and starting each test from a freshly seeded database (`tests/fixtures.ts`). It covers the login redirect, logging a set and skipping the rest, finishing early and discarding, editing then deleting a set, and sign-out clearing the cache — and found a real bug on its first run (editing a set dropped it from the current workout). Programs, the Discover catalog and Preferences aren't covered yet.

`tests/test.ts` has one Playwright test (the login page renders). Everything past sign-in — logging sets, the rest timer, running and finishing or discarding a workout — is only exercised by hand, most recently in the iOS Simulator.

### Technical Notes

- Signed-in flows need auth without Google's popup: run against the Firebase Auth and Firestore emulators with a seeded test user, and mint the `__session` cookie through the emulator
- First flows worth covering: start a routine → log sets → rest bar appears → skip rest; finish early → discard; edit then delete a set; sign out
- Runs in CI: the `e2e` job in `.github/workflows/ci.yml` (Enhancement #7)

### Open Questions

- [x] Emulators in CI, or a dedicated Firebase test project? — emulators (Java 21 via `actions/setup-java`)

---

## 9 — Clear the Offline Data Cache on Sign-Out

**Status:** Done | **Priority:** P2

> Done in v0.15.0: sign-out clears the Firestore cache and the account's own localStorage keys (`wipeLocalData` in `src/lib/logic/auth.ts`, shared with account deletion), then reloads to `/login`. The account screen waits up to 5s for unsynced changes and asks before discarding them; with no signed-in user (an expired session) it clears without waiting. Best effort while another tab still has the database open.

Firestore's IndexedDB persistence keeps a full copy of the signed-in user's data on the device. Account deletion already clears it (`deleteAccount` in `src/lib/logic/auth.ts`), but a plain sign-out doesn't — on a shared device the next person's browser still holds the previous user's workouts and history.

### Technical Notes

- In `handleSignOut`: after `signOut(auth)`, `terminate(db)` then `clearIndexedDbPersistence(db)` — the same steps `deleteAccount` uses
- Terminating leaves the SDK unusable in that page, so end with a full page load to `/login` (`window.location.replace`) instead of `goto`
- Also clear the app's own `localStorage` keys that belong to the account (rest timer state); keep device-level ones (theme, What's new seen)
