/**
 * Preservation Property Tests for Authentication Session Fix
 * 
 * **IMPORTANT**: These tests verify that authentication flows NOT involving signOut
 * continue to work correctly after the fix is applied.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 * 
 * Property 2: Preservation - Authentication Flow Behavior
 * 
 * Tests that all authentication operations that do NOT involve calling signOut
 * produce the same behavior before and after the fix.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import SignIn from '../SignIn';

// Mock AWS Amplify Auth
import { vi } from 'vitest';

vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
  confirmSignIn: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { signIn, confirmSignIn, resetPassword, confirmResetPassword } from 'aws-amplify/auth';

describe('Preservation Property Tests: Authentication Flow Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property Test: Successful sign-in with valid credentials navigates to home page
   * 
   * **Validates: Requirement 3.1**
   * 
   * This test verifies that when a user successfully signs in without challenges,
   * the system continues to navigate directly to the home page.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (baseline behavior)
   */
  it('should navigate to home page on successful sign-in without challenges', async () => {
    // Mock successful sign-in
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: true,
      nextStep: { signInStep: 'DONE' }
    } as any);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'ValidPassword123!');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Verify navigation to home page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  /**
   * Property Test: NEW_PASSWORD_REQUIRED challenge displays correctly
   * 
   * **Validates: Requirement 3.2**
   * 
   * This test verifies that when a user encounters a NEW_PASSWORD_REQUIRED challenge,
   * the system continues to display the appropriate password change form.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (baseline behavior)
   */
  it('should display password change form for NEW_PASSWORD_REQUIRED challenge', async () => {
    // Mock NEW_PASSWORD_REQUIRED challenge
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' }
    } as any);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TempPassword123!');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Verify password change form is displayed
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^confirm new password$/i)).toBeInTheDocument();
    });
  });

  /**
   * Property Test: SMS_MFA challenge displays correctly
   * 
   * **Validates: Requirement 3.2**
   * 
   * This test verifies that when a user encounters an SMS_MFA challenge,
   * the system continues to display the appropriate verification form.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (baseline behavior)
   */
  it('should display SMS verification form for SMS_MFA challenge', async () => {
    // Mock SMS_MFA challenge
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_SMS_CODE' }
    } as any);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'ValidPassword123!');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Verify SMS verification form is displayed
    await waitFor(() => {
      expect(screen.getByText(/sms verification/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });
  });

  /**
   * Property Test: TOTP_MFA challenge displays correctly
   * 
   * **Validates: Requirement 3.2**
   * 
   * This test verifies that when a user encounters a TOTP_MFA challenge,
   * the system continues to display the appropriate verification form.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (baseline behavior)
   */
  it('should display TOTP verification form for TOTP_MFA challenge', async () => {
    // Mock TOTP_MFA challenge
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_TOTP_CODE' }
    } as any);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'ValidPassword123!');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Verify TOTP verification form is displayed
    await waitFor(() => {
      expect(screen.getByText(/authenticator code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });
  });

  /**
   * Property Test: Invalid credentials display appropriate error messages
   * 
   * **Validates: Requirement 3.3**
   * 
   * This test verifies that when a user enters invalid credentials,
   * the system continues to display appropriate error messages.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (baseline behavior)
   */
  it('should display error message for NotAuthorizedException', async () => {
    // Mock authentication error
    const error = new Error('Authentication failed');
    (error as any).name = 'NotAuthorizedException';
    vi.mocked(signIn).mockRejectedValue(error);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'WrongPassword123!');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i);
    });
  });

  it('should display error message for UserNotConfirmedException', async () => {
    // Mock authentication error
    const error = new Error('User not confirmed');
    (error as any).name = 'UserNotConfirmedException';
    vi.mocked(signIn).mockRejectedValue(error);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'unconfirmed@example.com');
    await user.type(passwordInput, 'ValidPassword123!');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/check your email and confirm your account/i);
    });
  });

  it('should display error message for UserNotFoundException', async () => {
    // Mock authentication error
    const error = new Error('User not found');
    (error as any).name = 'UserNotFoundException';
    vi.mocked(signIn).mockRejectedValue(error);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'nonexistent@example.com');
    await user.type(passwordInput, 'ValidPassword123!');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/user not found/i);
    });
  });

  /**
   * Property Test: Password reset flow initiates correctly
   * 
   * **Validates: Requirement 3.4**
   * 
   * This test verifies that when a user needs to reset their password,
   * the system continues to initiate the password reset flow with verification code.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (baseline behavior)
   */
  it('should initiate password reset flow with verification code', async () => {
    // Mock RESET_PASSWORD challenge
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'RESET_PASSWORD' }
    } as any);

    // Mock resetPassword response
    vi.mocked(resetPassword).mockResolvedValue({
      isPasswordReset: false,
      nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' }
    } as any);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'reset@example.com');
    await user.type(passwordInput, 'OldPassword123!');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Verify password reset form is displayed
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });
  });

  /**
   * Property Test: Password validation displays error messages
   * 
   * **Validates: Requirement 3.6**
   * 
   * This test verifies that when password validation fails,
   * the system continues to display validation error messages.
   * 
   * EXPECTED OUTCOME: Test PASSES on unfixed code (baseline behavior)
   */
  it('should display validation error for password too short', async () => {
    // Mock NEW_PASSWORD_REQUIRED challenge
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' }
    } as any);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials to trigger challenge
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TempPassword123!');

    // Submit form to get to password change screen
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Wait for password change form
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument();
    });

    // Fill in new password fields with short password
    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm new password$/i);
    
    await user.type(newPasswordInput, 'Short1!');
    await user.type(confirmPasswordInput, 'Short1!');

    // Submit password change
    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    // Verify validation error is displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 12 characters/i);
    });
  });

  it('should display validation error for password missing symbols', async () => {
    // Mock NEW_PASSWORD_REQUIRED challenge
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' }
    } as any);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials to trigger challenge
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TempPassword123!');

    // Submit form to get to password change screen
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Wait for password change form
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument();
    });

    // Fill in new password fields with password missing symbols
    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm new password$/i);
    
    await user.type(newPasswordInput, 'NoSymbolsHere123');
    await user.type(confirmPasswordInput, 'NoSymbolsHere123');

    // Submit password change
    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    // Verify validation error is displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/uppercase, lowercase, numbers, and symbols/i);
    });
  });

  it('should display validation error for password mismatch', async () => {
    // Mock NEW_PASSWORD_REQUIRED challenge
    vi.mocked(signIn).mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' }
    } as any);

    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <SignIn />
      </BrowserRouter>
    );

    // Fill in credentials to trigger challenge
    const emailInput = screen.getByRole('textbox', { name: /email address/i });
    const passwordInput = screen.getByLabelText(/^password$/i);
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'TempPassword123!');

    // Submit form to get to password change screen
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Wait for password change form
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument();
    });

    // Fill in new password fields with mismatched passwords
    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm new password$/i);
    
    await user.type(newPasswordInput, 'ValidPassword123!');
    await user.type(confirmPasswordInput, 'DifferentPassword123!');

    // Submit password change
    const changePasswordButton = screen.getByRole('button', { name: /change password/i });
    await user.click(changePasswordButton);

    // Verify validation error is displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i);
    });
  });
});
