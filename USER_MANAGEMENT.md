# User Management Guide

## Overview

The Home Inventory Management System includes comprehensive user management features that allow you to invite users, manage roles, and control access to your inventories. This guide explains how to use these features effectively.

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles and Permissions](#user-roles-and-permissions)
3. [Adding Members to Your Inventory](#adding-members-to-your-inventory)
4. [Managing Invitations](#managing-invitations)
5. [User Profile and User ID](#user-profile-and-user-id)
6. [Managing Member Roles](#managing-member-roles)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Getting Started

### What You Can Do

As an inventory owner or administrator, you can:
- **Invite users by email** - No need to know their User ID
- **Assign roles** - Control what members can do
- **Manage invitations** - Track pending invitations and resend if needed
- **Update permissions** - Change member roles as your needs evolve
- **Share your User ID** - Help others add you to their inventories

### Quick Start

1. Navigate to your inventory's **Members** page
2. Click **Add Member** to invite someone
3. Choose to search by email or add by User ID
4. Select the appropriate role for the new member
5. Send the invitation or add them directly

## User Roles and Permissions

### Role Types

The system supports four distinct roles, each with specific permissions:

#### 🔑 Owner
- **Full control** over the inventory
- Can add and remove members
- Can modify all inventory settings
- Can delete the entire inventory
- Can manage all items
- Can change member roles
- **Note**: Every inventory must have at least one owner

#### 👑 Administrator
- Can add and remove members
- Can modify inventory settings
- Can manage all items (create, edit, delete)
- Can view all member information
- **Cannot** delete the inventory
- **Cannot** change their own role

#### 👤 Member
- Can create, edit, and delete items
- Can view all items in the inventory
- Can view basic member information
- **Cannot** add or remove members
- **Cannot** modify inventory settings
- **Cannot** change roles

#### 👁️ Read-only
- Can **only view** items
- Cannot create, edit, or delete anything
- Cannot view detailed member information
- Cannot access inventory settings
- Ideal for sharing inventory with family members who just need to see what you have

### Permission Matrix

| Action | Owner | Administrator | Member | Read-only |
|--------|-------|---------------|--------|-----------|
| View items | ✅ | ✅ | ✅ | ✅ |
| Create items | ✅ | ✅ | ✅ | ❌ |
| Edit items | ✅ | ✅ | ✅ | ❌ |
| Delete items | ✅ | ✅ | ✅ | ❌ |
| View members | ✅ | ✅ | ✅ (basic) | ❌ |
| Add members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Change roles | ✅ | ✅ | ❌ | ❌ |
| Modify settings | ✅ | ✅ | ❌ | ❌ |
| Delete inventory | ✅ | ❌ | ❌ | ❌ |

## Adding Members to Your Inventory

### Method 1: Search by Email (Recommended)

This is the easiest way to add someone to your inventory:

1. **Open the Add Member dialog**
   - Go to your inventory's Members page
   - Click the **Add Member** button
   - Select the **Search by Email** tab

2. **Enter the email address**
   - Type the person's email address
   - The system validates the format as you type
   - Click **Search** to look up the user

3. **If the user exists**
   - Their profile information will be displayed
   - Select the appropriate role from the dropdown
   - Click **Add Member** to add them immediately
   - They'll have instant access to your inventory

4. **If the user doesn't exist**
   - You'll see a message that the user wasn't found
   - Click **Send Invitation** to invite them
   - They'll receive an email with instructions to create an account
   - Once they sign up, they'll automatically be added to your inventory

### Method 2: Add by User ID

If you know someone's User ID, you can add them directly:

1. **Open the Add Member dialog**
   - Go to your inventory's Members page
   - Click the **Add Member** button
   - Select the **Add by User ID** tab

2. **Enter the User ID**
   - Paste the complete User ID (UUID format)
   - Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - Select the appropriate role

3. **Add the member**
   - Click **Add Member**
   - The user is added immediately
   - No invitation email is sent

### Choosing the Right Role

When adding a member, consider:

- **Owner**: Only for co-owners who need full control
- **Administrator**: For trusted users who help manage the inventory
- **Member**: For regular users who add and manage items
- **Read-only**: For family members who just need to see what you have

**Tip**: Start with a more restrictive role (like Member) and upgrade later if needed.

## Managing Invitations

### Viewing Pending Invitations

1. Navigate to your inventory's **Members** page
2. Look for the **Pending Invitations** section
3. You'll see all invitations that haven't been accepted yet

### Invitation Information

Each invitation shows:
- **Email address** of the invitee
- **Role** they'll receive when they accept
- **Sent date** when the invitation was created
- **Expires** date (invitations expire after 7 days)
- **Status** (pending, accepted, cancelled, expired)

### Expiration Warnings

- Invitations expiring in **2 days or less** show a warning
- Expired invitations are automatically cleaned up
- You can resend an invitation by cancelling and creating a new one

### Cancelling an Invitation

If you need to cancel an invitation:

1. Find the invitation in the Pending Invitations list
2. Click the **Cancel** button
3. Confirm the cancellation
4. The invitation link will no longer work

### Accepting an Invitation

When someone receives an invitation:

1. They receive an email with an invitation link
2. Clicking the link takes them to the acceptance page
3. If they don't have an account, they'll be prompted to sign up
4. If they already have an account, they'll be logged in
5. They click **Accept Invitation** to join the inventory
6. They're automatically added with the specified role

## User Profile and User ID

### Viewing Your Profile

1. Click on your name or profile icon in the header
2. Select **Profile** from the menu
3. Your profile page displays:
   - Display name (editable)
   - Email address
   - User ID (copyable)
   - Account status
   - Account creation date
   - Last login date

### Understanding Your User ID

Your **User ID** is a unique identifier assigned to your account:
- Format: UUID (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- **Never changes** - it's permanent for your account
- Used internally by the system
- Can be shared with others who want to add you to their inventories

### Sharing Your User ID

To share your User ID with someone:

1. Go to your profile page
2. Find the **User ID** field
3. Click the **Copy** button (📋 icon)
4. The User ID is copied to your clipboard
5. Paste it in an email, message, or text to share it

**When to share your User ID**:
- Someone wants to add you to their inventory
- Email-based lookup isn't working
- You prefer not to share your email address

### Editing Your Profile

You can update your display name:

1. Go to your profile page
2. Click the **Edit** button
3. Change your display name
4. Click **Save**
5. Your new name appears throughout the application

**Note**: You cannot change your email address or User ID through the profile page. Contact support if you need to update your email.

## Managing Member Roles

### Viewing Member Roles

On the Members page, you can see:
- Each member's name and email
- Their current role
- When they were added
- Who added them

### Changing a Member's Role

If you're an owner or administrator:

1. Find the member in the members list
2. Click the **Edit Role** button (or role dropdown)
3. Select the new role
4. Optionally add a reason for the change
5. Click **Update Role**
6. The change takes effect immediately

### Role Change Audit Trail

All role changes are logged for security:
- Who made the change
- When it was made
- What the old and new roles were
- Reason for the change (if provided)

### Removing Members

To remove a member from your inventory:

1. Find the member in the members list
2. Click the **Remove** button
3. Confirm the removal
4. The member immediately loses access to the inventory

**Important**: 
- You cannot remove the last owner
- You cannot remove yourself if you're the only owner
- Removed members can be re-added later

## Troubleshooting

### Common Issues and Solutions

#### "User not found" when searching by email

**Possible causes**:
- The user hasn't created an account yet
- The email address is incorrect
- The user registered with a different email

**Solutions**:
- Double-check the email address for typos
- Send an invitation instead - they'll be added when they sign up
- Ask the user for their User ID and add them directly

#### "Invalid email format" error

**Cause**: The email address doesn't match the expected format

**Solution**: 
- Ensure the email has the format: `name@domain.com`
- Check for extra spaces before or after the email
- Verify there are no special characters except @ and .

#### Invitation email not received

**Possible causes**:
- Email is in spam/junk folder
- Email address was incorrect
- Email delivery delay

**Solutions**:
- Check spam/junk folders
- Wait a few minutes for delivery
- Cancel and resend the invitation
- Verify the email address is correct

#### "Invitation expired" error

**Cause**: The invitation link is more than 7 days old

**Solution**:
- Ask the inventory owner to send a new invitation
- Invitations automatically expire for security

#### Cannot change member role

**Possible causes**:
- You don't have permission (must be owner or administrator)
- Trying to change your own role
- Trying to remove the last owner

**Solutions**:
- Ask an owner or administrator to make the change
- You cannot change your own role (security measure)
- Ensure there's at least one other owner before changing roles

#### "Duplicate member" error

**Cause**: The user is already a member of the inventory

**Solution**:
- Check the members list to confirm they're already added
- If you need to change their role, use the Edit Role function instead

### Getting Help

If you encounter issues not covered here:

1. Check the application's error message for specific details
2. Review the [Migration Guide](backend/scripts/USER_MANAGEMENT_MIGRATION.md) if you're upgrading
3. Check the [Component Documentation](frontend/src/components/USER_MANAGEMENT_COMPONENTS.md) for technical details
4. Contact your system administrator

## Best Practices

### Security

1. **Assign minimal necessary permissions**
   - Start with Member or Read-only roles
   - Upgrade to Administrator only when needed
   - Reserve Owner role for co-owners

2. **Review members regularly**
   - Periodically check who has access
   - Remove members who no longer need access
   - Update roles as responsibilities change

3. **Monitor pending invitations**
   - Cancel invitations that weren't accepted
   - Don't leave expired invitations pending
   - Verify email addresses before sending

4. **Protect your User ID**
   - Only share with trusted individuals
   - Don't post publicly
   - Remember it can be used to add you to inventories

### Organization

1. **Use descriptive display names**
   - Help others identify you easily
   - Use your real name or recognizable nickname
   - Keep it professional if sharing with family

2. **Document role assignments**
   - Use the "reason" field when changing roles
   - Keep notes about why someone has specific permissions
   - Helps with future audits

3. **Communicate with members**
   - Let people know when you add them
   - Explain what role they have and why
   - Provide guidance on how to use the system

### Efficiency

1. **Use email-based invitations**
   - Easier than sharing User IDs
   - Works even if the user doesn't have an account yet
   - Automatic addition when they sign up

2. **Batch member additions**
   - Add multiple members at once if possible
   - Prepare a list of emails beforehand
   - Assign roles thoughtfully from the start

3. **Set up administrators early**
   - Don't be the only person who can manage members
   - Designate trusted administrators
   - Distribute management responsibilities

## Role Selection Guide

### When to Use Each Role

#### Use **Owner** for:
- Co-owners of the inventory
- People who need full control
- Those who should be able to delete the inventory
- **Minimum**: At least one owner required

#### Use **Administrator** for:
- Trusted family members who help manage
- People who add/remove members regularly
- Those who need to modify settings
- **Good for**: Shared household inventories

#### Use **Member** for:
- Regular users who add and track items
- People who manage specific categories
- Family members who contribute to the inventory
- **Most common**: Default role for most users

#### Use **Read-only** for:
- People who just need to see what you have
- Insurance agents or appraisers (temporary access)
- Family members who don't add items
- **Good for**: Sharing without modification risk

## Quick Reference

### Adding a Member
1. Members page → Add Member
2. Search by email or enter User ID
3. Select role
4. Add or Send Invitation

### Changing a Role
1. Members page → Find member
2. Edit Role → Select new role
3. Add reason (optional)
4. Update Role

### Cancelling an Invitation
1. Members page → Pending Invitations
2. Find invitation → Cancel
3. Confirm cancellation

### Sharing Your User ID
1. Profile page
2. Copy User ID button
3. Share via email/message

### Accepting an Invitation
1. Click link in email
2. Sign up or log in
3. Accept Invitation button
4. Access inventory

## Additional Resources

- **Component Documentation**: [USER_MANAGEMENT_COMPONENTS.md](frontend/src/components/USER_MANAGEMENT_COMPONENTS.md)
- **Migration Guide**: [USER_MANAGEMENT_MIGRATION.md](backend/scripts/USER_MANAGEMENT_MIGRATION.md)
- **Requirements**: [requirements.md](.kiro/specs/user-management-enhancement/requirements.md)
- **Design Document**: [design.md](.kiro/specs/user-management-enhancement/design.md)

## Feedback

This user management system is designed to make sharing inventories easy and secure. If you have suggestions for improvements or encounter issues, please provide feedback to help us enhance the system.
