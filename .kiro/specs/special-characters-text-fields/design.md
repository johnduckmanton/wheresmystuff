# Special Characters in Text Fields Bugfix Design

## Overview

The `sanitizeString()` function in `backend/utils/validation.js` applies aggressive HTML entity encoding to all string inputs before storage, converting characters like `&`, `'`, `/`, `"`, `<`, `>` into their HTML entity equivalents. This causes length inflation (rejecting valid input), double-encoding on edits (progressive data corruption), and unnecessary complexity via decode workarounds on the read path.

The fix replaces HTML entity encoding with targeted XSS prevention: strip dangerous HTML tags (`<script>`, `<iframe>`, event handler attributes) and `javascript:` protocol strings, while preserving all literal characters. React's JSX auto-escaping already prevents XSS on the frontend rendering side, so encoding special characters at the storage layer is unnecessary and harmful.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — any text input containing `&`, `'`, `/`, `"`, `<`, or `>` characters being processed by `sanitizeString()`
- **Property (P)**: The desired behavior — literal characters are stored in DynamoDB without encoding, and the stored string matches the original user input (minus dangerous HTML)
- **Preservation**: XSS prevention must remain effective; `maxLength` validation must still enforce limits; pattern validation for UUIDs, colors, etc. must still work
- **sanitizeString()**: Function in `backend/utils/validation.js` that currently HTML-entity-encodes all special characters
- **validateAndSanitize()**: Wrapper function in `backend/utils/validation.js` that calls `validateSchema()` which calls `sanitizeString()` via `validateAndSanitizeRecursive()`
- **decodeHtmlEntities()**: Backend function and frontend utility (`htmlDecoder.ts`) that reverses the encoding on the read path — exists solely as a workaround for the aggressive encoding
- **noSanitize**: Schema flag that bypasses `sanitizeString()` for fields like S3 photo keys

## Bug Details

### Bug Condition

The bug manifests when any text input containing the characters `&`, `'`, `/`, `"`, `<`, or `>` passes through `sanitizeString()`. The function HTML-entity-encodes these characters before length validation and storage, causing three distinct failures: length inflation that rejects valid input, double-encoding that corrupts data on re-save, and the need for decode workarounds throughout the read path.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { value: string, field: string }
  OUTPUT: boolean
  
  LET specialChars = ['&', "'", '/', '"', '<', '>']
  
  RETURN input.value contains ANY character IN specialChars
         AND input.field does NOT have noSanitize flag
         AND input.field is of type 'string' in schema
END FUNCTION
```

### Examples

- User enters `"Tom's Hardware & Electronics"` (31 chars) as a thing name → stored as `"Tom&#x27;s Hardware &amp; Electronics"` (43 chars), 39% inflation
- User enters a 250-char description containing 5 ampersands → encoded to 270 chars, may exceed `maxLength: 255` and be rejected
- User saves `"Smith & Son's"`, then edits the record → on second save, `&amp;` becomes `&amp;amp;` and `&#x27;` becomes `&amp;#x27;`, progressively corrupting the value
- User enters `"3/4 inch bolt"` → stored as `"3&#x2F;4 inch bolt"` (18 chars instead of 14)
- User enters `<script>alert('xss')</script>` → should be stripped/neutralized (this is the XSS case that must remain protected)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- XSS prevention must remain effective: `<script>` tags, `<iframe>`, `<img onerror=...>`, and similar dangerous HTML must be stripped or neutralized
- The `javascript:` protocol in strings must continue to be removed
- `maxLength` validation must continue to enforce character limits (now on the raw input, not encoded form)
- `minLength` validation must continue to work
- Pattern validation (UUID regex, color hex regex) must continue to work on raw input
- The `noSanitize` flag must continue to bypass sanitization for S3 keys and other non-user-facing fields
- Array `maxItems` and number range validation must remain unchanged
- Required field validation must remain unchanged
- Tags validation (alphanumeric + hyphen/underscore only) must remain unchanged

**Scope:**
All inputs that do NOT contain HTML tags or `javascript:` protocol strings should pass through completely unmodified (aside from whitespace trimming). This includes:
- Strings with `&`, `'`, `/`, `"` characters (the primary bug case)
- Strings with `<` or `>` that are not part of HTML tags (e.g., `"value < 5"`)
- Strings with no special characters at all
- All non-string fields (numbers, booleans, arrays, objects)

## Hypothesized Root Cause

Based on the code analysis, the root cause is clear and confirmed:

1. **Over-aggressive encoding in `sanitizeString()`**: The function encodes ALL instances of `&`, `<`, `>`, `"`, `'`, `/` using `.replace()` with global regex — this is a blanket approach designed for embedding strings in HTML attributes, which is inappropriate for a data storage layer where the frontend framework handles output encoding.

2. **Length validation occurs after encoding**: In `validateAndSanitizeRecursive()`, `sanitizeString(data, schema.maxLength)` is called, which first encodes, then checks length. But the `maxLength` is also checked again on the encoded result (`if (schema.maxLength && sanitized.length > schema.maxLength)`). This means a 250-char input with 5 ampersands becomes 270 chars and fails the 255-char limit.

3. **No idempotency protection**: When a record is read from DynamoDB, the handler decodes entities before returning to the client. But when the client re-submits that same value for update, it goes through `sanitizeString()` again. If the decode step is missed or partial, entities accumulate with each save cycle.

4. **Workaround proliferation**: The `decodeHtmlEntities()` function exists in both `backend/utils/validation.js` and `frontend/src/utils/htmlDecoder.ts`, used across 7 backend handlers/services and 3 frontend components — evidence that the encoding approach is wrong rather than that decoding is the solution.

## Correctness Properties

Property 1: Bug Condition - Special Characters Preserved in Storage

_For any_ text input containing special characters (`&`, `'`, `/`, `"`, `<` not in HTML tags, `>` not in HTML tags) that does NOT contain dangerous HTML (script tags, event handlers, javascript: protocol), the fixed `sanitizeString()` function SHALL return the input with those characters preserved literally, without HTML entity encoding.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - XSS Prevention Maintained

_For any_ text input containing dangerous HTML constructs (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg onload=...>`, `on*=` event handlers, `javascript:` protocol), the fixed `sanitizeString()` function SHALL strip or neutralize those dangerous constructs, preventing XSS attacks while preserving any surrounding non-dangerous text.

**Validates: Requirements 3.1, 3.2, 3.5**

Property 3: Preservation - Length Validation on Raw Input

_For any_ text input, the fixed validation SHALL enforce `maxLength` limits against the actual character count of the input (after sanitization removes dangerous HTML), not against an encoded representation. Inputs within the character limit SHALL be accepted.

**Validates: Requirements 2.6, 3.3**

Property 4: Preservation - Idempotent Sanitization

_For any_ text input that has already been sanitized by the fixed `sanitizeString()`, applying `sanitizeString()` again SHALL produce the identical output — no progressive transformation, no accumulation of encoding artifacts.

**Validates: Requirements 2.5**

## Fix Implementation

### Changes Required

**File**: `backend/utils/validation.js`

**Function**: `sanitizeString()`

**Specific Changes**:

1. **Replace HTML entity encoding with tag stripping**: Remove the six `.replace()` calls that encode `&`, `<`, `>`, `"`, `'`, `/`. Replace with a regex-based approach that strips dangerous HTML tags and their contents (`<script>...</script>`, `<iframe>...</iframe>`, etc.) and removes event handler attributes (`on\w+=`).

2. **Preserve `javascript:` protocol removal**: Keep the existing `javascript:` protocol stripping, but apply it to the raw string rather than an already-encoded string.

3. **Fix length validation order**: Ensure `maxLength` is checked on the sanitized (tag-stripped) result, which now has the same or fewer characters than the input — not more.

4. **Deprecate `decodeHtmlEntities()`**: Mark the backend `decodeHtmlEntities()` function as deprecated. It remains exported for backward compatibility during migration but is no longer needed for new writes.

**File**: `backend/utils/validation.js`

**Function**: `validateAndSanitizeRecursive()` (string branch)

**Specific Changes**:

5. **Remove double length check**: Currently checks length inside `sanitizeString()` AND again after. With the new approach, the sanitized string is always ≤ input length, so a single check after sanitization suffices.

**File**: Backend handlers (`things.js`, `locations.js`, `people.js`, `categories.js`, `rooms.js`, `inventory.js`) and `containerService.js`

**Specific Changes**:

6. **Remove `decodeHtmlEntities()` calls on read path**: Since data is no longer encoded on write, the decode step on read becomes unnecessary. Remove all `decodeHtmlEntities()` calls from handler read functions. Keep the import available temporarily for the data migration utility.

**File**: `frontend/src/utils/htmlDecoder.ts` and consuming components

**Specific Changes**:

7. **Remove frontend decode workaround**: Remove `decodeHtmlEntities()`, `decodeObjectFields()`, and `decodeCategoryFields()` calls from `ContainerContentsView.tsx`, `PackingInterface.tsx`, and `Categories.tsx`. Eventually delete `htmlDecoder.ts` entirely.

**File**: New migration utility (e.g., `backend/scripts/migrateEncodedData.js`)

**Specific Changes**:

8. **Data migration for existing records**: Create a one-time migration script that scans all existing DynamoDB records and decodes HTML entities in text fields. This converts `&amp;` → `&`, `&#x27;` → `'`, etc. for all previously-stored data. Run this AFTER deploying the new sanitization logic.

### New `sanitizeString()` Implementation (pseudocode)

```
FUNCTION sanitizeString(input, maxLength)
  IF input is not a string THEN RETURN input
  
  LET sanitized = input.trim()
  
  // Strip dangerous HTML tags and their contents
  sanitized = stripDangerousTags(sanitized)
  
  // Remove event handler attributes (on*)
  sanitized = removeEventHandlers(sanitized)
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '')
  
  // Check length on the actual character count
  IF maxLength AND sanitized.length > maxLength THEN
    THROW Error("String exceeds maximum length of {maxLength} characters")
  END IF
  
  RETURN sanitized
END FUNCTION

FUNCTION stripDangerousTags(str)
  // Remove <script>...</script>, <iframe>...</iframe>, <object>, <embed>, <link>, <meta>
  LET dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style']
  FOR EACH tag IN dangerousTags DO
    str = str.replace(/<tag[^>]*>[\s\S]*?<\/tag>/gi, '')
    str = str.replace(/<tag[^>]*\/?>/gi, '')
  END FOR
  RETURN str
END FUNCTION

FUNCTION removeEventHandlers(str)
  // Remove on*="..." attributes from any remaining HTML-like content
  str = str.replace(/\s+on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
  str = str.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
  RETURN str
END FUNCTION
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (confirm that `sanitizeString()` indeed encodes special characters and causes length inflation), then verify the fix works correctly and preserves XSS protection.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause: `sanitizeString()` encodes characters and inflates length.

**Test Plan**: Write unit tests that pass strings with special characters through the current `sanitizeString()` and assert that the output is HTML-encoded (demonstrating the bug). Also test that a string just under `maxLength` with special characters gets rejected after encoding.

**Test Cases**:
1. **Ampersand Encoding Test**: Pass `"Tom & Jerry"` to `sanitizeString()` → assert output contains `&amp;` (will pass on unfixed code, demonstrating the bug)
2. **Apostrophe Encoding Test**: Pass `"it's fine"` → assert output contains `&#x27;` (demonstrates bug)
3. **Length Inflation Rejection Test**: Pass a 253-char string with 2 ampersands and `maxLength: 255` → assert it throws (demonstrates bug: 253 + 2×4 = 261 > 255)
4. **Double-Encoding Test**: Pass `"&amp;"` (already encoded) → assert output is `"&amp;amp;"` (demonstrates progressive corruption)

**Expected Counterexamples**:
- All special characters are HTML-entity-encoded regardless of context
- Strings near maxLength with special characters are rejected
- Previously-encoded strings get double-encoded

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (input contains special characters but no dangerous HTML), the fixed function preserves those characters literally.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := sanitizeString_fixed(input.value)
  ASSERT result contains same literal special characters as input.value
  ASSERT result.length <= input.value.length
  ASSERT result does NOT contain '&amp;' OR '&#x27;' OR '&#x2F;' OR '&quot;'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs containing dangerous HTML, the fixed function still strips/neutralizes the dangerous content.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) (contains dangerous HTML) DO
  result := sanitizeString_fixed(input.value)
  ASSERT result does NOT contain '<script'
  ASSERT result does NOT contain 'javascript:'
  ASSERT result does NOT contain 'onerror='
  ASSERT result does NOT contain '<iframe'
END FOR
```

**Testing Approach**: Property-based testing is recommended for both fix checking and preservation checking because:
- It generates many combinations of special characters, string lengths, and positions to verify no encoding occurs
- It generates many XSS payload variants to verify the stripping approach is comprehensive
- It catches edge cases like nested tags, mixed-case tags, and unusual whitespace that manual unit tests might miss
- It provides strong guarantees about idempotency (sanitize(sanitize(x)) === sanitize(x))

**Test Plan**: Write property-based tests using `fast-check` that generate random strings with special characters and verify preservation. Also generate random XSS payloads and verify stripping.

**Test Cases**:
1. **Character Preservation**: Generate random strings containing `&`, `'`, `/`, `"`, and non-tag `<`/`>` — verify they pass through unchanged
2. **XSS Stripping Preservation**: Generate random strings containing `<script>`, `<iframe>`, `javascript:`, `onerror=` — verify dangerous parts are removed
3. **Length Validation Preservation**: Generate strings at various lengths with special characters — verify `maxLength` is enforced on actual character count
4. **Idempotency**: Generate random strings, apply `sanitizeString()` twice — verify same output both times

### Unit Tests

- Test `sanitizeString()` with each individual special character (`&`, `'`, `/`, `"`, `<`, `>`) and verify literal preservation
- Test `sanitizeString()` with common XSS payloads and verify stripping
- Test `sanitizeString()` with `maxLength` enforcement on raw character count
- Test `sanitizeString()` idempotency (double-apply produces same result)
- Test `validateAndSanitize()` end-to-end with a schema and special character input
- Test that `noSanitize` flag still bypasses all sanitization
- Test edge cases: empty string, whitespace-only, string of all special characters, very long strings

### Property-Based Tests

- Generate random strings from alphabet including all special characters — verify no HTML entities appear in output
- Generate random XSS payloads using structured generators (tag name × attribute × content) — verify all script execution vectors are removed
- Generate random strings and verify `sanitizeString(sanitizeString(x)) === sanitizeString(x)` (idempotency)
- Generate strings at boundary lengths (maxLength - 1, maxLength, maxLength + 1) with varying numbers of special characters — verify correct accept/reject behavior

### Integration Tests

- Test full API request → DynamoDB storage → API response cycle with special characters in all entity types (Things, Containers, Locations, Rooms, People, Categories)
- Test that editing a record with special characters does not corrupt data (save → read → save → read cycle)
- Test that the migration script correctly decodes existing encoded data without affecting already-clean data
- Test that frontend renders special characters correctly without the decode workaround (React JSX auto-escaping)
