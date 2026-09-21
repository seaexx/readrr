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
- [ ] **Safe swap-post delete + duplicate-post prevention.** *Deleting a swap post silently
      cascades away its swaps + entire chat history; and the same book can be listed
      repeatedly.* (`deletePost` in `postsService.ts`, `ProfileScreen` delete flow.) (chip)
- [ ] **Follows: wire into UI or remove.** *`followsService` + 2 RPCs exist, used in zero
      screens — a "social" app with no social graph in the UI.* (chip)

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

---

## Database — Supabase CLI (linked ✅)
Linked and migrated. **Ongoing workflow:** Claude writes `supabase/migrations/0NN_*.sql`, then
`supabase db push` applies it to the live DB — no more hand-applying. Re-run
[`supabase/verify_migrations.sql`](supabase/verify_migrations.sql) anytime to confirm object state.

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
