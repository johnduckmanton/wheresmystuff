# User Management Components

This document describes the new user management components added to support email-based user lookup, invitations, and user profile management.

## Components

### 1. UserLookupDialog

**Purpose**: Search for users by email address to add them to an inventory.

**Props**:
- `open: boolean` - Controls dialog visibility
- `onClose: () => void` - Called when dialog is closed
- `onUserSelect: (user: UserLookupResult) => void` - Called when a user is selected
- `title?: string` - Optional custom title
- `description?: string` - Optional custom description

**Features**:
- Email validation with real-time feedback
- Search functionality with loading states
- Display user information when found
- Clear messaging when user not found
- Suggestion to send invitation if user doesn't exist

**Usage**:
```tsx
import UserLookupDialog from './UserLookupDialog';

<UserLookupDialog
  open={lookupOpen}
  onClose={() => setLookupOpen(false)}
  onUserSelect={(user) => {
    if (user.found && user.userId) {
      // Add user to inventory
      addMember(user.userId);
    }
  }}
/>
```

### 2. InviteUserDialog

**Purpose**: Send email invitations to users who don't have accounts yet.

**Props**:
- `open: boolean` - Controls dialog visibility
- `onClose: () => void` - Called when dialog is closed
- `onInvitationSent: (invitation: Invitation) => void` - Called when invitation is sent
- `inventoryId: string` - ID of the inventory
- `inventoryName: string` - Name of the inventory (for email)
- `inviterName: string` - Name of the person sending invitation (for email)

**Features**:
- Email validation
- Role selection (member, administrator, read_only)
- Role descriptions to help users choose
- Success feedback with auto-close
- Information about invitation expiry (7 days)

**Usage**:
```tsx
import InviteUserDialog from './InviteUserDialog';

<InviteUserDialog
  open={inviteOpen}
  onClose={() => setInviteOpen(false)}
  onInvitationSent={(invitation) => {
    console.log('Invitation sent:', invitation);
    refreshInvitations();
  }}
  inventoryId={currentInventoryId}
  inventoryName="My Home Inventory"
  inviterName="John Doe"
/>
```

### 3. InvitationStatusManager

**Purpose**: Display and manage pending invitations for an inventory.

**Props**:
- `inventoryId: string` - ID of the inventory
- `onInvitationChange?: () => void` - Optional callback when invitations change

**Features**:
- Lists all pending invitations
- Shows invitation status (pending, accepted, cancelled, expired)
- Displays role and expiry information
- Warning for invitations expiring soon (2 days or less)
- Cancel invitation functionality
- Refresh button to reload invitations

**Usage**:
```tsx
import InvitationStatusManager from './InvitationStatusManager';

<InvitationStatusManager
  inventoryId={currentInventoryId}
  onInvitationChange={() => {
    // Refresh member list or other data
    refreshMembers();
  }}
/>
```

### 4. UserProfileView

**Purpose**: Display user profile information with copyable User ID.

**Props**:
- `userId?: string` - Optional user ID (defaults to current user)
- `editable?: boolean` - Whether profile can be edited (default: true)
- `onProfileUpdate?: (profile: UserProfile) => void` - Called when profile is updated

**Features**:
- Display name editing
- Email address with verification status
- Copyable User ID with visual feedback
- Account information (status, creation date, last login)
- Helpful context about User ID usage

**Usage**:
```tsx
import UserProfileView from './UserProfileView';

<UserProfileView
  editable={true}
  onProfileUpdate={(profile) => {
    console.log('Profile updated:', profile);
  }}
/>
```

### 5. Enhanced AddMemberDialog

**Purpose**: Unified dialog for adding members via email lookup or User ID.

**Props**:
- `open: boolean` - Controls dialog visibility
- `onClose: () => void` - Called when dialog is closed
- `onSubmit: (userId: string, role?: string) => void` - Called when member is added
- `onInvitationSent?: (invitation: Invitation) => void` - Called when invitation is sent
- `existingMemberIds: string[]` - Array of existing member IDs to prevent duplicates
- `inventoryId?: string` - ID of the inventory (required for invitations)
- `inventoryName?: string` - Name of the inventory (required for invitations)
- `inviterName?: string` - Name of the inviter (required for invitations)

**Features**:
- Tabbed interface: "Search by Email" and "Add by User ID"
- Email tab integrates UserLookupDialog and InviteUserDialog
- User ID tab provides traditional UUID input
- Role selection for both methods
- Duplicate member detection
- Validation and error handling

**Usage**:
```tsx
import AddMemberDialog from './AddMemberDialog';

<AddMemberDialog
  open={addMemberOpen}
  onClose={() => setAddMemberOpen(false)}
  onSubmit={(userId, role) => {
    addMemberToInventory(userId, role);
  }}
  onInvitationSent={(invitation) => {
    console.log('Invitation sent:', invitation);
  }}
  existingMemberIds={members.map(m => m.userId)}
  inventoryId={currentInventoryId}
  inventoryName="My Home Inventory"
  inviterName="John Doe"
/>
```

## API Methods

The following API methods have been added to support these components:

### User Management
- `lookupUserByEmail(email: string): Promise<UserLookupResult>`
- `getUserProfile(userId?: string): Promise<UserProfile>`
- `updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile>`

### Invitation Management
- `getInvitations(inventoryId: string): Promise<Invitation[]>`
- `createInvitation(inventoryId: string, data: {...}): Promise<Invitation>`
- `cancelInvitation(inventoryId: string, invitationId: string): Promise<void>`

### Member Role Management
- `updateMemberRole(inventoryId: string, userId: string, role: string, reason?: string): Promise<InventoryMembership>`

## Types

New types have been added to support user management:

```typescript
interface UserProfile {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  emailVerified: boolean;
  userStatus: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  found?: boolean;
}

interface UserLookupResult {
  found: boolean;
  userId?: string;
  email?: string;
  username?: string;
  displayName?: string;
  emailVerified?: boolean;
  userStatus?: string;
  message?: string;
}

interface Invitation {
  invitationId: string;
  inventoryId: string;
  email: string;
  role: 'member' | 'administrator' | 'read_only';
  invitedBy: string;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
}
```

## Integration Example

Here's a complete example of integrating these components into an inventory members page:

```tsx
import { useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import AddMemberDialog from './AddMemberDialog';
import InvitationStatusManager from './InvitationStatusManager';
import UserProfileView from './UserProfileView';

function InventoryMembersPage({ inventoryId, inventoryName, currentUser }) {
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [members, setMembers] = useState([]);

  const handleAddMember = async (userId: string, role?: string) => {
    // Add member to inventory
    await apiClient.addInventoryMember(inventoryId, userId);
    // Optionally update role if specified
    if (role && role !== 'member') {
      await apiClient.updateMemberRole(inventoryId, userId, role);
    }
    // Refresh members list
    loadMembers();
    setAddMemberOpen(false);
  };

  return (
    <Box>
      <Stack spacing={3}>
        {/* User Profile Section */}
        <UserProfileView />

        {/* Add Member Button */}
        <Button
          variant="contained"
          onClick={() => setAddMemberOpen(true)}
        >
          Add Member
        </Button>

        {/* Pending Invitations */}
        <InvitationStatusManager
          inventoryId={inventoryId}
          onInvitationChange={loadMembers}
        />

        {/* Members List */}
        {/* ... existing members list ... */}
      </Stack>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onSubmit={handleAddMember}
        onInvitationSent={(invitation) => {
          console.log('Invitation sent:', invitation);
        }}
        existingMemberIds={members.map(m => m.userId)}
        inventoryId={inventoryId}
        inventoryName={inventoryName}
        inviterName={currentUser.displayName}
      />
    </Box>
  );
}
```

## Requirements Validation

These components validate the following requirements:

- **Requirement 1.1**: Email-based user lookup with validation
- **Requirement 1.2**: Adding users by email with role assignment
- **Requirement 1.3**: Sending invitations to non-existent users
- **Requirement 1.4**: Storing and tracking pending invitations
- **Requirement 1.5**: Invitation expiration and processing
- **Requirement 3.1**: User lookup by email with Cognito integration
- **Requirement 3.2**: Returning user profile information
- **Requirement 4.1**: Displaying User ID in profile
- **Requirement 4.3**: Context about User ID usage
- **Requirement 4.4**: Copyable User ID functionality

## Notes

- All components include proper error handling and loading states
- Email validation is performed on both client and server side
- Invitations expire after 7 days (configurable on backend)
- Mock implementations are provided for development mode
- Components follow Material-UI design patterns for consistency
