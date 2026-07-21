# Bugfix Requirements Document

## Introduction

Users cannot enter special characters (commas, ampersands, apostrophes, slashes, angle brackets, and double quotes) into text fields such as names, descriptions, summaries, and notes across all entity types (Things, Containers, Locations, Rooms, People, Categories). The `sanitizeString()` function in `backend/utils/validation.js` aggressively HTML-entity-encodes these characters on write (e.g., `&` becomes `&amp;`, `'` becomes `&#x27;`, `/` becomes `&#x2F;`). While a corresponding `decodeHtmlEntities()` function exists on read, this approach has three problems:

1. **Length inflation**: Encoded characters consume more bytes (e.g., `&` becomes 5 chars `&amp;`), causing strings to exceed `maxLength` validation limits after sanitization, resulting in rejected input.
2. **Double-encoding on updates**: When a user edits an existing record, the already-encoded value is re-encoded (e.g., `&amp;` becomes `&amp;amp;`), progressively corrupting data.
3. **Commas in particular**: While commas are not HTML-encoded themselves, they trigger issues in tag-related searches where comma-separated parsing conflicts with literal commas in content.

The fix should replace the aggressive HTML entity encoding with a targeted sanitization approach that prevents XSS without corrupting legitimate user input.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user enters text containing an ampersand (`&`) in any text field (name, description, notes, etc.) THEN the system stores the value as `&amp;` in DynamoDB, inflating the character count and potentially exceeding maxLength validation

1.2 WHEN a user enters text containing an apostrophe (`'`) in any text field THEN the system stores the value as `&#x27;`, inflating the character count by 4 additional characters per apostrophe

1.3 WHEN a user enters text containing a forward slash (`/`) in any text field THEN the system stores the value as `&#x2F;`, inflating the character count by 4 additional characters per slash

1.4 WHEN a user enters text containing a double quote (`"`) in any text field THEN the system stores the value as `&quot;`, inflating the character count by 4 additional characters per quote

1.5 WHEN a user edits a previously-saved record that contains special characters THEN the system double-encodes the already-encoded entities (e.g., `&amp;` becomes `&amp;amp;`), progressively corrupting the data with each save

1.6 WHEN a user enters text containing special characters that causes the encoded string to exceed the schema's maxLength limit THEN the system rejects the input with a validation error, even though the original input was within acceptable length

### Expected Behavior (Correct)

2.1 WHEN a user enters text containing an ampersand (`&`) in any text field THEN the system SHALL store the literal `&` character in DynamoDB without encoding, preserving the original input exactly

2.2 WHEN a user enters text containing an apostrophe (`'`) in any text field THEN the system SHALL store the literal `'` character in DynamoDB without encoding

2.3 WHEN a user enters text containing a forward slash (`/`) in any text field THEN the system SHALL store the literal `/` character in DynamoDB without encoding

2.4 WHEN a user enters text containing a double quote (`"`) in any text field THEN the system SHALL store the literal `"` character in DynamoDB without encoding

2.5 WHEN a user edits a previously-saved record that contains special characters THEN the system SHALL preserve the characters exactly as stored, without double-encoding or corruption

2.6 WHEN a user enters text that is within the schema's maxLength limit (counting actual characters, not encoded length) THEN the system SHALL accept the input without validation errors

2.7 WHEN the system returns text field values in API responses THEN it SHALL return the literal characters without HTML encoding, and the frontend SHALL render them safely using React's built-in XSS protection (JSX auto-escaping)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user enters text containing `<script>` tags or other HTML/JavaScript injection attempts THEN the system SHALL CONTINUE TO prevent XSS attacks by stripping or neutralizing dangerous HTML tags and event handlers

3.2 WHEN a user enters text containing the `javascript:` protocol THEN the system SHALL CONTINUE TO remove or neutralize the protocol string

3.3 WHEN a user enters a string that exceeds the maxLength limit (counting actual characters) THEN the system SHALL CONTINUE TO reject the input with a validation error

3.4 WHEN a user enters text in fields with pattern validation (e.g., UUID fields, color hex codes) THEN the system SHALL CONTINUE TO validate against those patterns

3.5 WHEN text fields are rendered in the frontend React application THEN the system SHALL CONTINUE TO be safe from XSS attacks (React's JSX auto-escaping handles this for text content)

3.6 WHEN the system stores data in DynamoDB THEN the system SHALL CONTINUE TO use the existing entity structure and key schema without changes
