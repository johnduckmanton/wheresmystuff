# Project Structure & Organization

## Root Level
```
├── template.yaml              # AWS SAM template (main infrastructure)
├── cloudfront-template.yaml   # CloudFront CDN infrastructure
├── samconfig.toml             # SAM deployment configuration
├── deploy.sh                  # Main deployment script
├── package.json               # Root dependencies (AWS SDK)
├── backend/                   # Lambda functions and services
├── frontend/                  # React TypeScript application
├── scripts/                   # Deployment and utility scripts
├── .kiro/                     # Kiro configuration and specs
└── docs/                      # Documentation files
```

## Backend Structure (`backend/`)
```
backend/
├── package.json               # Backend dependencies
├── jest.config.js            # Test configuration
├── handlers/                 # Lambda function handlers (API endpoints)
│   ├── containers.js         # Container CRUD operations
│   ├── inventory.js          # Inventory management
│   ├── users.js              # User management & invitations
│   ├── qrCode.js             # QR code generation/scanning
│   ├── photo.js              # Photo upload/management
│   ├── things.js             # Item management
│   ├── locations.js          # Location management
│   ├── rooms.js              # Room management
│   ├── categories.js         # Category management
│   ├── people.js             # People management
│   ├── projects.js           # Moving projects
│   ├── packing.js            # Packing operations
│   ├── analytics.js          # Analytics & reporting
│   └── aiAnalysis.js         # AI photo analysis
├── services/                 # Business logic services
│   ├── dynamodb.js           # DynamoDB operations
│   ├── containerService.js   # Container business logic
│   ├── inventoryService.js   # Inventory business logic
│   ├── userService.js        # User management logic
│   ├── qrCodeService.js      # QR code generation/validation
│   ├── s3.js                 # S3 operations
│   ├── cacheService.js       # Caching layer
│   └── emailService.js       # Email notifications
├── middleware/               # Express-style middleware
│   ├── auth.js               # JWT authentication
│   ├── corsValidation.js     # CORS handling
│   ├── rateLimit.js          # Rate limiting
│   └── securityHeaders.js    # Security headers
├── models/                   # Data models
│   ├── inventory.js          # Inventory model
│   ├── container.js          # Container model
│   ├── inventoryMembership.js # Membership model
│   └── movingProject.js      # Moving project model
├── utils/                    # Utility functions
│   ├── response.js           # HTTP response helpers
│   ├── validation.js         # Input validation
│   ├── schemas.js            # Validation schemas
│   ├── errorHandler.js       # Error handling
│   └── securityLogger.js     # Security logging
├── tests/                    # Test files
│   ├── __mocks__/            # Mock implementations
│   ├── setup.js              # Test setup
│   └── *.test.js             # Individual test files
└── scripts/                  # Backend utility scripts
    ├── migrate-*.js          # Data migration scripts
    ├── diagnose-data.js      # Data diagnostics
    └── add-user-by-email.js  # User management scripts
```

## Frontend Structure (`frontend/`)
```
frontend/
├── package.json              # Frontend dependencies
├── vite.config.ts            # Vite build configuration
├── tsconfig.json             # TypeScript configuration
├── eslint.config.js          # ESLint configuration
├── index.html                # HTML entry point
├── src/
│   ├── main.tsx              # React app entry point
│   ├── App.tsx               # Main app component
│   ├── theme.ts              # Material-UI theme
│   ├── components/           # Reusable React components
│   │   ├── Header.tsx        # App header
│   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   ├── EntityTable.tsx   # Generic data table
│   │   ├── EntityFormDialog.tsx # Generic form dialog
│   │   ├── QRCodeGenerator.tsx # QR code generation
│   │   ├── QRCodeScanner.tsx # QR code scanning
│   │   ├── S3Image.tsx       # CORS-aware image component
│   │   ├── ContainerList.tsx # Container listing
│   │   ├── PackingInterface.tsx # Packing operations
│   │   ├── ProtectedRoute.tsx # Auth route wrapper
│   │   ├── SignIn.tsx        # Authentication
│   │   ├── SignUp.tsx        # User registration
│   │   └── accessibility/    # Accessibility components
│   ├── pages/                # Page components
│   │   ├── Home.tsx          # Dashboard
│   │   ├── Containers.tsx    # Container management
│   │   ├── Things.tsx        # Item management
│   │   ├── Locations.tsx     # Location management
│   │   ├── Inventories.tsx   # Inventory management
│   │   ├── Projects.tsx      # Moving projects
│   │   ├── UserProfile.tsx   # User profile
│   │   └── MovingDashboard.tsx # Moving workflow
│   ├── services/             # API and external services
│   │   ├── api.ts            # Main API client
│   │   └── mockApi.ts        # Mock API for development
│   ├── contexts/             # React contexts
│   │   ├── InventoryContext.tsx # Inventory state
│   │   ├── LoadingContext.tsx # Loading state
│   │   ├── NotificationContext.tsx # Notifications
│   │   └── AccessibilityContext.tsx # Accessibility
│   ├── hooks/                # Custom React hooks
│   │   ├── useMobileDetection.ts # Mobile detection
│   │   ├── useKeyboardNavigation.ts # Keyboard nav
│   │   └── useVoiceCommands.ts # Voice commands
│   ├── types/                # TypeScript type definitions
│   │   ├── index.ts          # Main types
│   │   ├── entities.ts       # Entity types
│   │   └── speech.d.ts       # Speech API types
│   ├── utils/                # Utility functions
│   │   ├── validation.ts     # Form validation
│   │   └── htmlDecoder.ts    # HTML decoding
│   ├── config/               # Configuration
│   │   ├── amplify.ts        # AWS Amplify config
│   │   ├── aws.ts            # AWS configuration
│   │   └── development.ts    # Development settings
│   └── styles/               # CSS styles
│       └── mobile.css        # Mobile-specific styles
└── dist/                     # Build output (generated)
```

## Key Conventions

### File Naming
- **Backend**: camelCase for JavaScript files (`containerService.js`)
- **Frontend**: PascalCase for components (`ContainerList.tsx`)
- **Tests**: `*.test.js` suffix
- **Types**: Descriptive interfaces in TypeScript

### Code Organization
- **Handlers**: One file per API resource, Express-style routing
- **Services**: Business logic separated from handlers
- **Components**: Reusable UI components with props interfaces
- **Pages**: Top-level route components
- **Utils**: Pure functions, no side effects

### Import Patterns
- **Backend**: CommonJS (`require/module.exports`)
- **Frontend**: ES6 modules (`import/export`)
- **Relative imports**: Use relative paths for local files
- **Absolute imports**: Use for external packages

### Environment Configuration
- **Backend**: Environment variables via AWS Lambda
- **Frontend**: Vite environment variables (`VITE_*`)
- **Development**: `.env.local` for local overrides
- **Production**: CloudFormation parameters

### Testing Structure
- **Backend**: Jest with property-based testing (fast-check)
- **Frontend**: Component testing (planned)
- **Mocks**: Comprehensive AWS SDK mocking
- **E2E**: End-to-end workflow tests