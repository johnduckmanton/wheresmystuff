# User Management Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the user management system.

## Table of Contents

1. [User Lookup Issues](#user-lookup-issues)
2. [Invitation Problems](#invitation-problems)
3. [Permission and Role Issues](#permission-and-role-issues)
4. [User ID Problems](#user-id-problems)
5. [Email Delivery Issues](#email-delivery-issues)
6. [Migration Issues](#migration-issues)
7. [API and Network Errors](#api-and-network-errors)
8. [Data Consistency Issues](#data-consistency-issues)

## User Lookup Issues

### Problem: "User not found" when searching by email

**Symptoms**:
- Searching for a user by email returns "User not found"
- You know the user has an account

**Possible Causes**:
1. User registered with a different email address
2. Email address has a typo
3. User account hasn't been created yet
4. User account is disabled or deleted

**Solutions**:

1. **Verify the email address**:
   ```
   - Check for typos (common: .com vs .co, gmail vs gmial)
   - Verify with the user what email they used to register
   - Check for extra spaces before or after the email
   ```

2. **Try alternative methods**:
   - Ask the user for their User ID from their profile page
   - Use "Add by User ID" instead of email lookup
   - Send an invitation if they don't have an account yet

3. **Check user account status**:
   - Ask the user to log in to verify their account exists
   - Check if they completed the registration process
   - Verify their email is confirmed in Cognito

**Prevention**:
- Always double-check email addresses before searching
- Ask users to copy-paste their email from their profile
- Use User ID for critical additions

---

### Problem: "Invalid email format" error

**Symptoms**:
- Error message appears when entering an email
- Cannot proceed with search or invitation

**Possible Causes**:
1. Email doesn't match expected format
2. Special characters in email
3. Missing @ or domain
4. Extra whitespace

**Solutions**:

1. **Check email format**:
   ```
   Valid:   user@example.com
   Invalid: user@example
   Invalid: @example.com
   Invalid: user example@domain.com
   ```

2. **Remove extra characters**:
   - Trim whitespace from beginning and end
   - Remove any line breaks or tabs
   - Check for invisible characters

3. **Use standard email format**:
   - Must have: username@domain.extension
   - Example: john.doe@company.com

**Prevention**:
- Copy-paste emails from reliable sources
- Use the validation feedback in the UI
- Test with a known-good email first

---

### Problem: Search is slow or times out

**Symptoms**:
- Search takes a long time to complete
- Request times out with no result
- Loading spinner never stops

**Possible Causes**:
1. Network connectivity issues
2. Cognito API rate limiting
3. Backend service problems
4. Large user pool query

**Solutions**:

1. **Check network connection**:
   ```bash
   # Test connectivity
   ping api.yourdomain.com
   
   # Check if API is responding
   curl https://api.yourdomain.com/health
   ```

2. **Wait and retry**:
   - Wait 30 seconds and try again
   - Refresh the page and retry
   - Try from a different network

3. **Check rate limits**:
   - If you've done many searches, wait a few minutes
   - Rate limits reset after a short period
   - Contact admin if consistently hitting limits

**Prevention**:
- Don't perform rapid successive searches
- Use User ID method if you have it
- Cache user information when possible

---

## Invitation Problems

### Problem: Invitation email not received

**Symptoms**:
- User doesn't receive invitation email
- Email was sent successfully according to UI
- No error messages

**Possible Causes**:
1. Email in spam/junk folder
2. Email address incorrect
3. Email delivery delay
4. Email service configuration issue

**Solutions**:

1. **Check spam/junk folders**:
   - Look in spam, junk, and promotions folders
   - Add sender to safe senders list
   - Check email filters and rules

2. **Verify email address**:
   - Confirm the email address is correct
   - Check for typos in the invitation
   - Cancel and resend with correct email

3. **Wait for delivery**:
   - Email can take 5-10 minutes to arrive
   - Check again after 15 minutes
   - Try resending if not received after 30 minutes

4. **Check email service**:
   ```bash
   # For administrators: Check SES sending status
   aws ses get-send-statistics
   
   # Check for bounces
   aws ses list-identities
   ```

**Prevention**:
- Always verify email addresses before sending
- Ask users to check spam folders proactively
- Test with your own email first

---

### Problem: "Invitation expired" error

**Symptoms**:
- User clicks invitation link
- Gets "invitation expired" error
- Cannot accept invitation

**Possible Causes**:
1. Invitation is more than 7 days old
2. Invitation was cancelled
3. Invitation was already accepted

**Solutions**:

1. **Request new invitation**:
   - Contact the inventory owner
   - Ask them to send a new invitation
   - Accept it within 7 days

2. **Check invitation status**:
   - Owner can check pending invitations
   - Verify invitation wasn't cancelled
   - Confirm it wasn't already accepted

3. **For owners - resend invitation**:
   ```
   1. Go to Members page
   2. Find the expired invitation
   3. Cancel it
   4. Send a new invitation
   ```

**Prevention**:
- Accept invitations promptly (within 7 days)
- Set calendar reminder when receiving invitation
- Owners: monitor pending invitations regularly

---

### Problem: Cannot cancel invitation

**Symptoms**:
- Cancel button doesn't work
- Error when trying to cancel
- Invitation still shows as pending

**Possible Causes**:
1. Invitation already accepted
2. Insufficient permissions
3. Network error
4. Invitation already expired

**Solutions**:

1. **Check invitation status**:
   - Refresh the page
   - Verify invitation is still pending
   - Check if user already accepted

2. **Verify permissions**:
   - Must be owner or administrator
   - Cannot cancel if you're not the inviter (unless owner)
   - Check your role in the inventory

3. **Try again**:
   - Refresh the page
   - Wait a moment and retry
   - Check browser console for errors

**Prevention**:
- Only send invitations you intend to keep active
- Monitor pending invitations regularly
- Clean up expired invitations promptly

---

## Permission and Role Issues

### Problem: "Insufficient permissions" error

**Symptoms**:
- Cannot perform an action
- Error message about permissions
- Features are disabled or hidden

**Possible Causes**:
1. Your role doesn't have required permissions
2. Trying to modify your own role
3. Trying to remove last owner
4. Role was recently changed

**Solutions**:

1. **Check your role**:
   ```
   1. Go to Members page
   2. Find your name in the list
   3. Check your current role
   4. Compare with required permissions
   ```

2. **Request role upgrade**:
   - Contact inventory owner or administrator
   - Explain what you need to do
   - Ask for appropriate role assignment

3. **Use alternative method**:
   - Ask someone with permissions to do it
   - Owner can perform all actions
   - Administrator can do most management tasks

**Permission Reference**:
```
Action                  | Owner | Admin | Member | Read-only
------------------------|-------|-------|--------|----------
View items              |   ✓   |   ✓   |   ✓    |     ✓
Create/edit items       |   ✓   |   ✓   |   ✓    |     ✗
Delete items            |   ✓   |   ✓   |   ✓    |     ✗
Add members             |   ✓   |   ✓   |   ✗    |     ✗
Remove members          |   ✓   |   ✓   |   ✗    |     ✗
Change roles            |   ✓   |   ✓   |   ✗    |     ✗
Modify settings         |   ✓   |   ✓   |   ✗    |     ✗
Delete inventory        |   ✓   |   ✗   |   ✗    |     ✗
```

**Prevention**:
- Understand your role's permissions
- Request appropriate role from the start
- Don't try to perform actions outside your role

---

### Problem: Cannot change member role

**Symptoms**:
- Role dropdown is disabled
- Error when trying to update role
- Changes don't save

**Possible Causes**:
1. You don't have permission (must be owner/admin)
2. Trying to change your own role
3. Trying to remove last owner
4. Member no longer exists

**Solutions**:

1. **Verify you can change roles**:
   - Must be owner or administrator
   - Cannot change your own role
   - Cannot remove last owner role

2. **For self-role changes**:
   - Ask another owner or administrator
   - They can change your role
   - Security measure to prevent accidents

3. **For last owner issue**:
   - Assign owner role to someone else first
   - Then you can change the original owner's role
   - Always maintain at least one owner

**Prevention**:
- Have multiple owners for important inventories
- Plan role changes carefully
- Communicate with other administrators

---

### Problem: Member has wrong permissions

**Symptoms**:
- Member can do things they shouldn't
- Member cannot do things they should
- Permissions don't match role

**Possible Causes**:
1. Role was recently changed (cache issue)
2. Data migration incomplete
3. Permission calculation error
4. Multiple roles assigned (data corruption)

**Solutions**:

1. **Refresh and verify**:
   ```
   1. Have member log out and log back in
   2. Clear browser cache
   3. Check role on Members page
   4. Verify permissions match role
   ```

2. **Update role**:
   - Change role to something else
   - Change it back to desired role
   - This recalculates permissions

3. **For administrators - check data**:
   ```bash
   # Check membership record in DynamoDB
   aws dynamodb get-item \
     --table-name home-inventory-dev \
     --key '{"pk":{"S":"INVENTORY#<id>"},"sk":{"S":"MEMBER#<userId>"}}'
   ```

**Prevention**:
- Run data migration after upgrades
- Test permissions after role changes
- Monitor audit logs for anomalies

---

## User ID Problems

### Problem: Cannot copy User ID

**Symptoms**:
- Copy button doesn't work
- Nothing copied to clipboard
- Error when clicking copy

**Possible Causes**:
1. Browser clipboard permissions
2. HTTPS requirement not met
3. Browser compatibility issue
4. JavaScript error

**Solutions**:

1. **Check browser permissions**:
   - Allow clipboard access when prompted
   - Check browser settings for clipboard permissions
   - Try in a different browser

2. **Manual copy**:
   - Select the User ID text manually
   - Right-click and choose Copy
   - Or use Ctrl+C (Cmd+C on Mac)

3. **Check HTTPS**:
   - Clipboard API requires HTTPS
   - Verify you're using https:// not http://
   - Contact admin if site isn't using HTTPS

**Prevention**:
- Use modern browsers (Chrome, Firefox, Safari, Edge)
- Ensure site uses HTTPS
- Grant clipboard permissions when asked

---

### Problem: User ID not displayed

**Symptoms**:
- User ID field is empty
- Shows "Loading..." indefinitely
- Error message instead of User ID

**Possible Causes**:
1. Not logged in
2. User profile not created
3. API error
4. Network issue

**Solutions**:

1. **Verify login**:
   - Make sure you're logged in
   - Refresh the page
   - Log out and log back in

2. **Check profile creation**:
   ```bash
   # For administrators: Verify user profile exists
   aws dynamodb get-item \
     --table-name home-inventory-dev \
     --key '{"pk":{"S":"USER#<userId>"},"sk":{"S":"PROFILE"}}'
   ```

3. **Run migration** (if upgrading):
   ```bash
   cd backend/scripts
   ./run-user-management-migration.sh
   ```

**Prevention**:
- Run migration after system upgrades
- Verify profile creation for new users
- Monitor user profile creation logs

---

## Email Delivery Issues

### Problem: All invitation emails failing

**Symptoms**:
- No invitation emails being delivered
- Multiple users report not receiving emails
- System shows emails sent successfully

**Possible Causes**:
1. SES sending limits reached
2. SES in sandbox mode
3. Email service configuration error
4. Domain verification issues

**Solutions**:

1. **Check SES status** (administrators):
   ```bash
   # Check sending quota
   aws ses get-send-quota
   
   # Check if in sandbox
   aws ses get-account-sending-enabled
   
   # Verify domain/email
   aws ses list-verified-email-addresses
   ```

2. **Request limit increase**:
   - If in sandbox mode, request production access
   - If limits reached, request quota increase
   - Contact AWS support

3. **Verify email configuration**:
   - Check FROM email is verified in SES
   - Verify domain if using custom domain
   - Check DKIM and SPF records

**Prevention**:
- Move SES out of sandbox mode for production
- Monitor sending quotas
- Set up CloudWatch alarms for bounces

---

### Problem: Emails going to spam

**Symptoms**:
- Invitation emails consistently in spam
- Users report emails in junk folder
- Email delivery works but marked as spam

**Possible Causes**:
1. Missing SPF/DKIM records
2. Poor sender reputation
3. Email content triggers spam filters
4. No DMARC policy

**Solutions**:

1. **Configure email authentication**:
   ```
   Add to DNS:
   - SPF record: v=spf1 include:amazonses.com ~all
   - DKIM records: (provided by SES)
   - DMARC record: v=DMARC1; p=quarantine; rua=mailto:admin@domain.com
   ```

2. **Improve email content**:
   - Use plain text or simple HTML
   - Avoid spam trigger words
   - Include unsubscribe link
   - Use verified sender address

3. **Build sender reputation**:
   - Start with low volume
   - Gradually increase sending
   - Monitor bounce rates
   - Remove invalid addresses

**Prevention**:
- Set up email authentication before going live
- Use reputable sending domain
- Monitor email deliverability metrics
- Test emails before mass sending

---

## Migration Issues

### Problem: Migration script fails

**Symptoms**:
- Migration script exits with error
- Partial migration completed
- Data inconsistencies after migration

**Possible Causes**:
1. Missing environment variables
2. Insufficient permissions
3. Network connectivity issues
4. Data format incompatibilities

**Solutions**:

1. **Check environment variables**:
   ```bash
   # Verify required variables are set
   echo $TABLE_NAME
   echo $USER_POOL_ID
   
   # Set if missing
   export TABLE_NAME=home-inventory-dev
   export USER_POOL_ID=us-east-1_xxxxx
   ```

2. **Verify permissions**:
   ```bash
   # Test DynamoDB access
   aws dynamodb describe-table --table-name home-inventory-dev
   
   # Test Cognito access
   aws cognito-idp list-users --user-pool-id us-east-1_xxxxx --max-results 1
   ```

3. **Run in dry-run mode first**:
   ```bash
   cd backend/scripts
   ./run-user-management-migration.sh --dry-run
   ```

4. **Re-run migration**:
   - Migration is idempotent
   - Safe to run multiple times
   - Will skip already-migrated items

**Prevention**:
- Always run dry-run first
- Backup data before migration
- Test in development environment first
- Monitor migration progress

---

### Problem: User profiles not created

**Symptoms**:
- User lookup fails after migration
- User IDs not displayed
- Profile page shows errors

**Possible Causes**:
1. USER_POOL_ID not provided
2. Cognito permissions missing
3. Migration skipped profile creation
4. Cognito API errors

**Solutions**:

1. **Run profile creation manually**:
   ```bash
   cd backend/scripts
   USER_POOL_ID=us-east-1_xxxxx \
   TABLE_NAME=home-inventory-dev \
   node migrate-user-management.js
   ```

2. **Verify Cognito access**:
   ```bash
   # List users to test access
   aws cognito-idp list-users \
     --user-pool-id us-east-1_xxxxx \
     --limit 1
   ```

3. **Check migration logs**:
   - Look for "USER_POOL_ID not configured" warning
   - Check for Cognito API errors
   - Verify profile creation count

**Prevention**:
- Always provide USER_POOL_ID
- Test Cognito access before migration
- Monitor migration output carefully

---

### Problem: Memberships missing role information

**Symptoms**:
- Members have no role assigned
- Permission errors when accessing inventory
- Role shows as undefined or null

**Possible Causes**:
1. Migration didn't complete
2. New memberships created before migration
3. Data corruption
4. Migration script error

**Solutions**:

1. **Re-run membership migration**:
   ```bash
   cd backend/scripts
   TABLE_NAME=home-inventory-dev \
   node migrate-user-management.js
   ```

2. **Manually assign roles**:
   - Go to Members page
   - Edit each member's role
   - Save to recalculate permissions

3. **Check membership data**:
   ```bash
   # Query membership record
   aws dynamodb get-item \
     --table-name home-inventory-dev \
     --key '{"pk":{"S":"INVENTORY#<id>"},"sk":{"S":"MEMBER#<userId>"}}'
   ```

**Prevention**:
- Complete migration before adding new members
- Validate migration results
- Test member access after migration

---

## API and Network Errors

### Problem: "Network error" when performing actions

**Symptoms**:
- Actions fail with network error
- Intermittent failures
- Some features work, others don't

**Possible Causes**:
1. Internet connectivity issues
2. API Gateway problems
3. CORS configuration errors
4. Backend service down

**Solutions**:

1. **Check connectivity**:
   ```bash
   # Test internet connection
   ping 8.8.8.8
   
   # Test API endpoint
   curl https://api.yourdomain.com/health
   ```

2. **Check browser console**:
   - Open browser developer tools (F12)
   - Look at Console tab for errors
   - Check Network tab for failed requests
   - Look for CORS errors

3. **Verify API status**:
   ```bash
   # Check API Gateway
   aws apigatewayv2 get-apis
   
   # Check Lambda functions
   aws lambda list-functions
   ```

4. **Try different network**:
   - Switch to different WiFi
   - Try mobile data
   - Use VPN if corporate network

**Prevention**:
- Monitor API health
- Set up CloudWatch alarms
- Test from multiple networks
- Implement retry logic

---

### Problem: CORS errors in browser console

**Symptoms**:
- "CORS policy" error in console
- API calls fail from browser
- Works in Postman but not browser

**Possible Causes**:
1. CORS not configured on API
2. Wrong origin in CORS settings
3. Preflight request failing
4. Missing CORS headers

**Solutions**:

1. **Check CORS configuration** (administrators):
   ```yaml
   # In template.yaml
   CorsConfiguration:
     AllowOrigins:
       - https://yourdomain.com
     AllowMethods:
       - GET
       - POST
       - PUT
       - DELETE
       - OPTIONS
     AllowHeaders:
       - Content-Type
       - Authorization
     AllowCredentials: true
   ```

2. **Verify origin**:
   - Check that your domain is in AllowOrigins
   - Include both www and non-www if needed
   - Use * for development (not production)

3. **Check response headers**:
   ```bash
   # Test CORS headers
   curl -H "Origin: https://yourdomain.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://api.yourdomain.com/users/lookup
   ```

**Prevention**:
- Configure CORS before deployment
- Test from actual domain, not localhost
- Include all necessary origins
- Monitor CORS errors in logs

---

## Data Consistency Issues

### Problem: Member appears in list but cannot access inventory

**Symptoms**:
- Member shows in members list
- Member gets "access denied" errors
- Member cannot see inventory items

**Possible Causes**:
1. Membership record incomplete
2. Role not properly set
3. Permissions not calculated
4. Cache inconsistency

**Solutions**:

1. **Refresh membership**:
   - Remove member
   - Re-add member with correct role
   - This recreates the membership record

2. **Update role**:
   - Change role to different value
   - Change back to desired role
   - Forces permission recalculation

3. **Check membership data**:
   ```bash
   # Verify membership record
   aws dynamodb get-item \
     --table-name home-inventory-dev \
     --key '{"pk":{"S":"INVENTORY#<id>"},"sk":{"S":"MEMBER#<userId>"}}'
   ```

4. **Clear caches**:
   - Member logs out and back in
   - Clear browser cache
   - Wait for cache TTL to expire

**Prevention**:
- Use migration script for bulk updates
- Test member access after adding
- Monitor audit logs for access issues

---

### Problem: Duplicate invitations or memberships

**Symptoms**:
- Same user appears multiple times
- Multiple pending invitations for same email
- Errors when trying to add member

**Possible Causes**:
1. Race condition in API
2. User clicked multiple times
3. Data migration created duplicates
4. Manual data manipulation

**Solutions**:

1. **Clean up duplicates**:
   ```bash
   # For administrators: List all memberships
   aws dynamodb query \
     --table-name home-inventory-dev \
     --key-condition-expression "pk = :pk" \
     --expression-attribute-values '{":pk":{"S":"INVENTORY#<id>"}}'
   
   # Delete duplicate records
   aws dynamodb delete-item \
     --table-name home-inventory-dev \
     --key '{"pk":{"S":"INVENTORY#<id>"},"sk":{"S":"MEMBER#<userId>"}}'
   ```

2. **Cancel duplicate invitations**:
   - Go to Pending Invitations
   - Cancel all but one invitation
   - Resend if needed

3. **Prevent future duplicates**:
   - Check for existing membership before adding
   - Use conditional writes in DynamoDB
   - Implement client-side duplicate detection

**Prevention**:
- Disable buttons after clicking
- Check for duplicates before creating
- Use unique constraints where possible
- Test concurrent operations

---

## Getting Additional Help

If you've tried the solutions above and still have issues:

1. **Check the logs**:
   - Browser console (F12 → Console)
   - Network tab for API errors
   - CloudWatch logs for backend errors

2. **Gather information**:
   - Exact error message
   - Steps to reproduce
   - Browser and version
   - When the issue started

3. **Contact support**:
   - Provide error details
   - Include relevant logs
   - Describe what you've tried
   - Mention any recent changes

4. **Review documentation**:
   - [User Management Guide](USER_MANAGEMENT.md)
   - [Migration Guide](backend/scripts/USER_MANAGEMENT_MIGRATION.md)
   - [Component Documentation](frontend/src/components/USER_MANAGEMENT_COMPONENTS.md)

## Diagnostic Commands

For administrators, here are useful diagnostic commands:

```bash
# Check user profile
aws dynamodb get-item \
  --table-name home-inventory-dev \
  --key '{"pk":{"S":"USER#<userId>"},"sk":{"S":"PROFILE"}}'

# Check membership
aws dynamodb get-item \
  --table-name home-inventory-dev \
  --key '{"pk":{"S":"INVENTORY#<id>"},"sk":{"S":"MEMBER#<userId>"}}'

# List all invitations for inventory
aws dynamodb query \
  --table-name home-inventory-dev \
  --index-name GSI1 \
  --key-condition-expression "gsi1pk = :pk" \
  --expression-attribute-values '{":pk":{"S":"INVENTORY#<id>"}}'

# Check Cognito user
aws cognito-idp admin-get-user \
  --user-pool-id us-east-1_xxxxx \
  --username <email>

# Check SES sending stats
aws ses get-send-statistics

# View CloudWatch logs
aws logs tail /aws/lambda/home-inventory-dev-UsersFunction --follow
```

## Prevention Checklist

To avoid common issues:

- [ ] Run migration script after upgrades
- [ ] Test in development before production
- [ ] Backup data before major changes
- [ ] Monitor CloudWatch logs regularly
- [ ] Set up alarms for errors
- [ ] Document custom configurations
- [ ] Test with multiple user roles
- [ ] Verify email delivery works
- [ ] Check CORS configuration
- [ ] Review security settings
- [ ] Keep dependencies updated
- [ ] Test on multiple browsers
- [ ] Validate data after migrations
- [ ] Monitor API rate limits
- [ ] Review audit logs periodically
