# Home Inventory System

Serverless web app for tracking personal belongings across locations with QR codes.

## Core Features
- **Container Management**: Track containers with QR codes for instant mobile access
- **Multi-User**: Role-based access (Owner/Admin/Member/Read-only) with invitations  
- **Location Organization**: Organize by addresses, rooms, floors
- **Moving Projects**: Specialized relocation workflows
- **Photo Management**: S3 storage with upload/view capabilities

## Target Users
Individuals, families, and organizations managing household inventory, moves, or equipment tracking.

## Architecture
Multi-region AWS serverless (Backend: eu-west-1, CDN: us-east-1) for cost efficiency.