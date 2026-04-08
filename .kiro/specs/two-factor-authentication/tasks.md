# Implementation Plan: Two-Factor Authentication (TOTP)

## Overview

Add optional TOTP-based MFA to the existing Cognito + Amplify auth system. The implementation covers SAM template infrastructure changes, a reusable MFA setup component, sign-in flow modifications for TOTP challenges and forced setup, and profile-page MFA management. All MFA state is managed by Cognito — no backend Lambda changes needed.

## Tasks

- [x] 1. Update SAM template to enable TOTP MFA on Cognito User Pool
  - [x] 1.1 Set `MfaConfiguration` to `OPTIONAL` and add `SOFTWARE_TOKEN_MFA` to `EnabledMfas`
    - Replace the conditional `MfaConfiguration: !If [EnableMFA, 'ON', 'OFF']` with `MfaConfiguration: 'OPTIONAL'`
    - Add `EnabledMfas: - SOFTWARE_TOKEN_MFA` to the UserPool resource
    - Keep the existing `SmsConfiguration` and `CognitoSMSRole` intact for future use
    - Remove the production-only gating so TOTP is available in all environments
    - Preserve existing `ExplicitAuthFlows` on the UserPoolClient (`ALLOW_USER_SRP_AUTH`, `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create the reusable MfaSetup component
  - [x] 2.1 Install `qrcode.react` dependency and create `frontend/src/components/MfaSetup.tsx`
    - Install `qrcode.react` package
    - Create `MfaSetup` component accepting `MfaSetupProps` (optional `totpSetupDetails`, `onSetupComplete`, `onCancel`)
    - Implement step 1: call `setUpTOTP()` (or use provided `totpSetupDetails`) to get the TOTP secret
    - Build the `otpauth://totp/{appName}:{username}?secret={secret}&issuer={appName}` URI
    - Render QR code via `QRCodeSVG` from `qrcode.react` and display the raw secret as copyable text
    - Implement step 2: 6-digit code input field that strips non-numeric characters and truncates to 6 digits
    - On submit, call `verifyTOTPSetup({ code })`, then `updateMFAPreference({ totp: 'PREFERRED' })`
    - Handle errors: show MUI `Alert` for invalid code, allow retry without regenerating QR code
    - Show confirmation message on success, invoke `onSetupComplete`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Write property test: TOTP URI format correctness
    - **Property 1: TOTP URI format correctness**
    - Extract the URI-building logic into a pure helper function (e.g., `buildTotpUri`)
    - Using `fast-check`, generate random secret strings and usernames, build the URI, assert it matches `otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}` with correct encoding
    - **Validates: Requirements 2.2**

  - [ ]* 2.3 Write property test: TOTP input sanitization
    - **Property 2: TOTP input field accepts only 6-digit numeric codes**
    - Extract the input sanitization logic into a pure helper function (e.g., `sanitizeTotpCode`)
    - Using `fast-check`, generate arbitrary strings, pass through sanitization, assert output matches `/^\d{0,6}$/`
    - **Validates: Requirements 3.2**

  - [ ]* 2.4 Write unit tests for MfaSetup component
    - Test that `setUpTOTP` is called on mount when no `totpSetupDetails` provided
    - Test that QR code and secret text are rendered after setup
    - Test that `verifyTOTPSetup` and `updateMFAPreference` are called on valid code submit
    - Test error display on invalid code
    - Test cancel callback
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create MfaStatusSection component for the Profile page
  - [x] 4.1 Create `frontend/src/components/MfaStatusSection.tsx`
    - On mount, call `fetchMFAPreference()` to determine current MFA status
    - If MFA not enabled: show "Set up MFA" button that opens `MfaSetup`
    - If MFA enabled: show "MFA Active" status chip and "Disable MFA" button
    - Disable action calls `updateMFAPreference({ totp: 'DISABLED' })` and refreshes status
    - Handle errors with MUI `Alert` and retry capability
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.2 Write unit tests for MfaStatusSection component
    - Test `fetchMFAPreference` called on mount
    - Test setup button shown when MFA disabled
    - Test active status shown when MFA enabled
    - Test disable calls `updateMFAPreference` and refreshes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Integrate MfaStatusSection into UserProfile page
  - [x] 5.1 Add `MfaStatusSection` to `frontend/src/pages/UserProfile.tsx`
    - Import and render `MfaStatusSection` below the existing `UserProfileView` component
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Handle forced TOTP setup during sign-in
  - [x] 6.1 Update `CONTINUE_SIGN_IN_WITH_TOTP_SETUP` handling in `frontend/src/components/SignIn.tsx`
    - Replace the error message for `CONTINUE_SIGN_IN_WITH_TOTP_SETUP` with a new challenge state (e.g., `TOTP_SETUP`)
    - Extract `totpSetupDetails` (secretCode, username) from the sign-in response `result.nextStep`
    - Render the `MfaSetup` component inline, passing the setup details
    - On `MfaSetup` completion, call `confirmSignIn({ challengeResponse: code })` and navigate to home
    - Handle invalid code errors and session expiry (reset to credentials form with message)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 3.6_

  - [ ]* 6.2 Write unit tests for forced TOTP setup in SignIn
    - Test `MfaSetup` renders on `CONTINUE_SIGN_IN_WITH_TOTP_SETUP` challenge
    - Test setup details are passed from sign-in response
    - Test navigation to home on successful completion
    - Test error display on invalid code
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Final wiring and integration verification
  - [x] 8.1 Verify existing TOTP sign-in challenge handling in SignIn.tsx
    - Confirm the existing `CONFIRM_SIGN_IN_WITH_TOTP_CODE` / `TOTP_MFA` challenge flow works correctly with the 6-digit input sanitization
    - Ensure `CodeMismatchException` and `NotAuthorizedException` error handling is consistent
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 8.2 Write integration tests for end-to-end MFA flows
    - Test full MFA setup flow with mocked Amplify APIs (setup → QR display → verify → enable)
    - Test sign-in with MFA challenge using mocked Amplify APIs
    - Test profile MFA toggle (enable → verify active → disable → verify inactive)
    - _Requirements: 2.1–2.7, 3.1–3.5, 4.1–4.6, 5.1–5.5_

- [x] 9. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All MFA state is managed by Cognito — no new database tables or backend Lambda changes
- The existing TOTP sign-in challenge handling in SignIn.tsx already works; task 8.1 is a verification pass
- Property tests validate the TOTP URI builder and input sanitization as pure functions using `fast-check`
