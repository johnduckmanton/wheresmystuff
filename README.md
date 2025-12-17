# Where's My Stuff!

A full-stack serverless web application for tracking and managing personal belongings across multiple locations.

## Features

- 🔐 Secure authentication with AWS Cognito
- 📦 Track items (Things) with detailed information
- 🏠 Organize by Locations and Rooms
- 🏷️ Categorize items and assign owners
- 📸 Upload and manage photos
- 🔍 Advanced filtering and sorting
- 📱 Responsive design for desktop, tablet, and mobile

## Architecture

- **Frontend**: React + Vite + Material-UI v7+
- **Backend**: AWS Lambda (Node.js 20.x)
- **Database**: DynamoDB (single-table design)
- **Storage**: S3 (presigned URLs)
- **Authentication**: AWS Cognito
- **API**: API Gateway HTTP API

## Project Structure

```
.
├── template.yaml              # AWS SAM template
├── samconfig.toml            # SAM deployment configuration
├── backend/                  # Lambda functions
│   ├── handlers/            # API endpoint handlers
│   │   ├── things.js
│   │   ├── locations.js
│   │   ├── rooms.js
│   │   ├── categories.js
│   │   ├── people.js
│   │   └── photo.js
│   └── package.json
├── DEPLOYMENT.md            # Detailed deployment guide
├── INFRASTRUCTURE.md        # Infrastructure documentation
└── .kiro/specs/            # Feature specifications
    └── home-inventory-system/
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

## Quick Start

### Prerequisites

- AWS CLI configured with credentials
- AWS SAM CLI installed
- Node.js 20.x or later

### Deploy Infrastructure

1. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   cd ..
   ```

2. **Build the application**:
   ```bash
   sam build
   ```

3. **Deploy to AWS**:
   ```bash
   sam deploy --guided
   ```

4. **Save the output values** (API URL, User Pool ID, Client ID, Bucket Name)

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Infrastructure Details

For a complete overview of AWS resources and configuration, see [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## Development Roadmap

This project follows a spec-driven development approach. See `.kiro/specs/home-inventory-system/` for:

- **requirements.md** - Detailed requirements with acceptance criteria
- **design.md** - System architecture and design decisions
- **tasks.md** - Implementation task list

### Current Status

- ✅ Task 1: Infrastructure setup (Cognito, DynamoDB, S3, API Gateway)
- ⏳ Task 2: Frontend project initialization
- ⏳ Task 3: Authentication system
- ⏳ Task 4: Backend Lambda functions
- ⏳ Tasks 5-25: Feature implementation

## Key Features

### Authentication & User Management
- Email/password authentication via Cognito
- JWT token-based API authorization
- Password policy: min 8 chars, uppercase, lowercase, numbers
- **Email-based user lookup** - Add members by email address
- **Role-based access control** - Owner, Administrator, Member, Read-only roles
- **User invitations** - Invite users who don't have accounts yet
- **User profiles** - View and share your User ID

### Data Management
- **Things**: Track items with photos, serial numbers, purchase info, warranty details
- **Locations**: Physical addresses with full address fields
- **Rooms**: Rooms within locations with floor information
- **Categories**: Item classification
- **People**: Item ownership tracking

### User Interface
- Material-UI CRUD Dashboard template
- Collapsible sidebar navigation
- Sortable and filterable data tables
- Modal dialogs for create/edit operations
- Photo upload with drag-and-drop
- Responsive design

### Data Storage
- Single-table DynamoDB design for efficiency
- Entity types: THINGS, LOCATIONS, ROOMS, CATEGORIES, PEOPLE
- Partition key: Entity type
- Sort key: UUID
- All attributes stored in data JSON object

### Photo Management
- S3 storage with private access
- Presigned URLs (1-hour expiration)
- Multiple photos per item
- Drag-and-drop upload interface

## Security

- All API endpoints require JWT authentication
- S3 bucket is private (no public access)
- Presigned URLs for secure photo access
- CORS configured for API and S3
- Password policy enforcement

## Cost Optimization

- DynamoDB on-demand billing (pay per request)
- Lambda pay-per-execution model
- S3 lifecycle rules for cleanup
- HTTP API (lower cost than REST API)

## Monitoring

- CloudWatch Logs for Lambda functions
- CloudWatch Metrics for all services
- DynamoDB point-in-time recovery enabled
- S3 versioning enabled

## Next Steps

1. Complete Task 2: Initialize frontend project
2. Implement authentication (Task 3)
3. Build backend Lambda functions (Tasks 4-9)
4. Develop frontend UI (Tasks 11-23)
5. Deploy and test

## Documentation

📚 **[Complete Documentation Index](DOCUMENTATION_INDEX.md)** - Find all documentation organized by topic and role

### Quick Links

**For Users:**
- [USER_MANAGEMENT.md](USER_MANAGEMENT.md) - Complete user management guide
- [USER_MANAGEMENT_QUICK_REFERENCE.md](USER_MANAGEMENT_QUICK_REFERENCE.md) - Quick reference card
- [USER_MANAGEMENT_TROUBLESHOOTING.md](USER_MANAGEMENT_TROUBLESHOOTING.md) - Troubleshooting guide

**For Developers:**
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) - Local development setup
- [frontend/src/components/USER_MANAGEMENT_COMPONENTS.md](frontend/src/components/USER_MANAGEMENT_COMPONENTS.md) - Component docs
- [.kiro/specs/](/.kiro/specs/) - Feature specifications

**For Administrators:**
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) - Infrastructure overview
- [backend/scripts/USER_MANAGEMENT_MIGRATION.md](backend/scripts/USER_MANAGEMENT_MIGRATION.md) - Migration guide

## License

ISC

## Support

For issues or questions, refer to the specification documents in `.kiro/specs/home-inventory-system/`.
