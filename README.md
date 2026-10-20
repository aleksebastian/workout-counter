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

| Command          | What it does                                                         |
| ---------------- | -------------------------------------------------------------------- |
| `pnpm dev`       | Dev server on port 5173                                              |
| `pnpm check`     | Type-check with svelte-check                                         |
| `pnpm lint`      | Prettier check and ESLint                                            |
| `pnpm test:unit` | Vitest unit tests                                                    |
| `pnpm test:e2e`  | Playwright against a production build, inside the Firebase emulators |

### End-to-end tests

`pnpm test:e2e` (also run by `pnpm test`) builds the app and runs Playwright against the Firebase Auth and Firestore emulators, so it never touches production. Each test starts from a freshly seeded database. It needs, once:

```bash
brew install openjdk@21
```

```bash
pnpm exec playwright install chromium
```

Put `/opt/homebrew/opt/openjdk@21/bin` on your `PATH` so the emulators find Java. CI runs the same suite on every pull request.

### Firestore rules

Rules live in `firestore.rules`. The Firebase CLI isn't a project dependency, so deploy them with `npx` (run `npx -y firebase-tools login` once first):

```bash
npx -y firebase-tools deploy --only firestore:rules
```

`pnpm dlx firebase-tools` doesn't work here: pnpm stops to ask about the CLI's build scripts and exits without running it.

## Releasing

Bump `version` in `package.json` and add a matching user-facing entry to `src/lib/changelog.ts`. A unit test checks that the two agree. When the bump lands on `main`, the Release workflow publishes a GitHub release.

## License

[MIT](https://choosealicense.com/licenses/mit/)
