# Readrr — TODO & working state

**Read this first.** Operational task list for Readrr: what's done, what's next, and *why*,
so we can pause cleanly and resume without re-deriving context. Keep it current.

- **Deep feature audit:** [`docs/PROGRESS.md`](docs/PROGRESS.md) (the "what's built" reference).
- **This file:** the prioritized "what to do next" list.
- **Last updated:** 2026-09-22

---

## Snapshot
Feature build-out ~90% (auth, feed, swaps, chat, meetup, moderation, shelf all real). The
remaining gap to "test with users" is packaging + a few correctness/legal items. DB is now
CLI-linked and fully migrated; push is provisioned; the app has an app-wide serif restyle.

---

## ✅ Done (cross-checked 2026-09-22)
- [x] **Core features** built end-to-end (see `docs/PROGRESS.md`).
- [x] **EAS build config** — `eas.json` (dev/preview/production); `app.json` bundle id
      `app.readrr`, camera/location/photo permission strings, `expo-font` plugin.
- [x] **`eas init`** done → `projectId` in `app.json`; **push notifications now provisioned**.
- [x] **Deps aligned** to Expo SDK 54; removed unused `expo-barcode-scanner`.
- [x] **Serif type system** (`src/theme/fonts.ts`, Fraunces) loaded via `App.tsx`, rolled
      across **every** screen + modal, incl. login (SignIn/SignUp) and the Welcome tagline.
      Brand blue/white kept.
- [x] **Supabase CLI linked**; **all 17 migrations applied + history synced** (confirmed via
      `supabase migration list` — local == remote for 001–017). Claude can now run
      `supabase db push` directly.
- [x] **DB verifier** — `supabase/verify_migrations.sql` (belt-and-suspenders object check).
- [x] **Committed** to branch `feat/serif-restyle-launch-prep`.

---

## Priority-ordered remaining work (highest → lowest)

### P0 — gates putting it in a tester's hands
- [ ] **Merge `feat/serif-restyle-launch-prep` → `main`** (or open a PR). *Your call — trivial.*
- [ ] **Store accounts:** Apple Developer ($99/yr) + Google Play ($25 once). *Needed for
      TestFlight / Play Internal (and any iOS install).*
- [ ] **First EAS build:** `eas build --profile preview` (Android APK sideload / iOS internal),
      then `--profile production` for the stores. *This is the actual "get it on a phone" step.*
- [ ] **Host Terms + Privacy** at readrr.app/terms and /privacy. *Links are live in-app; if the
      pages 404, store review fails and testers hit dead links. Copy is in `docs/LEGAL.md`.* (chip)
- [ ] **Test push + barcode scan on a REAL device.** *Simulator can't do either; both are core.*

### P1 — correctness / safety before real users
- [x] **Safe swap-post delete + duplicate-post prevention.** DONE — deleting a swap listing that
      has requests/chat now warns and offers "Hide instead" (`getPostSwapImpact` + ProfileScreen
      delete flow); duplicate active listings are blocked by a partial unique index (migration 019,
      applied to live DB) with a friendly "Already listed" message in SwapPostScreen.
- [ ] **Follows: wire into UI or remove.** *`followsService` + 2 RPCs exist, used in zero
      screens — a "social" app with no social graph in the UI.* (chip)
- [x] **Book-lookup AbortError leaks to the UI (device QA 2026-09-22).** FIXED — booksService logs the timeout/miss at a lower level (no dev LogBox popup); fallback + silent caller handling unchanged. Tapping a book whose Open
      Library lookup exceeds the 8s timeout throws `Open Library lookup failed: [AbortError: Aborted]`
      and surfaces an error. Aborted/timed-out lookups should fail quietly and fall back to the
      stored post data — never alert. (`booksService.fetchWithTimeout`; caller on the book-open path.)
- [x] **Random logout (device QA 2026-09-22).** FIXED — added the Supabase React Native AppState
      auto-refresh hook in `src/config/supabase.ts`. Without it RN throttles the background token
      refresh and the session silently expires, surfacing as a logout when the app is reopened.
      (If it recurs, next suspects: same account signed in on two devices/simulators, or a manual
      sign-out path.)

### P2 — retention (first real feature investment)
- [x] **Wishlist match alerts ⭐ — BUILT (code + migration 018 applied).** When a swap post is
      created, readers who have that book on their want-to-read shelf within 25 mi get a push +
      in-app alert that deep-links to the book (`BookDetail`). Server matching in RPC
      `get_wishlist_match_recipients` (migration 018); fan-out in `src/services/wishlistService.ts`;
      wired into `postsService.createPost`. `users.location` is now persisted from the Feed Swaps
      tab (`updateUserLocation`) so recipients are locatable.
  - [ ] **Still needs real-device testing:** two accounts on real devices (push needs a device),
        both with GPS within 25 mi; account A wishlists a book (Shelf → Want to Read), account B
        posts that book as a swap → A should get the push + in-app alert. Recipients only match
        once they've opened the Feed Swaps tab at least once (to store their location).

### P3 — polish (nice, not blocking)
- [ ] **Dark mode** (readers read at night; `userInterfaceStyle` is light-only; color tokens
      centralized in `src/theme/fonts.ts` to ease this).
- [ ] **Skeleton loaders + micro-interactions** (like / "swap confirmed" moments; needs an anim lib).
- [ ] **Accessibility labels** (currently zero).
- [ ] **Chat send-failure copy** for blocked users (generic alert today).
- [ ] **Optional:** drop `RECORD_AUDIO` from `app.json` android permissions + set
      `recordAudioAndroid: false` on expo-camera (barcode doesn't need the mic; Play asks about it).

#### UI/UX polish — device QA (2026-09-22)
- [x] **Tab switch flashes an empty state.** DONE — per-tab cache (`cacheRef`) shows each tab
      instantly (spinner only on the first load); a background refresh reveals newer top content via
      a tappable "New posts · pull to refresh" pill (`handleShowNew`) instead of yanking the list.
      (`FeedScreen`.)
- [x] **Profile page redesign.** DONE — removed the skeuomorphic wooden shelves + cramped 3-col
      grid for a clean centered hero (avatar, @username, city, bio), a single 3-stat row
      (Swaps / Rating / Books), serif content tabs, a Feed-style 2-column hero-cover grid, and a
      quiet footer (neutral Sign Out; Terms / Privacy / Delete as small links). (`ProfileScreen`.)
- [x] **Social book detail layout.** DONE — replaced the 40/60 horizontal split with a vertical
      layout: a cover-next-to-title header, then full-width description / engagement / comments.
      (`PostDetailScreen`.)
- [x] **Swap book detail cover.** DONE — cover-only swap posts now show a centered 2:3 cover with a
      soft shadow on a light backdrop instead of a full-bleed stretch. (`BookDetailScreen`.)
- [x] **Uniform screen headers.** DONE — added serif "Search" and "Profile" titles matching
      Inbox/Notifications. (`SearchScreen`, `ProfileScreen`.) The Profile redesign (#2) will refine it.

---

## Database — Supabase CLI (linked ✅)
Linked and migrated. **Ongoing workflow:** Claude writes `supabase/migrations/0NN_*.sql`, then
`supabase db push` applies it to the live DB — no more hand-applying. Re-run
[`supabase/verify_migrations.sql`](supabase/verify_migrations.sql) anytime to confirm object state.

> **Migration drift caught + resolved (2026-09-22):** `repair --status applied 001..017` had
> marked 017 (shelf) applied *without running it*, so `shelf_items` never existed (PGRST205 on
> My Shelf). Fixed by reverting 013–018 in history and re-pushing; all 001–018 are now genuinely
> applied. Lesson: never `repair --status applied` a migration you didn't actually run.
- [ ] **uuid portability (P3):** migrations 001/011/012/016 use `uuid_generate_v4()` (uuid-ossp),
      which only resolves when hand-run in the SQL editor — a fresh `supabase db push` (new env / CI)
      would fail on them. 017 was switched to `gen_random_uuid()`; standardize the rest before any
      fresh-DB setup. Not urgent (current DB is fine).

## How to run
```bash
# Simulator (localhost avoids the LAN-IP timeout):
REACT_NATIVE_PACKAGER_HOSTNAME=localhost npx expo start --ios
```
App opens to login (Feed is auth-gated). Push + barcode need a real device.

## Conventions
- **Type:** serif (Fraunces) for titles/headers/book names via `import { fonts } from '<path>/theme/fonts'`;
  body + button labels stay system sans.
- **Palette:** brand blue `#38B6FF` + white. No warm/paper tones (decided against).
- **Migrations:** numbered `0NN_name.sql`, applied via `supabase db push`.
- **Commits:** end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Task chips (one click to spin off)
Wishlist match alerts · Terms + Privacy pages · Delete-cascade + dup-post fixes · Wire/remove Follows
