# Enable Self-Registration in Production

If you want to allow users to self-register in production (less secure), you can modify the CloudFormation template.

## Option 1: Always Allow Self-Registration
Change this line in `template.yaml`:

```yaml
AdminCreateUserConfig:
  AllowAdminCreateUserOnly: !If [IsProduction, true, false]
```

To:

```yaml
AdminCreateUserConfig:
  AllowAdminCreateUserOnly: false
```

## Option 2: Add a Parameter to Control Self-Registration
Add a new parameter to control this behavior:

1. Add to Parameters section:
```yaml
AllowSelfRegistration:
  Type: String
  Default: 'false'
  AllowedValues: ['true', 'false']
  Description: 'Allow users to self-register (less secure for production)'
```

2. Add a condition:
```yaml
Conditions:
  AllowSelfReg: !Equals [!Ref AllowSelfRegistration, 'true']
```

3. Update the UserPool configuration:
```yaml
AdminCreateUserConfig:
  AllowAdminCreateUserOnly: !If [AllowSelfReg, false, !If [IsProduction, true, false]]
```

## Security Considerations

**Allowing self-registration in production:**
- ✅ Easier user onboarding
- ❌ Anyone can create accounts
- ❌ Potential for spam/abuse
- ❌ Harder to control access

**Admin-only user creation (current setup):**
- ✅ Full control over who gets access
- ✅ Better security posture
- ✅ Audit trail of user creation
- ❌ Manual process for each user

## Recommendation

For a home inventory system, **admin-only user creation is recommended** because:
1. You likely have a small, known set of users (family/household)
2. You want to control who has access to your personal inventory data
3. The manual overhead is minimal for a small user base

Use the `create-production-user.sh` script to create users as needed.