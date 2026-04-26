/**
 * User Management Help Components
 * 
 * Reusable help text components for user management features.
 * These can be imported and used in dialogs, tooltips, and help sections.
 */

import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Alert, Chip, Stack, Tooltip, IconButton } from '@mui/material';
import { Info as InfoIcon, CheckCircle as CheckIcon, Cancel as CancelIcon, Help as HelpIcon } from '@mui/icons-material';
import { HELP_TEXT, getRoleHelp } from '../utils/userManagementHelp';

/**
 * Role Permission Badge
 * Shows a role with a tooltip explaining permissions
 */
export function RolePermissionBadge({ role }: { role: string }) {
  const roleHelp = getRoleHelp(role);
  
  return (
    <Tooltip 
      title={
        <Box>
          <Typography variant="subtitle2" gutterBottom>{roleHelp.title}</Typography>
          <Typography variant="body2" paragraph>{roleHelp.description}</Typography>
          <Typography variant="caption">Permissions:</Typography>
          <List dense>
            {roleHelp.permissions.map((perm, idx) => (
              <ListItem key={idx} sx={{ py: 0 }}>
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <CheckIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={perm} primaryTypographyProps={{ variant: 'caption' }} />
              </ListItem>
            ))}
          </List>
        </Box>
      }
      arrow
    >
      <Chip 
        label={roleHelp.title} 
        size="small" 
        color={role === 'owner' ? 'primary' : role === 'administrator' ? 'secondary' : 'default'}
      />
    </Tooltip>
  );
}

/**
 * Role Selection Help
 * Shows guidance for selecting the appropriate role
 */
export function RoleSelectionHelp() {
  return (
    <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Choosing the Right Role
      </Typography>
      <List dense>
        {HELP_TEXT.tips.roleSelection.map((tip, idx) => (
          <ListItem key={idx} sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CheckIcon fontSize="small" color="info" />
            </ListItemIcon>
            <ListItemText 
              primary={tip} 
              primaryTypographyProps={{ variant: 'body2' }} 
            />
          </ListItem>
        ))}
      </List>
    </Alert>
  );
}

/**
 * User ID Help Section
 * Explains what a User ID is and how to use it
 */
export function UserIdHelp() {
  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <HelpIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2">
          {HELP_TEXT.userId.whatIsIt}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" paragraph>
        {HELP_TEXT.userId.explanation}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        {HELP_TEXT.userId.format}
      </Typography>
      <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
        When to share your User ID:
      </Typography>
      <List dense>
        {HELP_TEXT.userId.whenToShare.map((reason, idx) => (
          <ListItem key={idx} sx={{ py: 0 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <CheckIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText 
              primary={reason} 
              primaryTypographyProps={{ variant: 'body2' }} 
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

/**
 * Invitation Expiry Warning
 * Shows warning for invitations expiring soon
 */
export function InvitationExpiryWarning({ expiresAt }: { expiresAt: string }) {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMs < 0) {
    return (
      <Alert severity="error" icon={<CancelIcon />}>
        {HELP_TEXT.invitations.pending.expired}
      </Alert>
    );
  }
  
  if (diffDays <= 2) {
    return (
      <Alert severity="warning" icon={<InfoIcon />}>
        {HELP_TEXT.invitations.pending.expiresSoon}
      </Alert>
    );
  }
  
  return null;
}

/**
 * Email Lookup Tips
 * Shows tips for successful email lookup
 */
export function EmailLookupTips() {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" color="text.secondary" gutterBottom>
        Tips for successful lookup:
      </Typography>
      <List dense>
        {HELP_TEXT.userLookup.tips.map((tip, idx) => (
          <ListItem key={idx} sx={{ py: 0 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <InfoIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText 
              primary={tip} 
              primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }} 
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

/**
 * Invitation Info Box
 * Shows information about the invitation process
 */
export function InvitationInfoBox() {
  return (
    <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
      <Typography variant="body2">
        {HELP_TEXT.invitations.description}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {HELP_TEXT.invitations.expiryNote}
      </Typography>
    </Alert>
  );
}

/**
 * Permission Denied Help
 * Shows help when user lacks permissions
 */
export function PermissionDeniedHelp({ requiredRole }: { requiredRole?: string }) {
  return (
    <Alert severity="warning" icon={<InfoIcon />}>
      <Typography variant="body2" gutterBottom>
        {HELP_TEXT.permissions.insufficientPermissions}
      </Typography>
      {requiredRole && (
        <Typography variant="caption" color="text.secondary">
          Required role: {requiredRole}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {HELP_TEXT.permissions.contactAdmin}
      </Typography>
    </Alert>
  );
}

/**
 * Security Tips
 * Shows security best practices
 */
export function SecurityTips() {
  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <InfoIcon color="info" fontSize="small" />
        <Typography variant="subtitle2">
          Security Best Practices
        </Typography>
      </Stack>
      <List dense>
        {HELP_TEXT.tips.security.map((tip, idx) => (
          <ListItem key={idx} sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <CheckIcon fontSize="small" color="info" />
            </ListItemIcon>
            <ListItemText 
              primary={tip} 
              primaryTypographyProps={{ variant: 'body2' }} 
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

/**
 * Invitation Tips
 * Shows tips for managing invitations
 */
export function InvitationTips() {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" color="text.secondary" gutterBottom>
        Invitation tips:
      </Typography>
      <List dense>
        {HELP_TEXT.tips.invitations.map((tip, idx) => (
          <ListItem key={idx} sx={{ py: 0 }}>
            <ListItemIcon sx={{ minWidth: 24 }}>
              <InfoIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText 
              primary={tip} 
              primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }} 
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

/**
 * Help Icon Button with Tooltip
 * Reusable help icon that shows tooltip on hover
 */
export function HelpIconButton({ title, content }: { title: string; content: string | React.ReactNode }) {
  return (
    <Tooltip 
      title={
        <Box>
          <Typography variant="subtitle2" gutterBottom>{title}</Typography>
          {typeof content === 'string' ? (
            <Typography variant="body2">{content}</Typography>
          ) : (
            content
          )}
        </Box>
      }
      arrow
    >
      <IconButton size="small" color="secondary">
        <HelpIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

/**
 * Role Comparison Table
 * Shows a comparison of what each role can do
 */
export function RoleComparisonTable() {
  const roles = ['owner', 'administrator', 'member', 'read_only'];
  const actions = [
    'View items',
    'Create/edit items',
    'Delete items',
    'Add members',
    'Remove members',
    'Change roles',
    'Modify settings',
    'Delete inventory'
  ];
  
  const permissions: Record<string, boolean[]> = {
    owner: [true, true, true, true, true, true, true, true],
    administrator: [true, true, true, true, true, true, true, false],
    member: [true, true, true, false, false, false, false, false],
    read_only: [true, false, false, false, false, false, false, false]
  };
  
  return (
    <Box sx={{ mt: 2, overflowX: 'auto' }}>
      <Typography variant="subtitle2" gutterBottom>
        Role Permissions Comparison
      </Typography>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd' }}>Action</th>
            {roles.map(role => (
              <th key={role} style={{ textAlign: 'center', padding: '8px', borderBottom: '2px solid #ddd' }}>
                {getRoleHelp(role).title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {actions.map((action, idx) => (
            <tr key={action}>
              <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{action}</td>
              {roles.map(role => (
                <td key={role} style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
                  {permissions[role][idx] ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <CancelIcon fontSize="small" color="error" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

export default {
  RolePermissionBadge,
  RoleSelectionHelp,
  UserIdHelp,
  InvitationExpiryWarning,
  EmailLookupTips,
  InvitationInfoBox,
  PermissionDeniedHelp,
  SecurityTips,
  InvitationTips,
  HelpIconButton,
  RoleComparisonTable
};
