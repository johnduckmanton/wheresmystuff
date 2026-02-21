# Multi-Factor Authentication (MFA) Setup Guide

The application now supports both SMS and TOTP (Time-based One-Time Password) MFA for enhanced security.

## Features Implemented

### ✅ SMS MFA Support
- Users receive a 6-digit code via SMS
- Code entry with numeric keyboard on mobile
- Automatic code validation
- Error handling for expired/invalid codes

### ✅ TOTP MFA Support  
- Compatible with authenticator apps (Google Authenticator, Authy, Microsoft Authenticator, etc.)
- 6-digit code entry
- Time-based validation
- Error handling for expired/invalid codes

### ✅ User Experience
- Clear visual indicators (SMS icon for SMS, Security icon for TOTP)
- Helpful instructions for each MFA type
- "Back to Sign In" option to restart authentication
- Automatic navigation after successful verification
- Mobile-optimized numeric keyboard for code entry

## Enabling MFA in AWS Cognito

### Option 1: Enable MFA for All Users (Recommended for Production)

1. **Open AWS Console** → Navigate to Amazon Cognito
2. **Select your User Pool**
3. **Go to Sign-in experience** tab
4. **Under Multi-factor authentication**, click **Edit**
5. **Select MFA enforcement**:
   - **Required**: All users must use MFA
   - **Optional**: Users can choose to enable MFA
6. **Select MFA methods**:
   - ☑️ SMS message
   - ☑️ Authenticator apps (TOTP)
7. **Configure SMS** (if using SMS MFA):
   - Ensure you have an SNS topic configured
   - Set up IAM role for Cognito to send SMS
8. **Save changes**

### Option 2: Enable MFA for Individual Users

Using AWS CLI:

```bash
# Enable SMS MFA for a user
aws cognito-idp set-user-mfa-preference \
  --username user@example.com \
  --sms-mfa-settings Enabled=true,PreferredMfa=true \
  --user-pool-id YOUR_USER_POOL_ID

# Enable TOTP MFA for a user
aws cognito-idp set-user-mfa-preference \
  --username user@example.com \
  --software-token-mfa-settings Enabled=true,PreferredMfa=true \
  --user-pool-id YOUR_USER_POOL_ID
```

### Option 3: Enable MFA via Admin Script

Create a script to enable MFA for existing users:

```bash
#!/bin/bash
# scripts/enable-mfa-for-user.sh

USER_POOL_ID="your-user-pool-id"
USERNAME="$1"

if [ -z "$USERNAME" ]; then
  echo "Usage: ./enable-mfa-for-user.sh <username>"
  exit 1
fi

# Enable SMS MFA
aws cognito-idp admin-set-user-mfa-preference \
  --username "$USERNAME" \
  --sms-mfa-settings Enabled=true,PreferredMfa=true \
  --user-pool-id "$USER_POOL_ID"

echo "MFA enabled for user: $USERNAME"
```

## SMS MFA Configuration

### Prerequisites
1. **AWS SNS** must be configured in your region
2. **IAM Role** for Cognito to send SMS messages

### Setup Steps

1. **Create IAM Role for SMS**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "*"
    }
  ]
}
```

2. **Attach Role to Cognito User Pool**:
   - Go to User Pool → Messaging
   - Under SMS, select the IAM role
   - Configure SMS settings (sender ID, etc.)

3. **Test SMS Delivery**:
```bash
# Test SMS sending
aws sns publish \
  --phone-number "+1234567890" \
  --message "Test MFA code: 123456"
```

## TOTP MFA Configuration

### No Additional Setup Required
TOTP MFA works out of the box once enabled in Cognito. Users will need:
- An authenticator app (Google Authenticator, Authy, Microsoft Authenticator, 1Password, etc.)
- To scan a QR code during setup (handled by Cognito)

### User Setup Flow
1. User enables TOTP in their account settings
2. Cognito generates a QR code
3. User scans QR code with authenticator app
4. User enters verification code to confirm setup
5. TOTP is now active for future sign-ins

## Testing MFA

### Test SMS MFA
1. Enable SMS MFA for a test user
2. Sign in with email and password
3. App will show "SMS Verification" screen
4. Enter the 6-digit code from SMS
5. Should successfully sign in

### Test TOTP MFA
1. Enable TOTP MFA for a test user
2. Set up authenticator app with the user
3. Sign in with email and password
4. App will show "Authenticator Code" screen
5. Enter the 6-digit code from authenticator app
6. Should successfully sign in

## Error Handling

The app handles these MFA scenarios:

- ✅ **Invalid Code**: Clear error message, allows retry
- ✅ **Expired Code**: Prompts user to sign in again
- ✅ **Code Mismatch**: Specific error for wrong code
- ✅ **Network Errors**: Graceful error handling with retry
- ✅ **Back Navigation**: Users can restart sign-in process

## Security Best Practices

1. **Use TOTP over SMS** when possible (more secure)
2. **Require MFA for admin users** at minimum
3. **Enable MFA for all users** in production
4. **Monitor failed MFA attempts** in CloudWatch
5. **Set up alerts** for suspicious authentication patterns

## Cost Considerations

### SMS MFA Costs
- AWS SNS charges apply for SMS messages
- Approximately $0.00645 per SMS in US
- Consider TOTP to reduce costs

### TOTP MFA Costs
- No additional AWS costs
- Free for users (just need an authenticator app)

## Troubleshooting

### SMS Not Received
1. Check SNS configuration
2. Verify IAM role permissions
3. Check phone number format (+1234567890)
4. Review CloudWatch logs for errors

### TOTP Code Not Working
1. Ensure device time is synchronized
2. Check if code has expired (30-second window)
3. Verify authenticator app is configured correctly
4. Try regenerating TOTP secret

### User Locked Out
```bash
# Disable MFA for a user (emergency)
aws cognito-idp admin-set-user-mfa-preference \
  --username user@example.com \
  --user-pool-id YOUR_USER_POOL_ID \
  --sms-mfa-settings Enabled=false \
  --software-token-mfa-settings Enabled=false
```

## Future Enhancements

Potential additions:
- [ ] MFA setup flow within the app
- [ ] User preference for MFA method selection
- [ ] Remember device functionality
- [ ] Backup codes for account recovery
- [ ] WebAuthn/FIDO2 support

## References

- [AWS Cognito MFA Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html)
- [AWS Amplify Auth MFA](https://docs.amplify.aws/lib/auth/mfa/q/platform/js/)
- [TOTP RFC 6238](https://tools.ietf.org/html/rfc6238)
