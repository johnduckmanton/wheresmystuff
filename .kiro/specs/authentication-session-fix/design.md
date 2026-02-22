# Authentication Session Fix Bugfix Design

## Overview

The authentication system experiences session management issues where AWS Amplify/Cognito sessions are not properly cleared during sign-out operations, leading to "There is already a signed in user" errors and preventing successful re-authentication. The fix involves adding the `{ global: true }` option to all `signOut()` calls to ensure both local and server-side sessions are fully cleared. This is a minimal, targeted fix that addresses the root cause without modifying the authentication flow logic.

## Glossary

- **Bug_Condition (C)**: The condition that triggers session management bugs - when signOut is called without the `{ global: true }` option, leaving residual Amplify session state
- **Property (P)**: The desired behavior - signOut with `{ global: true }` fully clears both local and server-side authentication sessions
- **Preservation**: All existing authentication flows (sign-in, MFA, password challenges, error handling) must remain unchanged
- **signOut**: AWS Amplify Auth API function that clears authentication sessions
- **global: true**: Amplify signOut option that clears both local storage and server-side Cognito sessions
- **challengeName**: React state variable tracking the current authentication challenge (NEW_PASSWORD_REQUIRED, SMS_MFA, TOTP_MFA, RESET_PASSWORD_CODE)
- **cancelChallenge**: Function in SignIn.tsx that clears authentication state and returns to the sign-in form

## Bug Details

### Fault Condition

The bug manifests when `signOut()` is called without the `{ global: true }` option in any of three locations: the `cancelChallenge` function in SignIn.tsx, the MFA error handler in SignIn.tsx, or the `handleSignOut` function in Header.tsx. Without this option, Amplify clears only local session data but leaves server-side Cognito session tokens active, causing subsequent sign-in attempts to fail with "There is already a signed in user" errors.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SignOutContext
  OUTPUT: boolean
  
  RETURN input.functionName IN ['cancelChallenge', 'handleMfaVerification.errorHandler', 'handleSignOut']
         AND input.signOutCall.options.global != true
         AND residualSessionExists()
END FUNCTION
```

### Examples

- User enters correct credentials → receives "There is already a signed in user" error instead of signing in (occurs after previous incomplete sign-out)
- User in NEW_PASSWORD_REQUIRED flow clicks Cancel → `cancelChallenge()` calls `signOut()` without global option → residual session remains → next sign-in fails
- User in MFA flow receives expired code → error handler calls `signOut()` without global option → residual session remains → next sign-in fails
- User clicks Sign Out in Header → `handleSignOut()` calls `signOut()` without global option → residual session remains → next sign-in fails
- Edge case: User completes password change successfully → should navigate to home page without session issues (expected behavior - not affected by bug)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Successful sign-in without challenges must continue to navigate directly to the home page
- MFA challenges (SMS and TOTP) must continue to display the appropriate verification forms
- Invalid credentials must continue to display appropriate error messages
- Password reset flow must continue to initiate with verification code
- Authenticated users must continue to see their email in the Header component
- Password validation (length, complexity) must continue to display validation error messages
- All form state management and UI rendering logic must remain unchanged
- Navigation flows between authentication states must remain unchanged

**Scope:**
All authentication logic that does NOT involve calling `signOut()` should be completely unaffected by this fix. This includes:
- Sign-in flow with `signIn()` API calls
- Challenge handling with `confirmSignIn()` API calls
- Password reset with `resetPassword()` and `confirmResetPassword()` API calls
- Form validation and error display logic
- UI rendering and state management
- Navigation logic after successful authentication

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Incomplete Session Clearing**: The `signOut()` function is called without the `{ global: true }` option in three locations:
   - `cancelChallenge()` function in SignIn.tsx (line 313)
   - MFA error handler in `handleMfaVerification()` in SignIn.tsx (line 211)
   - `handleSignOut()` function in Header.tsx (line 63)

2. **Amplify Default Behavior**: By default, `signOut()` only clears local storage tokens but does not invalidate server-side Cognito sessions, leaving the user in a partially authenticated state

3. **Session State Mismatch**: When a new sign-in attempt occurs, Amplify detects the existing server-side session and returns "There is already a signed in user" error instead of allowing the new authentication

4. **Challenge Flow Interruption**: When users cancel authentication challenges or encounter errors, the incomplete sign-out leaves them unable to retry authentication

## Correctness Properties

Property 1: Fault Condition - Complete Session Clearing

_For any_ sign-out operation triggered from cancelChallenge, MFA error handling, or Header sign-out, the fixed signOut function SHALL use the `{ global: true }` option to clear both local and server-side Cognito sessions, allowing subsequent sign-in attempts to succeed without "already signed in" errors.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

Property 2: Preservation - Authentication Flow Behavior

_For any_ authentication operation that does NOT involve calling signOut (sign-in, challenge handling, password reset, form validation), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing authentication flows, error handling, and UI rendering.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `frontend/src/components/SignIn.tsx`

**Function**: `cancelChallenge` (line 313)

**Specific Changes**:
1. **Update signOut call in cancelChallenge**: Change `await signOut();` to `await signOut({ global: true });`
   - This ensures that when users cancel authentication challenges, both local and server-side sessions are fully cleared
   - Prevents "already signed in" errors on subsequent sign-in attempts

2. **Update signOut call in MFA error handler**: In `handleMfaVerification()` function (line 211), change `await cancelChallenge();` to call signOut with global option
   - Actually, `cancelChallenge()` already calls signOut, so fixing cancelChallenge will fix this case
   - Ensures expired MFA codes properly clear sessions

**File**: `frontend/src/components/Header.tsx`

**Function**: `handleSignOut` (line 63)

**Specific Changes**:
3. **Update signOut call in handleSignOut**: Change `await signOut();` to `await signOut({ global: true });`
   - This ensures that when users explicitly sign out from the Header menu, both local and server-side sessions are fully cleared
   - Prevents "already signed in" errors when users sign out and then sign back in

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by attempting sign-in after incomplete sign-out, then verify the fix works correctly with `{ global: true }` option and preserves existing authentication behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that signOut without `{ global: true }` leaves residual sessions that block subsequent sign-in attempts.

**Test Plan**: Write tests that simulate authentication flows followed by sign-out operations, then attempt to sign in again. Run these tests on the UNFIXED code to observe "already signed in" errors and confirm the root cause.

**Test Cases**:
1. **Cancel Challenge Test**: Sign in with temporary password → trigger NEW_PASSWORD_REQUIRED → click Cancel → attempt to sign in again (will fail on unfixed code with "already signed in" error)
2. **Expired MFA Test**: Sign in with MFA enabled → trigger SMS_MFA → wait for code expiration → attempt to sign in again (will fail on unfixed code with "already signed in" error)
3. **Header Sign Out Test**: Sign in successfully → click Sign Out in Header → attempt to sign in again (will fail on unfixed code with "already signed in" error)
4. **Multiple Cancel Test**: Sign in → trigger challenge → cancel → repeat 3 times (may accumulate session state on unfixed code)

**Expected Counterexamples**:
- "There is already a signed in user" error appears when attempting to sign in after incomplete sign-out
- Possible causes: signOut() without global option, residual Cognito session tokens, local/server session mismatch

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (sign-out operations), the fixed function produces the expected behavior (complete session clearing).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := signOut_fixed({ global: true })
  ASSERT noResidualSession()
  ASSERT subsequentSignInSucceeds()
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (authentication operations not involving sign-out), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT authFlow_original(input) = authFlow_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the authentication input domain
- It catches edge cases that manual unit tests might miss (various credential formats, challenge types, error conditions)
- It provides strong guarantees that behavior is unchanged for all non-sign-out authentication operations

**Test Plan**: Observe behavior on UNFIXED code first for sign-in, challenges, and password reset flows, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Sign-In Preservation**: Observe that successful sign-in with valid credentials navigates to home page on unfixed code, then verify this continues after fix
2. **Challenge Flow Preservation**: Observe that NEW_PASSWORD_REQUIRED, SMS_MFA, and TOTP_MFA challenges display correctly on unfixed code, then verify this continues after fix
3. **Error Handling Preservation**: Observe that invalid credentials, expired codes, and validation errors display correctly on unfixed code, then verify this continues after fix
4. **Password Reset Preservation**: Observe that password reset flow with verification code works correctly on unfixed code, then verify this continues after fix

### Unit Tests

- Test sign-out with `{ global: true }` option clears sessions completely
- Test cancelChallenge function clears all form state and authentication session
- Test MFA error handler properly clears session on expired code
- Test Header sign-out navigates to sign-in page after clearing session
- Test subsequent sign-in succeeds after each sign-out scenario
- Test edge case: rapid sign-out/sign-in cycles work correctly

### Property-Based Tests

- Generate random authentication flows (sign-in → challenge → cancel) and verify sign-out always clears sessions completely
- Generate random credential combinations and verify sign-in behavior is unchanged after fix
- Generate random challenge types and verify challenge handling is unchanged after fix
- Test that all error conditions continue to work correctly across many scenarios

### Integration Tests

- Test full flow: sign in → trigger NEW_PASSWORD_REQUIRED → cancel → sign in again successfully
- Test full flow: sign in with MFA → expire code → sign in again successfully
- Test full flow: sign in → use app → sign out from Header → sign in again successfully
- Test that session state is properly cleared across browser refreshes
- Test that multiple users can sign in/out sequentially without session conflicts
