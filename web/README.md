# Readrr — legal pages

Static Terms of Service and Privacy Policy for Readrr. The in-app links
(SignUp + Profile) point to `https://readrr.app/terms` and `https://readrr.app/privacy`.

```
web/
├── terms/index.html     → served at /terms
└── privacy/index.html   → served at /privacy
```

The folder-per-page layout gives clean URLs (`/terms`, `/privacy`) on any static host.

## Before publishing — replace these placeholders (in both files)
- `[LEGAL ENTITY NAME]` — the person/company that operates Readrr
- `[CONTACT EMAIL]` — a real support/privacy contact
- `[GOVERNING LAW / JURISDICTION]` — e.g. "England and Wales"
- `[13]` — minimum age (13 is typical; App Store age rating should match)
- "Last updated" date — set to your actual publish date

> These are good-faith drafts, **not legal advice** — have someone review them before you publish,
> and keep the Privacy Policy in sync with your App Store Connect **App Privacy** answers.

## Hosting options
Deploy the `web/` folder to whatever serves `readrr.app`. Any of these work with the folder layout:
- **Cloudflare Pages / Netlify / Vercel** — point at this folder, done.
- **GitHub Pages** — `/terms/` and `/privacy/` resolve to the `index.html` files.

## App Store Connect
Use `https://readrr.app/privacy` as the **Privacy Policy URL**, and fill the **App Privacy**
questionnaire to match this policy (account data, approximate location, user content, push token —
none sold; shared only with Supabase + Expo as processors).
