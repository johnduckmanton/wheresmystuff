# User Management Enhancement Requirements

## Introduction

This specification defines the requirements for enhancing the Home Inventory Management System with comprehensive user management capabilities. The system currently uses Cognito User IDs for membership management but lacks the ability to look up users by email address or manage user roles effectively. This enhancement will enable administrators to invite users by email, manage user roles, and provide better user experience for inventory sharing.

## Glossary

- **System**: The Home Inventory Management System
- **Cognito**: AWS Cognito User Pool service for authentication
- **User_ID**: Unique identifier (UUID) assigned by Cognito to each user
- **Email_Address**: User's email address used for login and identification
- **Administrator**: User with elevated permissions to manage inventory members and settings
- **Member**: Regular user with access to inventory items and can add/edit/delete items
- **Read_Only**: User with view-only access to inventory items, cannot make changes
- **Owner**: User who created the inventory and has full administrative rights
- **Invitation**: Process of adding a new user to an inventory by email address

## Requirements

### Requirement 1

**User Story:** As an inventory owner, I want to invite users to my inventory by their email address, so that I don't need to know their internal User ID.

#### Acceptance Criteria

1. WHEN an inventory owner enters an email address to invite a user, THE System SHALL validate the email format and check if the user exists in Cognito
2. WHEN a valid email address is provided for an existing Cognito user, THE System SHALL add that user to the inventory with the specified role
3. WHEN an email address is provided for a non-existent user, THE System SHALL send an invitation email with instructions to create an account
4. WHEN an invitation is sent, THE System SHALL store the pending invitation with expiration date
5. WHEN a user creates an account using an invitation link, THE System SHALL automatically add them to the specified inventory

### Requirement 2

**User Story:** As an inventory owner, I want to assign different roles to inventory members, so that I can control what actions they can perform.

#### Acceptance Criteria

1. WHEN creating or updating a member's access, THE System SHALL support role assignment from the available roles: owner, administrator, member, read_only
2. WHEN a user has administrator role, THE System SHALL allow them to add/remove members and modify inventory settings
3. WHEN a user has member role, THE System SHALL allow them to view and manage items but restrict access to member management
4. WHEN a user has read_only role, THE System SHALL restrict them to viewing items only without any modification capabilities
5. WHEN a user has owner role, THE System SHALL grant them full permissions including deleting the inventory
6. WHEN role changes are made, THE System SHALL log the changes for audit purposes

### Requirement 3

**User Story:** As a system administrator, I want to look up users by email address, so that I can manage user accounts and troubleshoot access issues.

#### Acceptance Criteria

1. WHEN an administrator searches for a user by email, THE System SHALL query Cognito and return the user's profile information
2. WHEN a user lookup is performed, THE System SHALL return the user's ID, email, username, and account status
3. WHEN a user is not found, THE System SHALL return an appropriate error message
4. WHEN multiple users match the search criteria, THE System SHALL return all matching results
5. WHEN user lookup operations are performed, THE System SHALL log the access for security auditing

### Requirement 4

**User Story:** As a user, I want to see my User ID in my profile, so that I can share it with others who want to add me to their inventories.

#### Acceptance Criteria

1. WHEN a user views their profile page, THE System SHALL display their User ID in a copyable format
2. WHEN a user clicks on their User ID, THE System SHALL copy it to the clipboard
3. WHEN displaying the User ID, THE System SHALL provide context about what it's used for
4. WHEN a user updates their profile, THE System SHALL maintain the User ID display
5. WHEN profile information is accessed, THE System SHALL ensure only the authenticated user can view their own ID

### Requirement 5

**User Story:** As an inventory member, I want to see the roles and permissions of other members, so that I understand the access structure of the inventory.

#### Acceptance Criteria

1. WHEN viewing the members list, THE System SHALL display each member's role and permissions
2. WHEN a member has administrator privileges, THE System SHALL clearly indicate their elevated access
3. WHEN displaying member information, THE System SHALL show when they were added and by whom
4. WHEN a user lacks permission to view member details, THE System SHALL show only basic information
5. WHEN member information is displayed, THE System SHALL respect privacy settings and access controls