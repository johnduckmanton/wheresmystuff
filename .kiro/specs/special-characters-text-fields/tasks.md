# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Special Characters HTML-Entity-Encoded on Storage
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `sanitizeString()` HTML-entity-encodes special characters
  - **Scoped PBT Approach**: Use fast-check to generate strings containing `&`, `'`, `/`, `"`, and non-HTML-tag `<`/`>` characters. For each generated input, assert that `sanitizeString(input)` returns the input with those characters preserved literally (no `&amp;`, `&#x27;`, `&#x2F;`, `&quot;`, `&lt;`, `&gt;` in output).
  - Test file: `backend/tests/sanitizeString.bugCondition.test.js`
  - Import `sanitizeString` from `backend/utils/validation.js`
  - Generate arbitrary strings containing at least one of `&`, `'`, `/`, `"` (avoid `<script>` and other dangerous HTML patterns)
  - Assert: output does NOT contain HTML entities (`&amp;`, `&#x27;`, `&#x2F;`, `&quot;`)
  - Assert: output preserves the literal special characters from the input
  - Also test length inflation: generate a string of 253 chars with 2 ampersands and maxLength=255, assert it does NOT throw (currently it will throw because encoded length is 261)
  - Also test idempotency: assert `sanitizeString(sanitizeString(x)) === sanitizeString(x)` for inputs with special chars
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists: sanitizeString encodes `&` to `&amp;`, etc.)
  - Document counterexamples found (e.g., `sanitizeString("Tom & Jerry")` returns `"Tom &amp; Jerry"` instead of `"Tom & Jerry"`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - XSS Prevention and Length Validation Maintained
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `backend/tests/sanitizeString.preservation.test.js`
  - Import `sanitizeString` from `backend/utils/validation.js`
  - **Observe XSS behavior on UNFIXED code**:
    - Observe: `sanitizeString('<script>alert("xss")</script>')` encodes the `<` and `>` characters (XSS is prevented)
    - Observe: `sanitizeString('javascript:alert(1)')` removes the `javascript:` protocol
    - Observe: strings with `onerror=` event handlers are encoded/neutralized
  - **Write property-based tests for XSS prevention** (these define the preservation contract that must hold after fix):
    - For all generated strings containing `<script>`, `<iframe>`, `<object>`, `<embed>`, `on\w+=` event handlers, or `javascript:` protocol: assert the output does NOT contain executable script vectors (`<script`, `javascript:`, `onerror=`, `<iframe`)
    - Use fast-check structured generators: combine random tag names from dangerous set × random attributes × random content
  - **Write property-based tests for length validation**:
    - For all generated strings where `str.length > maxLength`: assert `sanitizeString(str, maxLength)` throws an error
    - For all generated strings where `str.length <= maxLength` (and no dangerous HTML): assert `sanitizeString(str, maxLength)` does NOT throw
  - **Write property-based test for idempotency**:
    - For all generated safe strings (no dangerous HTML): assert `sanitizeString(sanitizeString(x)) === sanitizeString(x)`
  - Verify all preservation tests PASS on UNFIXED code (XSS is already prevented, length validation works on encoded strings, idempotency holds for safe strings)
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix special characters encoding in sanitizeString

  - [x] 3.1 Rewrite `sanitizeString()` to use tag-stripping instead of HTML entity encoding
    - File: `backend/utils/validation.js`
    - Remove the six `.replace()` calls that encode `&`, `<`, `>`, `"`, `'`, `/`
    - Replace with regex-based dangerous HTML tag stripping: remove `<script>...</script>`, `<iframe>...</iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<style>` tags and their contents
    - Remove event handler attributes (`on\w+=...`) from any remaining HTML-like content
    - Keep `javascript:` protocol removal (apply to raw string)
    - Ensure `maxLength` is checked on the sanitized result (which now has same or fewer chars than input)
    - Keep whitespace trimming
    - _Bug_Condition: isBugCondition(input) where input.value contains any of `&`, `'`, `/`, `"`, `<` (not in HTML tag), `>` (not in HTML tag)_
    - _Expected_Behavior: sanitizeString returns literal characters without HTML entity encoding_
    - _Preservation: XSS prevention via tag stripping; length validation on actual char count; idempotent sanitization_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3_

  - [x] 3.2 Fix length validation order in `validateAndSanitizeRecursive()`
    - File: `backend/utils/validation.js`
    - Since `sanitizeString()` now returns a string with same or fewer characters than input, the double length check is redundant
    - Remove the redundant `maxLength` check after `sanitizeString()` call in the string branch, OR keep it as a safety net (it will never trigger for valid sanitization)
    - Ensure `minLength` check still works on the sanitized result
    - _Requirements: 2.6, 3.3_

  - [x] 3.3 Remove `decodeHtmlEntities()` calls from backend handlers
    - Remove decode calls from: `backend/handlers/things.js`, `backend/handlers/locations.js`, `backend/handlers/people.js`, `backend/handlers/categories.js`, `backend/handlers/rooms.js`, `backend/handlers/inventory.js`
    - Remove decode calls from: `backend/services/containerService.js`
    - Keep `decodeHtmlEntities` function exported from `validation.js` (marked deprecated) for migration script use
    - _Requirements: 2.7_

  - [x] 3.4 Remove frontend decode workaround
    - Remove `decodeHtmlEntities()`, `decodeObjectFields()`, and `decodeCategoryFields()` calls from:
      - `frontend/src/components/ContainerContentsView.tsx`
      - `frontend/src/components/packing/PackingInterface.tsx`
      - `frontend/src/components/Categories.tsx`
    - Remove import of `htmlDecoder.ts` utilities from those components
    - Keep `frontend/src/utils/htmlDecoder.ts` file for now (can be deleted in a future cleanup)
    - _Requirements: 2.7, 3.5_

  - [x] 3.5 Create data migration script for existing encoded records
    - File: `backend/scripts/migrateEncodedData.js`
    - Script scans all DynamoDB records in the table
    - For each text field in Things, Containers, Locations, Rooms, People, Categories: decode HTML entities (`&amp;` → `&`, `&#x27;` → `'`, `&#x2F;` → `/`, `&quot;` → `"`, `&lt;` → `<`, `&gt;` → `>`)
    - Skip fields that don't contain any HTML entities (optimization)
    - Include dry-run mode (log changes without writing)
    - Include batch processing with DynamoDB batch write limits
    - Add safety check: don't decode if the decoded result would contain dangerous HTML (edge case protection)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Special Characters Preserved in Storage
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (literal character preservation)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `backend/tests/sanitizeString.bugCondition.test.js`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - special characters are preserved literally)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - XSS Prevention and Length Validation Maintained
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run `backend/tests/sanitizeString.preservation.test.js`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - XSS still prevented, length validation works, idempotency holds)
    - Confirm all preservation tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full backend test suite: `npm test` in `backend/` directory
  - Run full frontend test suite: `npm test` in `frontend/` directory
  - Ensure all existing tests still pass (no regressions beyond expected decode-related changes)
  - Verify no TypeScript errors in frontend after removing htmlDecoder imports
  - Ensure all tests pass, ask the user if questions arise.
