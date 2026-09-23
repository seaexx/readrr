// Books lookup service — Google Books API.
//
// Requires EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY (set in .env.local for local dev and
// in eas.json `env` for builds). A key gives dedicated quota, so lookups are
// reliable — the previous keyless/Open-Library path returned frequent misses.

export interface BookInfo {
  isbn: string | null;
  title: string;
  author: string;
  cover_image_url: string | null;
  publisher?: string;
  publishedDate?: string;
  description?: string;
}

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const REQUEST_TIMEOUT_MS = 8000;

function getApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;
}

// fetch with a timeout so a hanging request can't freeze the lookup UI.
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // X-Ios-Bundle-Identifier lets a Google key that's restricted to this iOS
    // app authorize the request (harmless when the key is unrestricted).
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'X-Ios-Bundle-Identifier': 'app.readrr' },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Normalize user/scanner input: strip hyphens/spaces; uppercase X for ISBN-10.
export function normalizeIsbn(input: string): string {
  return input.replace(/[^0-9Xx]/g, '').toUpperCase();
}

// Upgrade any stored cover URL to a sharp one at render time. Google's default
// `zoom=1` thumbnail is only 128×195 (blurry on cards); `fife=w600-h900` returns
// ~600×900. Also forces https, drops the page-curl effect, and bumps Open
// Library small/medium covers to large. Covers already saved on posts benefit too.
export function hiResCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.replace(/^http:\/\//, 'https://').replace('&edge=curl', '');
  if (u.includes('books.google.com/books/content') && !u.includes('fife=')) {
    u += '&fife=w600-h900';
  }
  return u.replace(/-(S|M)\.jpg$/, '-L.jpg');
}

function extractBookId(url: string): string | null {
  const match = url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : null;
}

// Best available cover for a Google Books volume, forced to https.
function coverFrom(volumeInfo: any): string | null {
  const links = volumeInfo?.imageLinks;
  if (!links) return null;
  const url =
    links.extraLarge || links.large || links.medium || links.small || links.thumbnail;
  if (!url) return null;
  const id = extractBookId(url);
  if (id) {
    return `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1&fife=w600-h900`;
  }
  return url.replace('http://', 'https://');
}

function toBookInfo(item: any): BookInfo {
  const v = item?.volumeInfo || {};
  const ids: any[] = v.industryIdentifiers || [];
  const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier;
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier;
  return {
    isbn: isbn13 || isbn10 || null,
    title: v.title || 'Unknown Title',
    author: Array.isArray(v.authors) ? v.authors.join(', ') : v.authors || 'Unknown Author',
    cover_image_url: coverFrom(v),
    publisher: v.publisher,
    publishedDate: v.publishedDate,
    description: v.description,
  };
}

// Look up a single book by ISBN (from a barcode scan). Throws a friendly error
// if nothing matches or lookup is unavailable.
export async function fetchBookByISBN(rawIsbn: string): Promise<BookInfo> {
  const isbn = normalizeIsbn(rawIsbn);
  const key = getApiKey();
  if (!key) {
    throw new Error('Book lookup is temporarily unavailable. Please try again later.');
  }

  const response = await fetchWithTimeout(`${GOOGLE_BOOKS_API}?q=isbn:${isbn}&key=${key}`);
  const json = await response.json();

  if (!json?.items?.length) {
    throw new Error('Book not found. Try searching by title instead.');
  }
  return toBookInfo(json.items[0]);
}

// Title / author search. Returns [] on any failure so the UI can show an empty state.
export async function searchBooks(query: string): Promise<BookInfo[]> {
  const key = getApiKey();
  if (!key) return [];

  try {
    const response = await fetchWithTimeout(
      `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(query)}&maxResults=12&key=${key}`
    );
    const json = await response.json();
    return ((json?.items as any[]) || []).map(toBookInfo);
  } catch (e: any) {
    console.log('Book search failed:', e?.message || e);
    return [];
  }
}
