-- =====================================================
-- Seed: Nearby feed test accounts
-- Run this MANUALLY in Supabase SQL Editor after
-- migration 015. Do NOT add to production migrations.
-- Creates 5 users at increasing distances from
-- Chesterfield centre (53.2350, -1.4219) plus one swap
-- post each. Use to verify the 25-mile radius filter.
--
-- Expected when viewer is in Chesterfield:
--   seed_alice  ~0.3 miles  → visible
--   seed_bob    ~2 miles    → visible
--   seed_carol  ~10 miles   → visible
--   seed_dave   ~21 miles   → visible (just inside)
--   seed_eve    ~39 miles   → hidden (outside 25)
--
-- Password for all seed accounts: Seed123!
-- Cleanup:
--   DELETE FROM public.posts WHERE user_id IN
--     (SELECT id FROM public.users WHERE username LIKE 'seed_%');
--   DELETE FROM public.users WHERE username LIKE 'seed_%';
--   DELETE FROM auth.users WHERE email LIKE 'seed_%@test.local';
-- =====================================================

-- Ensure pgcrypto is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Seed auth.users first (public.users has FK to auth.users)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES
  ((SELECT id FROM auth.instances LIMIT 1), '11111111-1111-4111-a111-111111111111', 'authenticated', 'authenticated', 'seed_alice@test.local', crypt('Seed123!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', '', ''),
  ((SELECT id FROM auth.instances LIMIT 1), '22222222-2222-4222-a222-222222222222', 'authenticated', 'authenticated', 'seed_bob@test.local',   crypt('Seed123!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', '', ''),
  ((SELECT id FROM auth.instances LIMIT 1), '33333333-3333-4333-a333-333333333333', 'authenticated', 'authenticated', 'seed_carol@test.local', crypt('Seed123!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', '', ''),
  ((SELECT id FROM auth.instances LIMIT 1), '44444444-4444-4444-a444-444444444444', 'authenticated', 'authenticated', 'seed_dave@test.local',  crypt('Seed123!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', '', ''),
  ((SELECT id FROM auth.instances LIMIT 1), '55555555-5555-4555-a555-555555555555', 'authenticated', 'authenticated', 'seed_eve@test.local',   crypt('Seed123!', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Now seed public.users (FK satisfied)
INSERT INTO public.users (id, email, username, city, bio, location, avg_rating, total_swaps)
VALUES
  ('11111111-1111-4111-a111-111111111111', 'seed_alice@test.local', 'seed_alice', 'Chesterfield', 'Chesterfield centre — should be nearest', ST_SetSRID(ST_MakePoint(-1.4219, 53.2350), 4326)::geography, 4.8, 12),
  ('22222222-2222-4222-a222-222222222222', 'seed_bob@test.local',   'seed_bob',   'Hasland',      '2 miles out',                   ST_SetSRID(ST_MakePoint(-1.4800, 53.2420), 4326)::geography, 4.5, 8),
  ('33333333-3333-4333-a333-333333333333', 'seed_carol@test.local', 'seed_carol', 'Sheffield',    'About 10 miles north',          ST_SetSRID(ST_MakePoint(-1.4701, 53.3811), 4326)::geography, 4.9, 20),
  ('44444444-4444-4444-a444-444444444444', 'seed_dave@test.local',  'seed_dave',  'Derby',        'About 21 miles south',          ST_SetSRID(ST_MakePoint(-1.4746, 52.9225), 4326)::geography, 4.2, 5),
  ('55555555-5555-4555-a555-555555555555', 'seed_eve@test.local',   'seed_eve',   'Leeds',        'About 39 miles — outside 25',   ST_SetSRID(ST_MakePoint(-1.5491, 53.8008), 4326)::geography, 5.0, 30)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  city = EXCLUDED.city,
  bio = EXCLUDED.bio,
  location = EXCLUDED.location;

-- Swap posts (one per seed user, location = owner's location)
INSERT INTO public.posts (id, user_id, post_type, title, author, isbn, cover_image_url, condition, genre, swap_type, availability, location)
VALUES
  ('aaaaaaa1-aaaa-4aaa-aaaa-aaaaaaaaaaa1', '11111111-1111-4111-a111-111111111111', 'swap', 'To Kill a Mockingbird', 'Harper Lee',          '9780061120084', 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 'good',     'Fiction',     'trade', 'available', ST_SetSRID(ST_MakePoint(-1.4219, 53.2350), 4326)::geography),
  ('aaaaaaa2-aaaa-4aaa-aaaa-aaaaaaaaaaa2', '22222222-2222-4222-a222-222222222222', 'swap', '1984',                      'George Orwell',       '9780451524935', 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg', 'like_new', 'Fiction',     'trade', 'available', ST_SetSRID(ST_MakePoint(-1.4800, 53.2420), 4326)::geography),
  ('aaaaaaa3-aaaa-4aaa-aaaa-aaaaaaaaaaa3', '33333333-3333-4333-a333-333333333333', 'swap', 'The Hobbit',                'J.R.R. Tolkien',      '9780547928227', 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg', 'acceptable','Fantasy',    'borrow','available', ST_SetSRID(ST_MakePoint(-1.4701, 53.3811), 4326)::geography),
  ('aaaaaaa4-aaaa-4aaa-aaaa-aaaaaaaaaaa4', '44444444-4444-4444-a444-444444444444', 'swap', 'Pride and Prejudice',       'Jane Austen',         '9780141439518', 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg', 'good',     'Romance',     'gift',  'available', ST_SetSRID(ST_MakePoint(-1.4746, 52.9225), 4326)::geography),
  ('aaaaaaa5-aaaa-4aaa-aaaa-aaaaaaaaaaa5', '55555555-5555-4555-a555-555555555555', 'swap', 'Dune',                      'Frank Herbert',       '9780441172719', 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg', 'new',      'Sci-Fi',      'trade', 'available', ST_SetSRID(ST_MakePoint(-1.5491, 53.8008), 4326)::geography)
ON CONFLICT (id) DO NOTHING;

-- Verification: viewer in Chesterfield should see 4 of 5
-- SELECT username, city,
--        ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(-1.4219, 53.2350),4326)::geography)/1609.34 AS miles
-- FROM public.users WHERE username LIKE 'seed_%' ORDER BY miles;

-- SELECT title, distance_miles, username
-- FROM get_nearby_swap_posts(53.2350, -1.4219, 25, 20, 0, '{}');
-- Expected: 4 rows (alice, bob, carol, dave) sorted nearest-first; eve excluded.
