# Documentation Index

Complete guide to all documentation in the Home Inventory Management System.

## Quick Links

### 🚀 Getting Started
- [README.md](README.md) - Project overview and quick start
- [QUICK_START.md](QUICK_START.md) - Fast setup guide
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) - Local development setup

### 👥 User Management (NEW)
- [USER_MANAGEMENT.md](USER_MANAGEMENT.md) - **Complete user management guide**
- [USER_MANAGEMENT_QUICK_REFERENCE.md](USER_MANAGEMENT_QUICK_REFERENCE.md) - **Quick reference card**
- [USER_MANAGEMENT_TROUBLESHOOTING.md](USER_MANAGEMENT_TROUBLESHOOTING.md) - **Troubleshooting guide**

### 🔧 Deployment & Infrastructure
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) - AWS resources overview
- [FRONTEND_DEPLOYMENT.md](FRONTEND_DEPLOYMENT.md) - Frontend deployment
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - Deployment summary

### 🔒 Security
- [SECURITY_INFRASTRUCTURE.md](SECURITY_INFRASTRUCTURE.md) - Security infrastructure
- [SECURITY_MONITORING.md](SECURITY_MONITORING.md) - Security monitoring
- [SECURITY_SCANNING.md](SECURITY_SCANNING.md) - Security scanning
- [SECURITY_VERIFICATION_SUMMARY.md](SECURITY_VERIFICATION_SUMMARY.md) - Verification summary

### 🧪 Testing
- [TEST_APPLICATION.md](TEST_APPLICATION.md) - Application testing guide

## Documentation by Topic

### User Management

#### For End Users
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [USER_MANAGEMENT.md](USER_MANAGEMENT.md) | Complete guide to user management features | Learning how to use user management |
| [USER_MANAGEMENT_QUICK_REFERENCE.md](USER_MANAGEMENT_QUICK_REFERENCE.md) | One-page quick reference | Quick lookup of common tasks |
| [USER_MANAGEMENT_TROUBLESHOOTING.md](USER_MANAGEMENT_TROUBLESHOOTING.md) | Troubleshooting common issues | When you encounter problems |

#### For Developers
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [frontend/src/components/USER_MANAGEMENT_COMPONENTS.md](frontend/src/components/USER_MANAGEMENT_COMPONENTS.md) | Component API reference | Integrating user management components |
| [frontend/src/utils/userManagementHelp.ts](frontend/src/utils/userManagementHelp.ts) | Help text utilities | Adding help text to UI |
| [frontend/src/components/UserManagementHelp.tsx](frontend/src/components/UserManagementHelp.tsx) | Help UI components | Adding contextual help |

#### For Administrators
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [backend/scripts/USER_MANAGEMENT_MIGRATION.md](backend/scripts/USER_MANAGEMENT_MIGRATION.md) | Migration guide | Upgrading to user management system |
| [USER_MANAGEMENT_TROUBLESHOOTING.md](USER_MANAGEMENT_TROUBLESHOOTING.md) | Admin troubleshooting | Diagnosing system issues |

#### Specifications
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [.kiro/specs/user-management-enhancement/requirements.md](.kiro/specs/user-management-enhancement/requirements.md) | Detailed requirements | Understanding what was built |
| [.kiro/specs/user-management-enhancement/design.md](.kiro/specs/user-management-enhancement/design.md) | System design | Understanding how it works |
| [.kiro/specs/user-management-enhancement/tasks.md](.kiro/specs/user-management-enhancement/tasks.md) | Implementation tasks | Tracking implementation |
| [.kiro/specs/user-management-enhancement/README.md](.kiro/specs/user-management-enhancement/README.md) | Spec overview | Understanding the feature |

### Home Inventory System

#### Specifications
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [.kiro/specs/home-inventory-system/requirements.md](.kiro/specs/home-inventory-system/requirements.md) | Core system requirements | Understanding system requirements |
| [.kiro/specs/home-inventory-system/design.md](.kiro/specs/home-inventory-system/design.md) | Core system design | Understanding system architecture |
| [.kiro/specs/home-inventory-system/tasks.md](.kiro/specs/home-inventory-system/tasks.md) | Implementation tasks | Tracking core implementation |

### Backend

#### API Documentation
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [backend/docs/dynamodb-schema.md](backend/docs/dynamodb-schema.md) | DynamoDB schema | Understanding data structure |

#### Scripts
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [backend/scripts/README.md](backend/scripts/README.md) | Scripts overview | Using backend scripts |
| [backend/scripts/USER_MANAGEMENT_MIGRATION.md](backend/scripts/USER_MANAGEMENT_MIGRATION.md) | Migration guide | Running migrations |
| [backend/scripts/MIGRATION_SUMMARY.md](backend/scripts/MIGRATION_SUMMARY.md) | Migration summary | Understanding migrations |

### Frontend

#### Component Documentation
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [frontend/src/components/README.md](frontend/src/components/README.md) | Components overview | Understanding component structure |
| [frontend/src/components/USER_MANAGEMENT_COMPONENTS.md](frontend/src/components/USER_MANAGEMENT_COMPONENTS.md) | User management components | Using user management UI |
| [frontend/src/components/EntityFormDialog.md](frontend/src/components/EntityFormDialog.md) | Entity form dialog | Using form dialogs |

#### Services
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [frontend/src/services/README.md](frontend/src/services/README.md) | Services overview | Understanding API services |

#### Utilities
| Document | Purpose | When to Use |
|----------|---------|-------------|
| [frontend/src/utils/README.md](frontend/src/utils/README.md) | Utilities overview | Using utility functions |

### Deployment

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Main deployment guide | Deploying the application |
| [FRONTEND_DEPLOYMENT.md](FRONTEND_DEPLOYMENT.md) | Frontend deployment | Deploying frontend only |
| [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) | Deployment summary | Quick deployment overview |
| [DEPLOYMENT_FIX.md](DEPLOYMENT_FIX.md) | Deployment fixes | Troubleshooting deployment |

### Infrastructure

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [INFRASTRUCTURE.md](INFRASTRUCTURE.md) | Infrastructure overview | Understanding AWS resources |
| [SECURITY_INFRASTRUCTURE.md](SECURITY_INFRASTRUCTURE.md) | Security infrastructure | Understanding security setup |

### Security

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [SECURITY_INFRASTRUCTURE.md](SECURITY_INFRASTRUCTURE.md) | Security infrastructure | Setting up security |
| [SECURITY_MONITORING.md](SECURITY_MONITORING.md) | Security monitoring | Monitoring security |
| [SECURITY_SCANNING.md](SECURITY_SCANNING.md) | Security scanning | Running security scans |
| [SECURITY_VERIFICATION_SUMMARY.md](SECURITY_VERIFICATION_SUMMARY.md) | Verification summary | Verifying security |

## Documentation by Role

### I'm a New User
1. Start with [README.md](README.md) for project overview
2. Read [USER_MANAGEMENT.md](USER_MANAGEMENT.md) to understand user features
3. Keep [USER_MANAGEMENT_QUICK_REFERENCE.md](USER_MANAGEMENT_QUICK_REFERENCE.md) handy
4. Refer to [USER_MANAGEMENT_TROUBLESHOOTING.md](USER_MANAGEMENT_TROUBLESHOOTING.md) if issues arise

### I'm a Developer
1. Review [README.md](README.md) for project structure
2. Check [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for setup
3. Read specifications in `.kiro/specs/` directories
4. Review component docs in `frontend/src/components/`
5. Check API docs in `backend/docs/`

### I'm an Administrator
1. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for deployment
2. Review [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for AWS setup
3. Read [backend/scripts/USER_MANAGEMENT_MIGRATION.md](backend/scripts/USER_MANAGEMENT_MIGRATION.md) for migrations
4. Check [SECURITY_MONITORING.md](SECURITY_MONITORING.md) for monitoring
5. Use [USER_MANAGEMENT_TROUBLESHOOTING.md](USER_MANAGEMENT_TROUBLESHOOTING.md) for issues

### I'm a DevOps Engineer
1. Review [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for architecture
2. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for CI/CD
3. Check [SECURITY_INFRASTRUCTURE.md](SECURITY_INFRASTRUCTURE.md) for security
4. Review [SECURITY_SCANNING.md](SECURITY_SCANNING.md) for scanning
5. Monitor using [SECURITY_MONITORING.md](SECURITY_MONITORING.md)

## Common Tasks

### Adding a Member to Inventory
→ [USER_MANAGEMENT.md - Adding Members](USER_MANAGEMENT.md#adding-members-to-your-inventory)

### Troubleshooting User Lookup
→ [USER_MANAGEMENT_TROUBLESHOOTING.md - User Lookup Issues](USER_MANAGEMENT_TROUBLESHOOTING.md#user-lookup-issues)

### Deploying the Application
→ [DEPLOYMENT.md](DEPLOYMENT.md)

### Running Migrations
→ [backend/scripts/USER_MANAGEMENT_MIGRATION.md](backend/scripts/USER_MANAGEMENT_MIGRATION.md)

### Understanding Roles and Permissions
→ [USER_MANAGEMENT.md - User Roles](USER_MANAGEMENT.md#user-roles-and-permissions)

### Setting Up Local Development
→ [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)

### Configuring Security
→ [SECURITY_INFRASTRUCTURE.md](SECURITY_INFRASTRUCTURE.md)

### Testing the Application
→ [TEST_APPLICATION.md](TEST_APPLICATION.md)

## Documentation Standards

### User Documentation
- Written for non-technical users
- Step-by-step instructions
- Screenshots and examples
- Troubleshooting sections
- Quick reference cards

### Technical Documentation
- API references
- Code examples
- Architecture diagrams
- Data models
- Integration guides

### Specification Documents
- EARS-compliant requirements
- Design decisions and rationale
- Implementation tasks
- Testing strategies
- Correctness properties

## Contributing to Documentation

When updating documentation:

1. **Keep it current** - Update docs when code changes
2. **Be clear** - Use simple language and examples
3. **Be complete** - Cover all use cases
4. **Be consistent** - Follow existing patterns
5. **Cross-reference** - Link to related docs
6. **Test it** - Verify instructions work

## Getting Help

Can't find what you're looking for?

1. **Search this index** for relevant documents
2. **Check the README** in each directory
3. **Review specifications** in `.kiro/specs/`
4. **Look at code comments** in source files
5. **Check troubleshooting guides** for common issues

## Document Maintenance

### Recently Updated
- USER_MANAGEMENT.md (December 2024)
- USER_MANAGEMENT_TROUBLESHOOTING.md (December 2024)
- USER_MANAGEMENT_QUICK_REFERENCE.md (December 2024)
- README.md (December 2024)

### Needs Review
- Check individual documents for last updated dates
- Verify deployment guides after infrastructure changes
- Update security docs after security changes

## Feedback

Found an issue with documentation?
- Check if information is outdated
- Verify instructions work as described
- Suggest improvements
- Report errors or omissions

---

**Last Updated**: December 2024
**Maintained By**: Development Team
