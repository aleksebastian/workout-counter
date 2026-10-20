# SetCount

A workout tracker built as an installable PWA. Log sets with a rest timer between them, organise exercises into routines and weekly programs, run a workout from start to finish, and look back over your history.

![Site mockup](https://raw.githubusercontent.com/aleksebastian/workout-counter/main/mockup.png)

## Features

- **Library**: your exercises, routines and programs, plus a Discover catalog to add from
- **Train**: run a routine or a program day with targets, notes and progress, then resume or discard it
- **Rest timer**: per-routine or global, with a push notification when the rest ends (installed PWA only)
- **History**: every set, editable, and a log of finished workouts
- Works offline: Firestore persistence and a service worker keep the app usable without a connection

## Stack

SvelteKit (Svelte 5) on Vercel · Firebase Auth and Firestore · Tailwind CSS 4 with daisyUI · Web Push scheduled through Upstash QStash

## Development

Requires Node 24 and pnpm 12. Both are pinned in `package.json`.

```bash
pnpm install
pnpm dev
```

Create a `.env` file with:

| Variable                                                        | Used for                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| `FB_PROJECT_ID`, `FB_CLIENT_EMAIL`, `FB_PRIVATE_KEY`            | Firebase Admin: session cookies and server-side reads      |
| `PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push                                                   |
| `QSTASH_URL`, `QSTASH_TOKEN`                                    | Scheduling rest-end pushes in production                   |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`         | Verifying QStash callbacks                                 |
| `GITHUB_TOKEN` (optional)                                       | Filing in-app bug reports; without it, dev logs the report |

In dev, rest-end pushes fire from the dev server process instead of QStash.

### Scripts

| Command                 | What it does                          |
| ----------------------- | ------------------------------------- |
| `pnpm dev`              | Dev server on port 5173               |
| `pnpm check`            | Type-check with svelte-check          |
| `pnpm lint`             | Prettier check and ESLint             |
| `pnpm test:unit`        | Vitest unit tests                     |
| `pnpm test:integration` | Playwright against a production build |

### Firestore rules

Rules live in `firestore.rules`. Deploy them with `firebase deploy --only firestore:rules`.

## Releasing

Bump `version` in `package.json` and add a matching user-facing entry to `src/lib/changelog.ts`. A unit test checks that the two agree. When the bump lands on `main`, the Release workflow publishes a GitHub release.

## License

[MIT](https://choosealicense.com/licenses/mit/)
