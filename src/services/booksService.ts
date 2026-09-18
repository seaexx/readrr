// Books lookup service
//
// Primary: Open Library (https://openlibrary.org) — free, no API key,
// no daily quota. Covers come from covers.openlibrary.org.
// Optional fallback: Google Books — only used when
// EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY is configured in .env.

export interface BookInfo {
  isbn: string | null;
  title: string;
  author: string;
  cover_image_url: string | null;
  publisher?: string;
  publishedDate?: string;
  description?: string;
}

const OL_SEARCH_FIELDS = 'title,author_name,cover_i,isbn,publisher,publish_date';
const REQUEST_TIMEOUT_MS = 8000;

// Extract book ID from a Google Books image URL
function extractBookId(url: string): string | null {
  const match = url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : null;
}

// Build Google Books cover URL (fallback - lower quality but always available)
function buildGoogleBooksUrl(bookId: string): string {
  return `https://books.google.com/books/content?id=${bookId}&printsec=frontcover&img=1&zoom=1`;
}

// Open Library covers by ISBN (works even when no cover_i is present;
// serves a blank placeholder rather than erroring)
function buildOpenLibraryUrl(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

function buildOpenLibraryIdUrl(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

// fetch with timeout so a hanging request can't freeze post creation
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Normalize user/scanner input: strip hyphens, spaces; uppercase X for ISBN-10
export function normalizeIsbn(input: string): string {
  return input.replace(/[^0-9Xx]/g, '').toUpperCase();
}

// Pick the best ISBN from an Open Library doc's isbn array
// (mixed lengths/junk; prefer a 13-digit, then a 10-digit)
function pickIsbn(isbns: unknown): string | null {
  if (!Array.isArray(isbns)) return null;
  const valid = isbns.filter(
    (i): i is string => typeof i === 'string' && /^[0-9]{9}[0-9X]$/.test(i.toUpperCase())
  );
  return (
    valid.find((i) => i.length === 13 && i.startsWith('978')) ||
    valid.find((i) => i.length === 13) ||
    valid.find((i) => i.length === 10) ||
    null
  );
}

interface OlDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  publisher?: string[];
  publish_date?: string[];
}

// Open Library search endpoint: one call returns everything we need.
// Free and unmetered for reasonable use.
async function fetchBookFromOpenLibrary(isbn: string): Promise<BookInfo> {
  const response = await fetchWithTimeout(
    `https://openlibrary.org/search.json?q=isbn:${isbn}&fields=${OL_SEARCH_FIELDS}&limit=1`
  );
  const json = await response.json();
  const doc: OlDoc | undefined = json?.docs?.[0];

  if (!doc?.title) throw new Error(`ISBN ${isbn} not found on Open Library`);

  return {
    isbn,
    title: doc.title,
    author: doc.author_name?.[0] || 'Unknown Author',
    cover_image_url: doc.cover_i ? buildOpenLibraryIdUrl(doc.cover_i) : buildOpenLibraryUrl(isbn),
    publisher: doc.publisher?.[0],
    publishedDate: doc.publish_date?.[0],
  };
}

// Google Books — requires a key so we get dedicated quota instead of the
// shared anonymous pool (which regularly returns HTTP 429).
async function fetchBookFromGoogleBooks(isbn: string, apiKey: string): Promise<BookInfo> {
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`
  );
  const json = await response.json();

  if (!json.items || json.items.length === 0) {
    throw new Error(`ISBN ${isbn} not found on Google Books`);
  }

  const book = json.items[0].volumeInfo;

  // Prefer the Open Library cover; else use whatever Google provides
  let cover: string | null = buildOpenLibraryUrl(isbn);
  if (book.imageLinks) {
    const url =
      book.imageLinks.extraLarge ||
      book.imageLinks.large ||
      book.imageLinks.medium ||
      book.imageLinks.small ||
      book.imageLinks.thumbnail;
    const bookId = url ? extractBookId(url) : null;
    if (bookId) cover = buildGoogleBooksUrl(bookId);
  }

  return {
    isbn,
    title: book.title || 'Unknown Title',
    author: book.authors?.join(', ') || 'Unknown Author',
    cover_image_url: cover,
    publisher: book.publisher,
    publishedDate: book.publishedDate,
    description: book.description,
  };
}

// Lookup by ISBN. Open Library first; falls back to Google Books only if
// an API key is configured. Throws with a user-friendly message on failure.
export async function fetchBookByISBN(rawIsbn: string): Promise<BookInfo> {
  const isbn = normalizeIsbn(rawIsbn);

  try {
    return await fetchBookFromOpenLibrary(isbn);
  } catch (olError) {
    console.error('Open Library lookup failed:', olError);

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;
    if (!apiKey) throw new Error('Book not found. Check the ISBN and try again.');

    try {
      return await fetchBookFromGoogleBooks(isbn, apiKey);
    } catch (gbError) {
      console.error('Google Books lookup failed:', gbError);
      throw new Error('Book not found. Check the ISBN and try again.');
    }
  }
}

// Title/keyword search (used for browsing books without a barcode).
// Same source as the primary lookup so behaviour stays consistent.
export async function searchBooks(query: string): Promise<BookInfo[]> {
  const response = await fetchWithTimeout(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=${OL_SEARCH_FIELDS}&limit=10`
  );
  const json = await response.json();

  return ((json?.docs || []) as OlDoc[]).map((doc) => {
    const isbn = pickIsbn(doc.isbn);
    return {
      isbn,
      title: doc.title || 'Unknown Title',
      author: doc.author_name?.[0] || 'Unknown Author',
      cover_image_url: doc.cover_i
        ? buildOpenLibraryIdUrl(doc.cover_i)
        : isbn
        ? buildOpenLibraryUrl(isbn)
        : null,
      publisher: doc.publisher?.[0],
      publishedDate: doc.publish_date?.[0],
    };
  });
}
