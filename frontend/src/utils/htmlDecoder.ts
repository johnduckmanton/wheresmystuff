/**
 * Utility functions for HTML entity decoding
 */

/**
 * Decode HTML entities in a string
 * @param str - String that may contain HTML entities
 * @returns Decoded string
 */
export function decodeHtmlEntities(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return str || '';
  
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Decode HTML entities in an object's string properties
 * @param obj - Object to decode
 * @param fields - Array of field names to decode
 * @returns Object with decoded fields
 */
export function decodeObjectFields<T extends Record<string, any>>(
  obj: T, 
  fields: (keyof T)[]
): T {
  if (!obj) return obj;
  
  const decoded = { ...obj };
  
  fields.forEach(field => {
    if (typeof decoded[field] === 'string') {
      decoded[field] = decodeHtmlEntities(decoded[field] as string) as T[keyof T];
    }
  });
  
  return decoded;
}

/**
 * Decode HTML entities in category objects
 * @param category - Category object to decode
 * @returns Category with decoded fields
 */
export function decodeCategoryFields<T extends { name?: string; description?: string; icon?: string }>(
  category: T
): T {
  return decodeObjectFields(category, ['name', 'description', 'icon']);
}