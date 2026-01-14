# Home Inventory System - Frontend

React + TypeScript frontend application built with Vite and Material-UI v7+.
Deployed via CloudFront with S3 origin.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material-UI v7+** - Component library
- **React Router** - Client-side routing
- **AWS Amplify** - Authentication with Cognito
- **Axios** - HTTP client for API calls

## Project Structure

```
src/
├── components/     # React components
├── services/       # API services and business logic
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── config/         # Configuration files
├── theme.ts        # Material-UI theme configuration
├── App.tsx         # Root component
└── main.tsx        # Application entry point
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS resources deployed (see backend README)

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Update the environment variables with your AWS resource values:
   - `VITE_USER_POOL_ID` - Cognito User Pool ID
   - `VITE_USER_POOL_CLIENT_ID` - Cognito User Pool Client ID
   - `VITE_API_URL` - API Gateway URL
   - `VITE_S3_BUCKET` - S3 bucket name for photos

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

The production build will be in the `dist/` directory.

### Lint

```bash
npm run lint
```

## Features (To Be Implemented)

- User authentication with AWS Cognito
- CRUD operations for Things, Locations, Rooms, Categories, and People
- Photo upload and management with S3
- Advanced data table with sorting, filtering, and search
- Responsive design for desktop, tablet, and mobile
- Nested room management within locations
- Entity relationships and references

## MUI CRUD Dashboard Template

This project is based on the Material-UI CRUD Dashboard template:
https://github.com/mui/material-ui/tree/v7.3.6/docs/data/material/getting-started/templates/crud-dashboard

The template provides:
- Professional business aesthetic
- Responsive layout with collapsible sidebar
- Pre-built data table components
- Modal dialogs for forms
- Consistent Material Design patterns
