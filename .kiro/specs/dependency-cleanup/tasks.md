# Implementation Plan: Dependency Cleanup

## Overview

Remove three unused packages (`@zxing/browser`, `@zxing/library`, `@mui/x-date-pickers-pro`) from the frontend, regenerate the lock file, and verify the build and tests pass. No source code changes required.

## Tasks

- [x] 1. Remove unused dependencies from package.json
  - [x] 1.1 Remove `@zxing/browser` from `frontend/package.json` dependencies
    - Delete the `"@zxing/browser": "^0.1.5"` entry from the `dependencies` object
    - _Requirements: 1.1_

  - [x] 1.2 Remove `@zxing/library` from `frontend/package.json` dependencies
    - Delete the `"@zxing/library": "^0.21.3"` entry from the `dependencies` object
    - _Requirements: 1.2_

  - [x] 1.3 Remove `@mui/x-date-pickers-pro` from `frontend/package.json` dependencies
    - Delete the `"@mui/x-date-pickers-pro": "^8.22.1"` entry from the `dependencies` object
    - _Requirements: 2.1_

- [x] 2. Regenerate lock file
  - [x] 2.1 Run `npm install` in `frontend/` to regenerate `package-lock.json`
    - The lock file should no longer list the removed packages as direct dependencies
    - _Requirements: 4.1, 4.2_

- [x] 3. Verify retained dependencies are intact
  - Confirm `qrcode`, `@types/qrcode`, `qrcode.react`, and `html5-qrcode` remain in `frontend/package.json`
  - Confirm `@mui/x-date-pickers` (non-pro) remains in `frontend/package.json`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Verify build and tests pass
  - [x] 4.1 Run `npm run build` in `frontend/` to verify the production build succeeds
    - _Requirements: 1.3, 1.4, 2.2, 4.3, 5.1_

  - [x] 4.2 Run `npm test` in `frontend/` to verify the test suite passes
    - _Requirements: 2.3, 5.2, 5.3_

## Notes

- No source code files are modified — only `package.json` and `package-lock.json` change
- No property-based tests — this is a dependency removal with no new logic
- If any test fails after removal, investigate whether the test had a hidden dependency on a removed package (Requirement 5.3)
