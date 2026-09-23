import { supabase } from '../config/supabase';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

// Base64 decoder that works in React Native (no atob available)
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  // Calculate buffer length (account for padding)
  let bufferLength = Math.floor(base64.length * 0.75);
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;

  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return bytes;
}

// Image compression helper - always compress to ensure consistent format
async function compressImage(uri: string): Promise<string> {
  const manipResult = await manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: SaveFormat.JPEG }
  );
  return manipResult.uri;
}

// Convert file URI to base64 and upload to Supabase
async function uploadFile(
  uri: string,
  bucket: string,
  filePath: string,
  upsert: boolean = false
): Promise<string> {
  // Compress the image first
  const compressedUri = await compressImage(uri);

  // Read file as base64
  const base64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: 'base64',
  });

  // Convert base64 to Uint8Array (works in React Native)
  const uint8Array = base64ToUint8Array(base64);

  // Upload to Supabase
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, uint8Array, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert,
    });

  if (error) throw error;

  // Get public URL
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

// Avatar upload. Each upload gets a unique filename so the public URL changes —
// overwriting `avatar.jpg` meant the CDN (1h cache) and the app's image cache
// kept serving the old picture. Older avatars are cleaned up afterwards.
export async function uploadAvatar(uri: string, userId: string): Promise<string> {
  const fileName = `avatar-${Date.now()}.jpg`;
  const url = await uploadFile(uri, 'avatars', `${userId}/${fileName}`, false);

  try {
    const { data: existing } = await supabase.storage.from('avatars').list(userId);
    const stale = (existing || [])
      .map((f) => f.name)
      .filter((name) => name !== fileName)
      .map((name) => `${userId}/${name}`);
    if (stale.length > 0) await supabase.storage.from('avatars').remove(stale);
  } catch {
    // Best-effort cleanup; the new avatar is already live.
  }

  return url;
}

// Post image upload
export async function uploadPostImage(uri: string, userId: string): Promise<string> {
  const timestamp = Date.now();
  const filePath = `${userId}/${timestamp}.jpg`;
  return uploadFile(uri, 'post-images', filePath, false);
}

// Delete post image
export async function deletePostImage(imageUrl: string, userId: string): Promise<void> {
  // Extract filename from URL
  const urlParts = imageUrl.split('/');
  const filename = urlParts[urlParts.length - 1];
  const filePath = `${userId}/${filename}`;

  const { error } = await supabase.storage
    .from('post-images')
    .remove([filePath]);

  if (error) throw error;
}
