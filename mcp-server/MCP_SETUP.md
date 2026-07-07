# MCP Server Setup

## Configuration

Copy `mcp.json` to your AI client's MCP configuration directory and update the placeholder values with your actual settings.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WHERESMYSTUFF_API_URL` | Base URL of the WheresMyStuff backend API | `https://api.wheresmystuff.example.com` |
| `WHERESMYSTUFF_USER_POOL_ID` | AWS Cognito User Pool ID | `eu-west-1_xxxxxxxxx` |
| `WHERESMYSTUFF_CLIENT_ID` | Cognito app client ID (public client, no secret) | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `WHERESMYSTUFF_COGNITO_DOMAIN` | Cognito Hosted UI domain (full domain, not just prefix) | `wheresmystuff-dev.auth.eu-west-1.amazoncognito.com` |
| `WHERESMYSTUFF_INVENTORY_ID` | Your inventory UUID (found in the web app settings) | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `WHERESMYSTUFF_REGION` | AWS region where Cognito and the API are deployed | `eu-west-1` |

## Authentication

No passwords or secrets are stored in this configuration file. Authentication is handled interactively:

1. On first run, the server opens your browser to the Cognito login page
2. You log in with your email, password, and MFA code (same as the web app)
3. The refresh token is stored securely in the macOS Keychain
4. Subsequent starts use the stored refresh token (valid ~30 days)

## Building

```bash
cd mcp-server
npm install
npm run build
```

The compiled output will be in `mcp-server/dist/index.js`.
