# Home Inventory System

A comprehensive full-stack serverless web application for tracking and managing personal belongings across multiple locations with advanced QR code functionality.

## ✨ Features

### Core Inventory Management
- 🔐 **Secure Authentication**: AWS Cognito with JWT tokens
- 📦 **Container Management**: Track containers with detailed information and status
- 📋 **Item Tracking**: Manage items within containers with photos and metadata
- 🏠 **Location Organization**: Organize by locations and rooms
- 👥 **User Management**: Role-based access with invitations and sharing
- 📸 **Photo Management**: Upload and view photos with CORS handling

### QR Code System ✅ **FULLY IMPLEMENTED**
- 🏷️ **QR Code Generation**: Generate unique QR codes for containers
- 📱 **QR Code Scanning**: Scan codes to instantly view container contents
- 🖼️ **Smart Image Display**: S3Image component handles CORS automatically
- 💾 **Optimized Caching**: Efficient cache management for QR code data
- 🔗 **Proper S3 Routing**: QR codes stored in dedicated bucket

### Advanced Features
- 🔍 **Advanced Search**: Filter and sort across all data
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- 🌐 **Global CDN**: CloudFront distribution with security headers
- 🛡️ **WAF Protection**: Web Application Firewall security

## 🏗️ Architecture

### Multi-Region Setup
- **Backend Region**: eu-west-1 (Lambda, API Gateway, DynamoDB, S3)
- **CDN Region**: us-east-1 (CloudFront, WAF - required for global distribution)

### Technology Stack
- **Frontend**: React + TypeScript + Vite + Material-UI v5
- **Backend**: AWS Lambda (Node.js 20.x) with Express-style routing
- **Database**: DynamoDB with single-table design and caching
- **Storage**: S3 with separate buckets (Photos, QR Codes)
- **Authentication**: AWS Cognito User Pools
- **API**: API Gateway HTTP API with CORS
- **CDN**: CloudFront with security headers and WAF protection

## 📁 Project Structure

```
.
├── template.yaml                    # AWS SAM template (backend)
├── cloudfront-template.yaml        # CloudFront infrastructure
├── samconfig.toml                  # SAM deployment configuration
├── backend/                        # Lambda functions
│   ├── handlers/                   # API endpoint handlers
│   │   ├── containers.js          # Container management
│   │   ├── items.js               # Item management
│   │   ├── qrCode.js              # QR code system ✅
│   │   ├── locations.js           # Location management
│   │   ├── people.js              # User management
│   │   └── photo.js               # Photo upload/management
│   ├── services/                   # Business logic services
│   │   ├── qrCodeService.js       # QR code generation/validation
│   │   ├── cacheService.js        # Optimized caching
│   │   └── s3.js                  # S3 operations
│   └── package.json
├── frontend/                       # React TypeScript application
│   ├── src/
│   │   ├── components/
│   │   │   ├── QRCodeGenerator.tsx # QR code generation UI
│   │   │   ├── S3Image.tsx        # CORS-handling image component ✅
│   │   │   └── ContainerDetailDialog.tsx # Enhanced container UI ✅
│   │   └── services/
│   │       └── api.ts             # API client
│   └── package.json
├── scripts/                        # Deployment and utility scripts
├── DEPLOYMENT.md                   # Detailed deployment guide
├── INFRASTRUCTURE.md               # Infrastructure documentation
└── .kiro/specs/                   # Feature specifications
    ├── home-inventory-system/     # Core system specs
    └── qr-code-system-enhancement/ # QR code system specs ✅
        ├── requirements.md
        ├── design.md
        ├── tasks.md
        └── current-status.md
```

## 🚀 Quick Start

### Prerequisites

- AWS CLI configured with credentials
- AWS SAM CLI installed
- Node.js 20.x or later

### Complete Deployment

1. **Deploy Backend Infrastructure** (eu-west-1):
   ```bash
   cd backend && npm install && cd ..
   sam build
   sam deploy --region eu-west-1
   ```

2. **Deploy CloudFront Distribution** (us-east-1):
   ```bash
   # Get outputs from backend stack first
   aws cloudformation deploy \
     --template-file cloudfront-template.yaml \
     --stack-name home-inventory-cloudfront \
     --region us-east-1 \
     --parameter-overrides \
       ApiGatewayDomainName=YOUR_API_DOMAIN \
       WebsiteBucketDomainName=YOUR_S3_DOMAIN
   ```

3. **Deploy Frontend**:
   ```bash
   cd frontend && npm install && npm run build && cd ..
   ./scripts/deploy-frontend.sh
   ```

4. **Access Your Application**:
   - Get CloudFront URL from stack outputs
   - Sign up for a new account
   - Start managing your inventory with QR codes!

For detailed deployment instructions, see [QUICK_START.md](QUICK_START.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

### Infrastructure Details

For a complete overview of AWS resources and configuration, see [INFRASTRUCTURE.md](INFRASTRUCTURE.md).

## 📋 Development Status

This project follows a spec-driven development approach with comprehensive documentation.

### ✅ Completed Features

#### Core System
- ✅ **Infrastructure Setup**: Multi-region AWS deployment
- ✅ **Authentication System**: Cognito integration with JWT
- ✅ **Backend API**: Lambda functions with Express-style routing
- ✅ **Frontend Application**: React TypeScript with Material-UI
- ✅ **Database Design**: DynamoDB single-table with caching
- ✅ **Photo Management**: S3 storage with presigned URLs

#### QR Code System (Recently Completed)
- ✅ **QR Code Generation**: Container-specific QR codes
- ✅ **QR Code Scanning**: Camera-based scanning functionality
- ✅ **S3 Bucket Routing**: Fixed bucket mismatch issues
- ✅ **CORS Handling**: S3Image component for cross-origin images
- ✅ **UI Integration**: Enhanced container detail dialogs
- ✅ **Cache Management**: Optimized DynamoDB and CloudFront caching
- ✅ **Infrastructure Recovery**: CloudFront template restoration

#### User Management
- ✅ **Role-Based Access**: Owner, Admin, Member, Read-only roles
- ✅ **User Invitations**: Email-based invitation system
- ✅ **Profile Management**: User profiles and sharing

### 🔄 Current Focus Areas

- 🔧 **Performance Optimization**: Cache tuning and response times
- 📱 **Mobile Experience**: Enhanced mobile UI/UX
- 🔍 **Advanced Search**: Enhanced filtering and search capabilities
- 📊 **Analytics Dashboard**: Usage statistics and insights

### 📚 Specification Documents

See `.kiro/specs/` for detailed specifications:
- **home-inventory-system/**: Core system requirements and design
- **qr-code-system-enhancement/**: QR code system specifications

## 🔑 Key Features

### Authentication & User Management
- **Secure Authentication**: Email/password via Cognito with JWT tokens
- **Role-Based Access Control**: Owner, Administrator, Member, Read-only roles
- **User Invitations**: Invite users by email address
- **Profile Management**: User profiles with shareable User IDs
- **Password Policy**: Minimum 8 characters with complexity requirements

### Container & Item Management
- **Container Tracking**: Detailed container information with status tracking
- **Item Management**: Items within containers with photos and metadata
- **Location Organization**: Physical addresses with rooms and floor information
- **Category System**: Item classification and organization
- **Ownership Tracking**: Assign items to specific people

### QR Code System ✅ **FULLY FUNCTIONAL**
- **QR Code Generation**: Generate unique, secure QR codes for containers
- **Mobile Scanning**: Camera-based QR code scanning
- **Instant Access**: Scan to immediately view container contents
- **Smart Image Display**: Automatic CORS handling for S3 images
- **Optimized Performance**: Efficient caching and S3 bucket routing

### User Interface
- **Modern Design**: Material-UI components with responsive layout
- **Intuitive Navigation**: Collapsible sidebar with organized sections
- **Advanced Tables**: Sortable, filterable data tables
- **Modal Dialogs**: Streamlined create/edit operations
- **Photo Management**: Drag-and-drop upload with preview
- **Mobile Optimized**: Touch-friendly interface for all devices

### Data Management
- **Single-Table Design**: Efficient DynamoDB structure
- **Intelligent Caching**: Multi-layer caching for performance
- **Real-Time Updates**: Live data synchronization
- **Backup & Recovery**: Point-in-time recovery enabled
- **Data Validation**: Server-side validation and sanitization

## 🔒 Security & Performance

### Security Features
- **Multi-Layer Authentication**: JWT tokens with Cognito integration
- **Private S3 Storage**: No public access, presigned URLs only
- **CORS Configuration**: Proper cross-origin resource sharing
- **WAF Protection**: AWS managed rules against common attacks
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more
- **Input Validation**: Server-side validation and sanitization
- **HTTPS Enforcement**: All traffic encrypted in transit

### Performance Optimizations
- **Global CDN**: CloudFront distribution for fast content delivery
- **Intelligent Caching**: Multi-layer caching (DynamoDB, CloudFront, Browser)
- **Optimized Images**: Efficient S3 storage with CORS handling
- **Serverless Architecture**: Auto-scaling Lambda functions
- **Single-Table Design**: Efficient DynamoDB queries
- **HTTP/2 Support**: Modern protocol for faster loading

### Cost Optimization
- **On-Demand Billing**: DynamoDB pay-per-request model
- **Serverless Functions**: Lambda pay-per-execution
- **Lifecycle Management**: S3 lifecycle rules for cleanup
- **HTTP API**: Lower cost than REST API Gateway
- **Efficient Caching**: Reduced API calls and database queries

## 📊 Monitoring & Observability

- **CloudWatch Logs**: Comprehensive logging for all Lambda functions
- **CloudWatch Metrics**: Performance monitoring for all AWS services
- **Error Tracking**: Detailed error logging and alerting
- **Performance Metrics**: Response times and throughput monitoring
- **Security Logging**: Authentication and access event tracking
- **Cost Monitoring**: AWS Cost Explorer integration

## 🚀 Recent Improvements

### QR Code System Enhancement (Completed)
- ✅ **Fixed S3 Bucket Routing**: QR codes now use correct bucket (QR Reports vs Photos)
- ✅ **CORS Image Handling**: New S3Image component handles cross-origin loading
- ✅ **UI Enhancement**: Improved container detail dialog with QR code integration
- ✅ **Cache Optimization**: Fixed cached placeholder data issues
- ✅ **Infrastructure Recovery**: Restored CloudFront template from deployed stack

### Performance & Security Updates
- ✅ **Multi-Region Architecture**: Optimized backend (eu-west-1) and CDN (us-east-1)
- ✅ **Enhanced Security Headers**: Comprehensive CSP and security policies
- ✅ **WAF Integration**: Advanced threat protection
- ✅ **Cache Management**: Improved DynamoDB and CloudFront caching strategies

## 📚 Documentation

📚 **[Complete Documentation Index](DOCUMENTATION_INDEX.md)** - Find all documentation organized by topic and role

### Quick Access

**Getting Started:**
- [QUICK_START.md](QUICK_START.md) - Fast deployment guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment instructions
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) - Local development setup

**For Users:**
- [USER_MANAGEMENT.md](USER_MANAGEMENT.md) - Complete user management guide
- [USER_MANAGEMENT_QUICK_REFERENCE.md](USER_MANAGEMENT_QUICK_REFERENCE.md) - Quick reference
- [USER_MANAGEMENT_TROUBLESHOOTING.md](USER_MANAGEMENT_TROUBLESHOOTING.md) - Troubleshooting

**For Developers:**
- [INFRASTRUCTURE.md](INFRASTRUCTURE.md) - Architecture and AWS resources
- [frontend/src/components/USER_MANAGEMENT_COMPONENTS.md](frontend/src/components/USER_MANAGEMENT_COMPONENTS.md) - Component documentation
- [.kiro/specs/](/.kiro/specs/) - Feature specifications and design documents

**QR Code System:**
- [.kiro/specs/qr-code-system-enhancement/requirements.md](.kiro/specs/qr-code-system-enhancement/requirements.md) - QR system requirements
- [.kiro/specs/qr-code-system-enhancement/design.md](.kiro/specs/qr-code-system-enhancement/design.md) - QR system architecture
- [.kiro/specs/qr-code-system-enhancement/current-status.md](.kiro/specs/qr-code-system-enhancement/current-status.md) - Implementation status

**For Administrators:**
- [DEPLOYMENT_SCRIPTS_GUIDE.md](DEPLOYMENT_SCRIPTS_GUIDE.md) - Deployment automation
- [backend/scripts/USER_MANAGEMENT_MIGRATION.md](backend/scripts/USER_MANAGEMENT_MIGRATION.md) - Migration guide

## 🤝 Contributing

This project follows a specification-driven development approach. Before contributing:

1. Review existing specifications in `.kiro/specs/`
2. For new features, create a spec following the established format
3. Ensure all changes are documented and tested
4. Follow the existing code style and patterns

## 📄 License

ISC

## 🆘 Support

For issues, questions, or feature requests:

1. **Check Documentation**: Review the comprehensive documentation above
2. **Specification Documents**: See `.kiro/specs/` for detailed feature specifications
3. **Troubleshooting Guides**: Use the troubleshooting documentation for common issues
4. **Recent Changes**: Check the "Recent Improvements" section for latest updates

## 🎯 Project Goals

This Home Inventory System aims to provide a comprehensive, secure, and user-friendly solution for managing personal belongings with advanced features like QR code integration, making it easy to track and locate items across multiple locations.
