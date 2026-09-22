import { supabase } from '../config/supabase';

export type ShelfName = 'want_to_read' | 'reading' | 'finished';

export interface ShelfItem {
  id: string;
  user_id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  cover_image_url: string | null;
  shelf: ShelfName;
  created_at: string;
  updated_at: string;
  // Slice 4: populated client-side when a nearby swap copy exists
  available_nearby?: boolean;
  nearby_distance_miles?: number | null;
}

export interface ShelfBookInput {
  isbn: string | null | undefined;
  title: string;
  author?: string | null | undefined;
  cover_image_url?: string | null | undefined;
}

export async function getShelf(userId: string, shelf?: ShelfName): Promise<ShelfItem[]> {
  let query = supabase
    .from('shelf_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (shelf) query = query.eq('shelf', shelf);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ShelfItem[];
}

export async function getWantToReadTitles(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('shelf_items')
    .select('title')
    .eq('user_id', userId)
    .eq('shelf', 'want_to_read');

  if (error) throw error;
  return ((data || []) as { title: string }[]).map((r) => r.title);
}

// Save a book to a shelf. If the book is already on any shelf
// (matched by ISBN, else title+author), it is moved instead of duplicated.
export async function saveToShelf(
  userId: string,
  book: ShelfBookInput,
  shelf: ShelfName
): Promise<ShelfItem> {
  const title = book.title.trim();
  const author = book.author?.trim() || null;

  let existing: ShelfItem | null = null;

  if (book.isbn) {
    const { data } = await supabase
      .from('shelf_items')
      .select('*')
      .eq('user_id', userId)
      .eq('isbn', book.isbn)
      .maybeSingle();
    existing = (data as ShelfItem | null) ?? null;
  }

  if (!existing) {
    let q = supabase
      .from('shelf_items')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', title);
    if (author) q = q.ilike('author', author);
    const { data } = await q.maybeSingle();
    existing = (data as ShelfItem | null) ?? null;
  }

  if (existing) {
    const { data, error } = await supabase
      .from('shelf_items')
      .update({ shelf, title, author, cover_image_url: book.cover_image_url ?? existing.cover_image_url })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as ShelfItem;
  }

  const { data, error } = await supabase
    .from('shelf_items')
    .insert({
      user_id: userId,
      isbn: book.isbn,
      title,
      author,
      cover_image_url: book.cover_image_url ?? null,
      shelf,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ShelfItem;
}

export async function moveShelfItem(itemId: string, shelf: ShelfName): Promise<void> {
  const { error } = await supabase
    .from('shelf_items')
    .update({ shelf })
    .eq('id', itemId);
  if (error) throw error;
}

export async function removeShelfItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('shelf_items').delete().eq('id', itemId);
  if (error) throw error;
}

// Normalized title match key shared by feed badges + shelf availability
export function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Is this book already on any of the user's shelves? Matched by ISBN when
// present, else by title — mirrors saveToShelf's dedup so the Save button can
// show "Saved".
export async function isOnShelf(
  userId: string,
  book: { isbn?: string | null; title: string }
): Promise<boolean> {
  if (book.isbn) {
    const { data } = await supabase
      .from('shelf_items')
      .select('id')
      .eq('user_id', userId)
      .eq('isbn', book.isbn)
      .maybeSingle();
    if (data) return true;
  }
  const { data } = await supabase
    .from('shelf_items')
    .select('id')
    .eq('user_id', userId)
    .ilike('title', book.title.trim())
    .maybeSingle();
  return !!data;
}
