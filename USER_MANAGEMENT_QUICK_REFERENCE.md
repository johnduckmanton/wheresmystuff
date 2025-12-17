# User Management Quick Reference

A one-page reference for common user management tasks.

## User Roles at a Glance

| Role | View Items | Edit Items | Manage Members | Modify Settings | Delete Inventory |
|------|-----------|-----------|----------------|-----------------|------------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Administrator** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Member** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Read-only** | ✅ | ❌ | ❌ | ❌ | ❌ |

## Common Tasks

### Add a Member by Email
1. Members page → **Add Member**
2. **Search by Email** tab
3. Enter email → **Search**
4. Select role → **Add Member**

### Send an Invitation
1. Members page → **Add Member**
2. **Search by Email** tab
3. Enter email → **Search**
4. If not found → **Send Invitation**
5. Select role → **Send**

### Add by User ID
1. Members page → **Add Member**
2. **Add by User ID** tab
3. Paste User ID
4. Select role → **Add Member**

### Change Member Role
1. Members page → Find member
2. **Edit Role** button
3. Select new role
4. Add reason (optional) → **Update**

### Remove a Member
1. Members page → Find member
2. **Remove** button
3. **Confirm** removal

### Cancel an Invitation
1. Members page → **Pending Invitations**
2. Find invitation → **Cancel**
3. **Confirm** cancellation

### Share Your User ID
1. Profile page
2. Find **User ID** field
3. Click **Copy** button (📋)
4. Share via email/message

### Accept an Invitation
1. Click link in invitation email
2. Sign up or log in
3. **Accept Invitation** button

## Role Selection Guide

**Choose Owner for:**
- Co-owners who need full control
- People who should delete the inventory

**Choose Administrator for:**
- Trusted family members who help manage
- People who add/remove members regularly

**Choose Member for:**
- Regular users who add and track items
- Most common role for contributors

**Choose Read-only for:**
- People who just need to see items
- Temporary access (insurance, appraisers)

## Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| User not found | Try User ID method or send invitation |
| Invalid email | Check format: name@domain.com |
| Invitation not received | Check spam folder, wait 10 minutes |
| Invitation expired | Request new invitation (expires in 7 days) |
| Can't change role | Must be owner/admin, can't change own role |
| Can't copy User ID | Select text manually and copy |
| Permission denied | Check your role, ask owner for upgrade |

## Important Limits

- **Invitation expiry**: 7 days
- **Expiring soon warning**: 2 days or less
- **Minimum owners**: At least 1 per inventory
- **Email format**: name@domain.com

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Copy User ID | Click copy button |
| Close dialog | Esc |
| Submit form | Enter |

## Email Format Examples

✅ **Valid:**
- user@example.com
- john.doe@company.co.uk
- name+tag@domain.com

❌ **Invalid:**
- user@example (missing extension)
- @example.com (missing username)
- user example@domain.com (space in username)

## User ID Format

- **Format**: UUID
- **Example**: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Length**: 36 characters (32 hex + 4 hyphens)
- **Never changes**: Permanent for your account

## Permission Matrix

### What Each Role Can Do

**Owner:**
- Everything (full control)
- Can delete inventory
- Can change any role

**Administrator:**
- Add/remove members
- Change member roles
- Modify settings
- Manage all items
- Cannot delete inventory

**Member:**
- Create/edit/delete items
- View all items
- View basic member info
- Cannot manage members
- Cannot modify settings

**Read-only:**
- View items only
- No modifications allowed
- Limited member visibility

## Best Practices

✅ **Do:**
- Start with restrictive roles, upgrade later
- Review members regularly
- Cancel unused invitations
- Verify email addresses
- Use email method when possible
- Keep at least 2 owners

❌ **Don't:**
- Share User ID publicly
- Leave expired invitations
- Give owner role unnecessarily
- Remove last owner
- Try to change your own role

## Getting Help

📖 **Full Documentation:**
- [User Management Guide](USER_MANAGEMENT.md)
- [Troubleshooting Guide](USER_MANAGEMENT_TROUBLESHOOTING.md)
- [Migration Guide](backend/scripts/USER_MANAGEMENT_MIGRATION.md)

🔧 **For Technical Issues:**
- Check browser console (F12)
- Review error messages
- Try different browser
- Contact administrator

## Quick Diagnostic Steps

1. **Refresh the page** - Clears temporary issues
2. **Log out and back in** - Refreshes permissions
3. **Clear browser cache** - Removes stale data
4. **Try different browser** - Rules out browser issues
5. **Check network connection** - Ensures API access

## Contact Information

For issues not covered in documentation:
1. Check error message details
2. Review troubleshooting guide
3. Contact inventory owner/administrator
4. Gather logs and error details

---

**Last Updated**: December 2024
**Version**: 1.0
