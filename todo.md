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

### P0 — gates putting it in a tester's hands (iOS-first launch)
- [x] **Apple Developer account** — have it (paid). Google Play deferred (iOS first).
- [~] **iOS EAS build** — pipeline works (produced an `.ipa`). It crashed on device because the
      cloud build had no env vars (`.env.local` isn't uploaded); fixed by putting
      `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `eas.json` `env` (all
      profiles). **Rebuild → `eas submit` → TestFlight.** Google Books key left out of git — set it
      as an EAS env var if you want the Google cover fallback in prod (Open Library is primary).
- [x] **Terms + Privacy drafted** — `web/terms/` + `web/privacy/` (real copy for the actual app).
      Still to do: replace the `[BRACKETED]` placeholders (entity, contact email, jurisdiction, age),
      get a legal review, and host so readrr.app/terms + /privacy resolve. See `web/README.md`.
- [ ] **Test push + barcode scan on a REAL device** — once the env-fixed build is installed.

### P1 — correctness / safety before real users
- [x] **Safe swap-post delete + duplicate-post prevention.** DONE — deleting a swap listing that
      has requests/chat now warns and offers "Hide instead" (`getPostSwapImpact` + ProfileScreen
      delete flow); duplicate active listings are blocked by a partial unique index (migration 019,
      applied to live DB) with a friendly "Already listed" message in SwapPostScreen.
- [x] **Follows: removed for now (launch lean).** Deleted the unused `followsService` (dead client
      code, zero UI). The DB `follows` table + RPCs (migration 007) are left in place, so re-adding
      social later is just UI wiring — no migration to recreate. (Deferred: social stickiness.)
- [x] **Book-lookup AbortError leaks to the UI (device QA 2026-09-22).** FIXED — booksService logs the timeout/miss at a lower level (no dev LogBox popup); fallback + silent caller handling unchanged. Tapping a book whose Open
      Library lookup exceeds the 8s timeout throws `Open Library lookup failed: [AbortError: Aborted]`
      and surfaces an error. Aborted/timed-out lookups should fail quietly and fall back to the
      stored post data — never alert. (`booksService.fetchWithTimeout`; caller on the book-open path.)
- [x] **Random logout (device QA 2026-09-22).** FIXED — added the Supabase React Native AppState
      auto-refresh hook in `src/config/supabase.ts`. Without it RN throttles the background token
      refresh and the session silently expires, surfacing as a logout when the app is reopened.
      (If it recurs, next suspects: same account signed in on two devices/simulators, or a manual
      sign-out path.)

### Device QA — round 2 (2026-09-23, from TestFlight/device testing)
- [x] **Book lookup is now Google-only** — rewrote `booksService` (Open Library removed) and added
      `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY` to every `eas.json` profile. Root cause of "scan always says
      book not found": the production build had no Google key, so it fell back to Open Library only,
      which was failing. ⚠️ Restrict the key in Google Cloud (Books API + iOS bundle id).
- [x] **Scanner dead-end fixed** — a scan miss now offers "Search by title" instead of trapping you.
- [x] **Manual entry removed** from BookFinder (scan or search only).
- [x] **Save → "Saved"** — Save button reflects shelf state (`shelfService.isOnShelf`; PostDetail + BookDetail).
- [x] **Social post delete** — owner now sees a trash button on the post (PostDetail).
- [ ] **Rebuild + resubmit to TestFlight** so these reach the device (verify in the simulator first).
- [ ] `app.json` android `permissions` are duplicated — harmless for iOS; dedupe before an Android build.

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

## 🔒 Secrets — how keys are handled (do not regress)
All API keys live in **`.env.local`** (local dev, gitignored) and **EAS environment variables**
(builds) — **never in the repo**. `eas.json` has no keys, and `.githooks/pre-commit` blocks any
commit whose staged changes look like a key (enabled via `git config core.hooksPath .githooks`;
re-run that once on a fresh clone).
- ✅ Leaked keys scrubbed from **all git history** (`git filter-repo`) and force-pushed to origin.
- ✅ `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` set as EAS env vars (all environments).
- [ ] **Rotate the Google Books key** (it was exposed on GitHub). In Google Cloud: regenerate it,
      restrict it (Books API only + daily quota), delete the old one. Then register the new key:
      `eas env:create --name EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY --value <NEW_KEY> --environment production --environment preview --environment development --visibility sensitive --force`
      and update your local `.env.local`. Book lookup (Google-only) needs this in the build.

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
