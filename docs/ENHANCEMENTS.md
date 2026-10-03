# Enhancements Tracker

Tracks upcoming features and improvements. Each item includes status, priority, technical notes, and open questions.

**Status values:** Backlog · In Progress · Done  
**Priority values:** P1 (highest) · P2 · P3

---

## 1 — Notification Permission Banner Stacking

**Status:** Backlog | **Priority:** P2

The allow-notifications banner currently renders on top of the rest timer bar and overlaps it. It should stack *above* the rest timer in the visual hierarchy so both are fully visible simultaneously.

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

## 3 — Rest Timer Preferences (On/Off + Notification Toggle)

**Status:** Backlog | **Priority:** P2

Users should be able to turn the rest timer itself on or off, and separately toggle rest timer push notifications. Both settings are surfaced in Preferences and asked during onboarding. The notification toggle is **PWA-only**.

### Desired Flow (Onboarding)
- After sign-up, ask: "Would you like to use the rest timer between sets?" → sets `preferences.restTimerEnabled`
- If yes and running in standalone PWA, follow up: "Get notified when your rest ends, even if you leave the app?" → sets `preferences.restTimerNotifications`

### Technical Notes
- Add `preferences.restTimerEnabled: boolean` to `UserData` Firestore schema (default `true`)
- Add `preferences.restTimerNotifications: boolean` to `UserData` Firestore schema (default `true`)
- Add both toggles in `src/routes/preferences/+page.svelte`
- The notifications toggle is rendered only when `display-mode: standalone`
- When `restTimerEnabled` is `false`, suppress the timer entirely — no bar, no push scheduling
- When `restTimerEnabled` is `true` but `restTimerNotifications` is `false`, run the timer UI but skip push scheduling in `RestTimerBar.svelte` / `src/lib/push.ts`
- The notifications toggle controls whether a push is *scheduled* — not the OS-level permission (that is handled during PWA onboarding in Enhancement #2)

---

## 4 — Feedback Button & Page

**Status:** Backlog | **Priority:** P3

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
