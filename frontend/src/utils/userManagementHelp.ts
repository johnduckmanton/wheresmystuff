/**
 * User Management Help Text and Tooltips
 * 
 * This file contains all help text, tooltips, and contextual information
 * for user management features throughout the application.
 */

export const HELP_TEXT = {
  // User Roles
  roles: {
    owner: {
      title: 'Owner',
      description: 'Full control over the inventory including the ability to delete it. Every inventory must have at least one owner.',
      permissions: [
        'Add and remove members',
        'Modify all settings',
        'Delete the inventory',
        'Manage all items',
        'Change member roles'
      ]
    },
    administrator: {
      title: 'Administrator',
      description: 'Can manage members and settings but cannot delete the inventory.',
      permissions: [
        'Add and remove members',
        'Modify settings',
        'Manage all items',
        'View all member information',
        'Cannot delete inventory'
      ]
    },
    member: {
      title: 'Member',
      description: 'Can manage items but cannot modify settings or manage members.',
      permissions: [
        'Create, edit, and delete items',
        'View all items',
        'View basic member information',
        'Cannot manage members or settings'
      ]
    },
    read_only: {
      title: 'Read-only',
      description: 'Can only view items. Cannot make any changes.',
      permissions: [
        'View items only',
        'Cannot create, edit, or delete',
        'Cannot view detailed member information',
        'Cannot access settings'
      ]
    }
  },

  // User Lookup
  userLookup: {
    title: 'Search for User by Email',
    description: 'Enter the email address of the person you want to add to your inventory. If they have an account, you can add them immediately. If not, you can send them an invitation.',
    emailPlaceholder: 'Enter email address',
    searchButton: 'Search for this user',
    notFound: 'User not found. You can send them an invitation to join.',
    found: 'User found! Select a role and add them to your inventory.',
    invalidEmail: 'Please enter a valid email address (e.g., name@example.com)',
    tips: [
      'Make sure the email address is correct',
      'The user must have registered with this email',
      'If not found, you can send an invitation instead'
    ]
  },

  // Invitations
  invitations: {
    title: 'Send Invitation',
    description: 'Send an email invitation to someone who doesn\'t have an account yet. They\'ll receive instructions to sign up and will automatically be added to your inventory.',
    emailLabel: 'Email Address',
    roleLabel: 'Role',
    sendButton: 'Send Invitation',
    cancelButton: 'Cancel',
    successMessage: 'Invitation sent successfully! They will receive an email with instructions.',
    expiryNote: 'Invitations expire after 7 days for security.',
    pending: {
      title: 'Pending Invitations',
      description: 'These invitations have been sent but not yet accepted.',
      empty: 'No pending invitations',
      expiresIn: 'Expires in',
      expiresSoon: 'Expires soon! Consider resending.',
      expired: 'This invitation has expired',
      cancelConfirm: 'Are you sure you want to cancel this invitation? The link will no longer work.'
    },
    acceptance: {
      title: 'Accept Invitation',
      description: 'You\'ve been invited to join an inventory. Accept to get access.',
      acceptButton: 'Accept Invitation',
      invalidToken: 'This invitation link is invalid or has expired.',
      alreadyAccepted: 'You\'ve already accepted this invitation.',
      successMessage: 'Welcome! You now have access to the inventory.'
    }
  },

  // User ID
  userId: {
    title: 'Your User ID',
    description: 'This is your unique identifier in the system. You can share this with others who want to add you to their inventories.',
    copyButton: 'Copy to clipboard',
    copiedMessage: 'User ID copied to clipboard!',
    whatIsIt: 'What is a User ID?',
    explanation: 'Your User ID is a unique identifier (UUID) that never changes. It\'s used internally by the system and can be shared with others who want to add you to their inventories using the "Add by User ID" method.',
    whenToShare: [
      'Someone wants to add you to their inventory',
      'Email-based lookup isn\'t working',
      'You prefer not to share your email address'
    ],
    format: 'Format: UUID (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890)'
  },

  // Add Member
  addMember: {
    title: 'Add Member to Inventory',
    description: 'Add someone to your inventory by searching for their email or entering their User ID.',
    tabs: {
      email: {
        label: 'Search by Email',
        description: 'Recommended: Search for users by their email address'
      },
      userId: {
        label: 'Add by User ID',
        description: 'If you know their User ID, you can add them directly'
      }
    },
    userIdInput: {
      label: 'User ID',
      placeholder: 'Enter User ID (UUID format)',
      helper: 'Ask the user for their User ID from their profile page',
      invalid: 'Please enter a valid User ID (UUID format)'
    },
    roleSelection: {
      label: 'Select Role',
      helper: 'Choose the appropriate permission level for this member',
      required: 'Please select a role'
    },
    duplicateError: 'This user is already a member of this inventory',
    addButton: 'Add Member',
    cancelButton: 'Cancel'
  },

  // Member Management
  memberManagement: {
    title: 'Inventory Members',
    description: 'Manage who has access to your inventory and what they can do.',
    addMemberButton: 'Add Member',
    noMembers: 'No members yet. Add someone to get started!',
    roleColumn: 'Role',
    addedColumn: 'Added',
    actionsColumn: 'Actions',
    editRole: {
      title: 'Change Member Role',
      description: 'Update the permissions for this member',
      currentRole: 'Current Role',
      newRole: 'New Role',
      reason: 'Reason for change (optional)',
      reasonPlaceholder: 'e.g., Promoted to administrator to help manage inventory',
      updateButton: 'Update Role',
      cancelButton: 'Cancel',
      successMessage: 'Member role updated successfully',
      cannotChangeSelf: 'You cannot change your own role',
      mustHaveOwner: 'Cannot remove the last owner from the inventory'
    },
    removeMember: {
      title: 'Remove Member',
      confirmMessage: 'Are you sure you want to remove this member? They will immediately lose access to the inventory.',
      removeButton: 'Remove Member',
      cancelButton: 'Cancel',
      successMessage: 'Member removed successfully',
      cannotRemoveSelf: 'You cannot remove yourself',
      cannotRemoveLastOwner: 'Cannot remove the last owner'
    }
  },

  // User Profile
  userProfile: {
    title: 'Your Profile',
    description: 'View and edit your profile information',
    displayName: {
      label: 'Display Name',
      placeholder: 'Enter your display name',
      helper: 'This name will be shown to other members',
      editButton: 'Edit',
      saveButton: 'Save',
      cancelButton: 'Cancel'
    },
    email: {
      label: 'Email Address',
      verified: 'Verified',
      notVerified: 'Not verified',
      cannotChange: 'Contact support to change your email address'
    },
    accountInfo: {
      title: 'Account Information',
      status: 'Status',
      created: 'Account Created',
      lastLogin: 'Last Login',
      neverLoggedIn: 'Never logged in'
    }
  },

  // Permissions
  permissions: {
    insufficientPermissions: 'You don\'t have permission to perform this action',
    requiresOwner: 'This action requires owner permissions',
    requiresAdmin: 'This action requires administrator permissions',
    readOnlyMode: 'You have read-only access and cannot make changes',
    contactAdmin: 'Contact an inventory owner or administrator for help'
  },

  // Errors
  errors: {
    userNotFound: 'User not found. Please check the email address or User ID.',
    invalidEmail: 'Please enter a valid email address',
    invalidUserId: 'Please enter a valid User ID (UUID format)',
    invitationExpired: 'This invitation has expired. Please request a new one.',
    invitationInvalid: 'This invitation link is invalid',
    duplicateMember: 'This user is already a member of this inventory',
    cannotRemoveSelf: 'You cannot remove yourself from the inventory',
    cannotRemoveLastOwner: 'Cannot remove the last owner from the inventory',
    cannotChangeSelfRole: 'You cannot change your own role',
    networkError: 'Network error. Please check your connection and try again.',
    unknownError: 'An unexpected error occurred. Please try again.'
  },

  // Success Messages
  success: {
    memberAdded: 'Member added successfully!',
    invitationSent: 'Invitation sent successfully!',
    invitationCancelled: 'Invitation cancelled',
    roleUpdated: 'Member role updated successfully',
    memberRemoved: 'Member removed successfully',
    profileUpdated: 'Profile updated successfully',
    userIdCopied: 'User ID copied to clipboard!'
  },

  // Tips and Best Practices
  tips: {
    roleSelection: [
      'Start with a more restrictive role and upgrade later if needed',
      'Owner role should only be given to co-owners',
      'Administrator role is good for trusted family members',
      'Member role is the default for most users',
      'Read-only role is perfect for sharing without modification risk'
    ],
    security: [
      'Review your members list regularly',
      'Remove members who no longer need access',
      'Only share your User ID with trusted individuals',
      'Monitor pending invitations and cancel unused ones'
    ],
    invitations: [
      'Invitations expire after 7 days for security',
      'You can cancel and resend if needed',
      'Check spam folders if invitation email isn\'t received',
      'Verify email addresses before sending'
    ]
  }
};

/**
 * Get help text for a specific role
 */
export function getRoleHelp(role: string) {
  const roleKey = role.toLowerCase() as keyof typeof HELP_TEXT.roles;
  return HELP_TEXT.roles[roleKey] || HELP_TEXT.roles.member;
}

/**
 * Get formatted role description with permissions
 */
export function getRoleDescription(role: string): string {
  const roleHelp = getRoleHelp(role);
  return `${roleHelp.description}\n\nPermissions:\n${roleHelp.permissions.map(p => `• ${p}`).join('\n')}`;
}

/**
 * Get error message by error code or type
 */
export function getErrorMessage(errorCode: string): string {
  const errorKey = errorCode as keyof typeof HELP_TEXT.errors;
  return HELP_TEXT.errors[errorKey] || HELP_TEXT.errors.unknownError;
}

/**
 * Get success message by action type
 */
export function getSuccessMessage(action: string): string {
  const actionKey = action as keyof typeof HELP_TEXT.success;
  return HELP_TEXT.success[actionKey] || 'Action completed successfully';
}

/**
 * Format expiry time in human-readable format
 */
export function formatExpiryTime(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffMs < 0) {
    return 'Expired';
  } else if (diffDays === 0) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  } else if (diffDays === 1) {
    return '1 day';
  } else {
    return `${diffDays} days`;
  }
}

/**
 * Check if invitation is expiring soon (2 days or less)
 */
export function isExpiringSoon(expiresAt: string): boolean {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 2 && diffDays > 0;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export default HELP_TEXT;
