# Requirements Document

## Introduction

The frontend application has accumulated redundant and unused dependencies related to QR code generation/scanning and MUI date pickers. An audit of the codebase reveals that several installed packages are never imported, while others overlap in functionality. This feature consolidates the dependency tree to the minimum required set, removing unused packages to reduce bundle size, eliminate licensing risk, and simplify maintenance.

### Audit Findings

| Package | Version | Status | Used By |
|---------|---------|--------|---------|
| `qrcode` | 1.5.4 | **USED** | `PrintableLabel.tsx` — canvas-based QR code generation via `QRCode.toDataURL()` |
| `@types/qrcode` | 1.5.6 | **USED** | Type definitions for `qrcode` |
| `qrcode.react` | 4.2.0 | **USED** | `MfaSetup.tsx` — renders TOTP URI as SVG QR code via `<QRCodeSVG>` |
| `html5-qrcode` | 2.3.8 | **USED** | `QRCodeScanner.tsx`, `BarcodeScanner.tsx` — camera-based QR/barcode scanning |
| `@zxing/browser` | 0.1.5 | **UNUSED** | No imports found anywhere in the codebase |
| `@zxing/library` | 0.21.3 | **UNUSED** | No imports found anywhere in the codebase |
| `@mui/x-date-pickers-pro` | 8.22.1 | **UNUSED** | No imports found; only `@mui/x-date-pickers` is imported (in `ProjectFormDialog.tsx`, `ContainerSharingDialog.tsx`) |

## Glossary

- **Dependency_Auditor**: The developer or automated process performing the dependency audit and cleanup
- **Frontend_Build**: The Vite-based build pipeline that compiles and bundles the frontend application
- **Package_Manifest**: The `frontend/package.json` file that declares all project dependencies
- **Lock_File**: The `frontend/package-lock.json` file that pins exact dependency versions
- **Bundle**: The compiled JavaScript output produced by the Frontend_Build

## Requirements

### Requirement 1: Remove Unused ZXing Libraries

**User Story:** As a developer, I want unused ZXing scanning libraries removed from the project, so that the dependency tree is smaller and there are no unnecessary packages to maintain.

#### Acceptance Criteria

1. WHEN the Dependency_Auditor runs the cleanup, THE Package_Manifest SHALL have `@zxing/browser` removed from the dependencies section
2. WHEN the Dependency_Auditor runs the cleanup, THE Package_Manifest SHALL have `@zxing/library` removed from the dependencies section
3. WHEN the ZXing packages are removed, THE Frontend_Build SHALL complete without errors
4. WHEN the ZXing packages are removed, THE Frontend_Build SHALL produce a Bundle with no references to `@zxing/browser` or `@zxing/library`

### Requirement 2: Remove Unused MUI Date Pickers Pro

**User Story:** As a developer, I want the MUI date pickers pro package removed, so that the project does not carry an unused commercial-license dependency.

#### Acceptance Criteria

1. WHEN the Dependency_Auditor runs the cleanup, THE Package_Manifest SHALL have `@mui/x-date-pickers-pro` removed from the dependencies section
2. WHEN `@mui/x-date-pickers-pro` is removed, THE Frontend_Build SHALL complete without errors
3. WHEN `@mui/x-date-pickers-pro` is removed, THE components importing from `@mui/x-date-pickers` (ProjectFormDialog, ContainerSharingDialog) SHALL continue to function without changes

### Requirement 3: Retain Required QR Code Libraries

**User Story:** As a developer, I want to confirm that the remaining QR code libraries are each serving a distinct purpose, so that no actively used dependency is accidentally removed.

#### Acceptance Criteria

1. THE Package_Manifest SHALL retain `qrcode` as a dependency because PrintableLabel uses `QRCode.toDataURL()` for canvas-based QR generation
2. THE Package_Manifest SHALL retain `@types/qrcode` as a dependency because it provides TypeScript type definitions for the `qrcode` package
3. THE Package_Manifest SHALL retain `qrcode.react` as a dependency because MfaSetup uses `<QRCodeSVG>` for rendering TOTP QR codes
4. THE Package_Manifest SHALL retain `html5-qrcode` as a dependency because QRCodeScanner and BarcodeScanner use `Html5Qrcode` for camera-based scanning

### Requirement 4: Regenerate Lock File

**User Story:** As a developer, I want the lock file regenerated after dependency removal, so that the resolved dependency tree is consistent with the updated manifest.

#### Acceptance Criteria

1. WHEN dependencies are removed from the Package_Manifest, THE Dependency_Auditor SHALL run `npm install` to regenerate the Lock_File
2. WHEN the Lock_File is regenerated, THE Lock_File SHALL contain no references to removed packages as direct dependencies
3. WHEN the Lock_File is regenerated, THE Frontend_Build SHALL complete successfully using only the Lock_File's resolved dependencies

### Requirement 5: Verify No Runtime Regressions

**User Story:** As a developer, I want to verify that removing unused dependencies does not break any existing functionality, so that the cleanup is safe to ship.

#### Acceptance Criteria

1. WHEN dependencies are removed, THE Frontend_Build SHALL produce a successful production build (`tsc -b && vite build`)
2. WHEN dependencies are removed, THE existing test suite SHALL pass without failures (`npm test` in the frontend directory)
3. IF a previously passing test fails after dependency removal, THEN THE Dependency_Auditor SHALL investigate and resolve the failure before completing the cleanup
