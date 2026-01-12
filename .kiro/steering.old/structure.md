# Project Structure

## Key Directories
```
├── template.yaml              # AWS SAM infrastructure
├── backend/                   # Node.js Lambda functions
│   ├── handlers/              # API endpoints (inventory.js, containers.js, etc.)
│   ├── services/              # Business logic (inventoryService.js, dynamodb.js)
│   ├── middleware/            # Auth, CORS, rate limiting
│   └── tests/                 # Jest + property-based tests
├── frontend/src/              # React TypeScript app
│   ├── components/            # Reusable UI components
│   ├── pages/                 # Route components
│   ├── services/api.ts        # API client
│   └── contexts/              # React state management
└── scripts/                   # Deployment & utility scripts
```

## Conventions
- **Backend**: camelCase JS files, CommonJS imports, Express-style routing
- **Frontend**: PascalCase components, ES6 imports, Material-UI
- **Tests**: `*.test.js` suffix, Jest + fast-check for properties
- **Config**: Lambda env vars, Vite `VITE_*` vars, CloudFormation params