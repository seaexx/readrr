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
- Search readers by username
- Search books by title or author via Google Books API
- Search posts by book title or author

### Profiles & Social
- Follow / unfollow other readers
- Follower and following counts
- Star ratings after each completed swap (1–5 stars with optional comment)
- Average rating displayed on profiles and search results

### Push Notifications
- Swap accepted, new chat message, meetup proposed and confirmed

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
├── components/       # Shared UI components
├── config/           # Supabase client
├── models/           # TypeScript interfaces
├── navigation/       # React Navigation setup
├── screens/
│   ├── auth/         # Sign in, sign up, welcome
│   ├── main/         # Feed, search, inbox, chat, book detail
│   ├── onboarding/   # Profile setup, first post
│   └── profile/      # Own profile, other user profile, edit
├── services/         # API and Supabase service functions
└── store/            # Zustand auth store
supabase/
└── migrations/       # SQL migration files
```

---

## Roadmap

- [ ] Post deletion and listing management
- [ ] Nearby books feed (location-based)
- [ ] Notification centre screen
- [ ] Report / block user
- [ ] Following-based feed filter
- [ ] Stripe subscription tier
