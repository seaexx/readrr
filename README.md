# Readrr

A book-swapping social app built with React Native, Expo, and Supabase. Discover books, connect with readers nearby, and swap books in safe public places.

---

## Features

### Social Feed
- Dual-tab feed — social posts (what people are reading) and swap listings
- Like and comment on posts
- Pull-to-refresh and infinite scroll

### Book Swaps
- List a book for swap with condition, genre, and swap type (trade / borrow / gift)
- Scan a book's barcode to auto-fill details via Google Books API
- Request a swap with an optional message
- Accept or decline incoming requests from your Inbox
- Real-time chat to coordinate the exchange
- Dual-confirmation completion flow — both parties confirm before the swap closes

### Meetup Coordination
- Suggest a safe public meeting place directly in the chat
- Category chips — Coffee Shop, Library, Bookshop, Bar, Book Club, Community Space
- Finds real nearby venues using the Overpass (OpenStreetMap) API based on your location
- Mutual confirmation — the other party can accept or counter-suggest
- Agreed meetup stays pinned above the chat for both users

### Search
- Search posts by book title or author

### Profiles
- Star ratings after each completed swap (1–5 stars with optional comment)
- Average rating displayed on profiles
- Post and listing management (delete from profile)

### Safety & Moderation
- Block a user — mutual, hides posts, prevents swaps and messages
- Report a user or post with reason categories (spam, harassment, inappropriate, other) + optional details
- Three-dot menu on profiles and posts

### Push Notifications
- Swap accepted, new chat message, meetup proposed and confirmed

### In-App Notifications
- Notification centre screen with read/unread state and mark-all-read

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Styling | NativeWind (Tailwind CSS) |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| State | Zustand |
| Navigation | React Navigation v7 |
| Book data | Google Books API + Open Library API |
| Maps / Places | Overpass API (OpenStreetMap) |
| Push notifications | Expo Notifications |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo`)
- A Supabase project

### Setup

```bash
# Clone the repo
git clone https://github.com/6odfrey/readrr.git
cd readrr

# Install dependencies
npm install

# Add your environment variables
# Create a .env file or set these in your Expo config:
# EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Run migrations in your Supabase SQL editor (in order):
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/002_avatars_storage.sql
# supabase/migrations/003_remove_auto_profile.sql
# supabase/migrations/004_users_insert_policy.sql
# supabase/migrations/005_post_expansion.sql
# supabase/migrations/005_swaps_schema.sql
# supabase/migrations/006_follows_schema.sql
# supabase/migrations/007_ratings_schema.sql
# supabase/migrations/008_meetup_location.sql
# supabase/migrations/009_total_swaps_trigger.sql
# supabase/migrations/010_notifications_table.sql
# supabase/migrations/011_blocks_reports.sql

# Start the app
npm start
```

### Running on a device
```bash
npm run ios      # iOS simulator
npm run android  # Android emulator
```

Push notifications require a real device (not a simulator).

---

## Project Structure

```
src/
├── components/       # Shared UI (Avatar, BookCover, PostCard, BarcodeScanner, MeetupModal, RatingModal, etc.)
├── config/           # Supabase client
├── models/           # TypeScript interfaces (User, Post, Swap, Message)
├── navigation/       # React Navigation setup (bottom tabs + stack)
├── screens/
│   ├── auth/         # Sign in, sign up, welcome
│   ├── main/         # Feed, search, inbox, chat, book detail, notifications, post creation
│   ├── onboarding/   # Profile setup, first post
│   └── profile/      # Own profile, other user profile, edit
├── services/         # Supabase service functions (posts, swaps, messages, ratings, follows, notifications, books, storage)
├── store/            # Zustand auth store
└── utils/            # Image compression, validation
supabase/
└── migrations/       # SQL migration files (001–010)
```

---

## Roadmap

- [ ] Nearby books feed (location-based)
