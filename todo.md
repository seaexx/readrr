# Readrr — TODO & working state

**Read this first.** This is the operational task list for Readrr. It records what's
done, what's next, and *why*, so we can pause cleanly and pick back up without
re-deriving context. Update it as tasks move.

- **Deep feature audit / status:** see [`docs/PROGRESS.md`](docs/PROGRESS.md) (the "what's built" reference).
- **This file:** the actionable "what to do next" list.
- **Last updated:** 2026-09-21

---

## Snapshot — where we are

- Feature build-out is ~90% (auth, feed, swaps, chat, meetup, moderation, shelf all real).
- The gap to "test with users" is packaging + DB hygiene + a few correctness/legal items.
- Today: added EAS/build config, aligned SDK 54 deps, ran `eas init` (push now
  provisioned), restyled the app with a serif type system (blue/white kept), wrote a
  DB migration verifier, and set up this file.

---

## Immediate next steps (the path to first testers)

1. **Finish Supabase CLI link + history sync** (see "Database access" below) so we can
   push migrations instead of hand-applying. One-time setup, needs your login + DB password.
2. **Run [`supabase/verify_migrations.sql`](supabase/verify_migrations.sql)** against the
   live DB — every row must say PASS. FAILs = that migration was never applied by hand.
3. **First build:** `eas build --profile preview` (Android APK / iOS internal) to get it on
   a device, then `--profile production` for TestFlight / Play once store accounts exist.
4. **Host Terms + Privacy** at readrr.app/terms and /privacy (links are live in-app; pages
   must resolve or store review fails). Copy exists in `docs/LEGAL.md`. (Task chip queued.)

---

## Launch blockers (must-do before public testing)

- [ ] **Store accounts:** Apple Developer ($99/yr) + Google Play ($25 once).
- [ ] **First EAS build succeeds** on both platforms (bundle id `app.readrr`, already set).
- [ ] **Legal pages hosted** (see above).
- [ ] **DB verified** (all migrations applied — verifier all PASS).
- [ ] **Push tested on a real device** (simulator can't receive push; projectId now set so it should work).
- [ ] **Barcode scan tested on a real device** (no camera in simulator).

## Optional build hygiene
- [ ] `app.json` android permissions include `RECORD_AUDIO` (added by the expo-camera
      plugin — barcode scanning doesn't need the mic). Consider setting
      `recordAudioAndroid: false` on the expo-camera plugin + dropping it from the
      permissions list so Play Console doesn't ask about microphone use. (Left as-is for
      now since app.json was hand-edited — confirm before changing.)

---

## Features to build (post-launch-ready, ranked)

1. **Wishlist match alerts** ⭐ (task chip queued) — notify a user when a book on their
   want-to-read shelf is listed near them. *Why:* the app has a strong transactional loop
   but no retention hook; this is the "come back" moment and reuses shelf + nearby RPC +
   push (all already built). Highest impact per effort.
2. **Follows: wire in or remove** (task chip queued) — `followsService` + 2 RPCs exist but
   are used in zero screens. Decide: surface follow/counts on profiles, or delete the dead
   surface. *Why:* it's a "social" app with no social graph in the UI right now.
3. **Duplicate-post prevention + safe swap-post delete** (task chip queued) — see Known issues.

## UI / design (in progress)

- [x] Serif type system (`src/theme/fonts.ts`, Fraunces) loaded app-wide via `App.tsx`.
- [x] Feed restyle: serif titles/tabs, hero covers (real shadow + spine), blue/white kept.
- [x] Serif rolled across: PostCard, BookDetail, PostDetail, Search, Inbox, Notifications,
      Profile, OtherProfile, EditProfile, ProfileSetup, FirstPost, SignIn, SignUp, Shelf,
      Chat, CreatePost, SocialPost, SwapPost, and the Meetup/Rating/Report modals + BookFinder.
- [ ] Small remaining polish: WelcomeScreen (logo-only, no heading — decide if it needs a
      serif tagline), profile stat numbers still sans (intentional — revisit), Chat top-bar
      username still sans.
- [ ] **Micro-interactions:** skeleton loaders instead of spinners; a satisfying
      like / "swap confirmed" moment. (Needs an animation lib — not installed.)
- [ ] **Dark mode** — readers read at night; `userInterfaceStyle` is light-only today.
      Color tokens are centralized in `src/theme/fonts.ts` (`colors`) to make this easier.
- [ ] **Accessibility labels** — currently zero across the app.

---

## Known issues / correctness (from the audit)

- [ ] **Deleting a swap post cascades away its swaps + entire chat history**, silently. Add a
      warning / soft-delete. (`deletePost` in `src/services/postsService.ts`, delete flow in
      `ProfileScreen`.) (Task chip queued.)
- [ ] **No duplicate-post prevention** — same book can be listed repeatedly. (Task chip queued.)
- [ ] Chat send-failure on a blocked user shows a generic alert, not "you blocked this user."

---

## Database access — Supabase CLI (preferred over the MCP connector)

CLI is installed (v2.109.1). Repo is **not linked yet** (no `supabase/config.toml`).
Migrations 001–017 were applied **by hand**, so the CLI's remote migration history is
empty — a blind `supabase db push` would try to re-run them all and error on existing
objects. So the one-time setup must *sync history first*.

**One-time setup (you run these — they need your login + DB password, which never touch chat):**
```bash
supabase login                          # browser auth
supabase link --project-ref <ref>       # <ref> = subdomain of EXPO_PUBLIC_SUPABASE_URL in .env.local
supabase migration list                 # see local (001–017) vs remote (empty)
# Mark the already-applied ones as applied WITHOUT re-running them:
supabase migration repair --status applied 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017
supabase migration list                 # confirm all show applied on both sides
```
> Before trusting `repair`, run [`supabase/verify_migrations.sql`](supabase/verify_migrations.sql)
> in the SQL editor. If any migration shows FAIL, it was NOT hand-applied — run that file
> first (or `supabase db push` it after repairing only the truly-applied ones), so we don't
> mark a missing migration as applied.

**Ongoing workflow once linked:** Claude writes a new `supabase/migrations/0NN_*.sql`, then
`supabase db push` applies it to the live DB. No more hand-applying.

---

## How to run

```bash
# Simulator (forces localhost so the odd LAN IP doesn't time out):
REACT_NATIVE_PACKAGER_HOSTNAME=localhost npx expo start --ios
```
- App opens to the login screen (Feed is auth-gated) — sign in to see the restyle.
- Barcode scan + push need a **real device**.

---

## Conventions (so future edits stay consistent)

- **Type:** serif (Fraunces) for titles/headers/book names via `import { fonts } from '<path>/theme/fonts'`
  (`serifRegular/Medium/SemiBold/Bold`). Body text + button labels stay system sans.
- **Brand palette:** blue `#38B6FF` + white. No warm/paper tones (decided against).
- **Migrations:** numbered `0NN_name.sql` in `supabase/migrations/`, applied via CLI (see above).
- **Commits:** end messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Open task chips (spun off, one click to start)
- Build wishlist match alerts
- Draft & host Terms + Privacy pages
- Fix delete-swap chat wipe + duplicate posts
- Wire up or remove Follows
