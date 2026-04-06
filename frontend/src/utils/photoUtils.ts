/**
 * Derives the thumbnail S3 key from an original photo key.
 * Convention mirrors the backend imageProcessingService:
 *   photos/{userId}/{inventoryId}/{entityId}/{basename}.webp
 *   → thumbnails/{userId}/{inventoryId}/{entityId}/{basename}.webp
 */
export function toThumbnailKey(photoKey: string): string {
  if (!photoKey.startsWith('photos/')) return photoKey;
  const withoutExt = photoKey.replace(/\.[^.]+$/, '');
  return withoutExt.replace(/^photos\//, 'thumbnails/') + '.webp';
}
