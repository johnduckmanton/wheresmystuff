# Remote MCP Server Setup

Deploy the WheresMyStuff MCP server as a serverless remote service on AWS. Once deployed, any MCP-compatible client (Claude Desktop, Kiro, etc.) can connect by configuring a single URL — no local server process required.

## Prerequisites

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured with credentials
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) v1.100+
- Node.js 22.x
- An existing WheresMyStuff Cognito User Pool with a configured app client and Hosted UI domain

## Required SAM Parameters

These are provided during `sam deploy --guided` and stored in `samconfig.toml` for subsequent deploys:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `ApiUrl` | Base URL of the WheresMyStuff backend API | `https://api.wheresmystuff.example.com` |
| `UserPoolId` | Cognito User Pool ID | `eu-west-1_xxxxxxxxx` |
| `ClientId` | Cognito app client ID (public client, no secret) | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `CognitoDomain` | Cognito Hosted UI domain (full domain) | `wheresmystuff-dev.auth.eu-west-1.amazoncognito.com` |
| `TokenSigningSecret` | Secret string for signing server-issued JWT tokens | A random 32+ character string |

> **Security note:** `TokenSigningSecret` is marked `NoEcho` in the SAM template and will not be displayed in CloudFormation console output. Generate a strong random value, e.g. `openssl rand -hex 32`.

## Build and Deploy

```bash
cd mcp-server

# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run build

# 3. Build the SAM application (packages Lambda artifacts)
sam build

# 4. Deploy (first time — interactive prompts for parameters)
sam deploy --guided
```

On the first deploy, `sam deploy --guided` will prompt you for the stack name, region, and each parameter value listed above. Your choices are saved to `samconfig.toml` so subsequent deploys only need:

```bash
sam build && sam deploy
```

After a successful deploy, the stack outputs include `McpEndpoint` — the URL you'll use for client configuration.

## Client Configuration

### Claude Desktop

Add the following to your Claude Desktop MCP configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "wheresmystuff": {
      "url": "https://YOUR_API_GATEWAY_URL/mcp"
    }
  }
}
```

Replace `YOUR_API_GATEWAY_URL` with the `McpEndpoint` value from the stack outputs (without the trailing `/mcp` path if it's already included in the output).

You can find the endpoint URL at any time by running:

```bash
sam list stack-outputs --stack-name YOUR_STACK_NAME
```

### Other MCP Clients

Any MCP client that supports Streamable HTTP transport can connect using the same URL. The server advertises its OAuth configuration automatically via the `/.well-known/oauth-authorization-server` endpoint, so clients that support MCP OAuth will handle authentication without additional setup.

## OAuth Flow (User Perspective)

1. **First connection** — When your MCP client connects to the server for the first time, it receives a `401` response with OAuth metadata.
2. **Browser login** — The client opens your browser to the Cognito login page. You sign in with your email, password, and MFA code (the same credentials you use for the WheresMyStuff web app).
3. **Authorization granted** — After successful login, Cognito redirects back to the server, which issues an access token to the MCP client.
4. **Session established** — The client uses the access token for all subsequent requests. Your inventory is resolved automatically from your Cognito identity.
5. **Automatic session maintenance** — Sessions remain active as long as you're using the client (30-minute inactivity timeout). No re-login is required within the Cognito refresh token lifetime (~30 days).
6. **Re-authentication** — If your refresh token expires (after ~30 days of inactivity), the client will prompt the browser login flow again.

## Monitoring

### CloudWatch Logs

All requests are logged in structured JSON format, automatically picked up by CloudWatch Logs. Each log entry includes:

- Timestamp
- HTTP method and path
- Session ID (when present)
- Response status code
- Duration in milliseconds
- Lambda request ID

View logs in the AWS Console or via CLI:

```bash
sam logs --stack-name YOUR_STACK_NAME --tail
```

### Session Cleanup

Sessions are stored in DynamoDB with a TTL attribute. Inactive sessions (no requests for 30 minutes) are automatically deleted by DynamoDB's TTL mechanism — no manual cleanup or cron jobs required.

### Health Check

The server exposes a `GET /health` endpoint that returns `{"status": "ok"}` for basic uptime monitoring.

## Cost Considerations

The remote MCP server uses a fully serverless architecture with **no fixed monthly costs**:

| Service | Pricing Model | Free Tier |
|---------|---------------|-----------|
| API Gateway HTTP API | $1.00 per million requests | 1M requests/month (first 12 months) |
| Lambda | $0.20 per million invocations + compute time | 1M requests/month, 400K GB-seconds/month |
| DynamoDB (on-demand) | Pay per read/write request | 25 GB storage, 25 WRU/25 RRU |

For typical personal use (fewer than 1,000 requests per day), the service operates **entirely within the AWS Free Tier**. Even after the 12-month API Gateway free tier expires, costs remain minimal at this scale (under $1/month).

There is no ALB, NAT Gateway, or always-on compute — you only pay for what you use.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` on every request | Token expired or misconfigured `ClientId` | Re-authenticate; verify `ClientId` matches the Cognito app client |
| `Session not found` (404) | Session expired due to inactivity | The client will automatically re-establish the session |
| `503 Service at capacity` | Max concurrent sessions reached (default 1000) | Increase `MAX_SESSIONS` env var or wait for idle sessions to expire |
| OAuth redirect fails | `CognitoDomain` misconfigured | Ensure it's the full domain (e.g., `prefix.auth.region.amazoncognito.com`) |
| Cold start latency | First request after idle period | Expected (typically 1-3 seconds); subsequent requests are faster |
