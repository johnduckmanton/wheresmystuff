# Testing the Home Inventory Application

## Issue Fixed ✅

The Cognito User Pool Client has been updated to support both `USER_PASSWORD_AUTH` and `USER_SRP_AUTH` authentication flows. This resolves the "USER_SRP_AUTH is not enabled for the client" error.

## Verified Configuration

```bash
$ aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_qL27rL63E \
  --client-id 6lcv99ikkeekm526u8slo96vb9 \
  --region us-east-1 \
  --query 'UserPoolClient.ExplicitAuthFlows'

[
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH"
]
```

## Running the Application

### 1. Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

The application will be available at: `http://localhost:5173`

### 2. Sign In

Use the test credentials:
- **Email:** `test-1765150434@example.com`
- **Password:** `TestPassword123!`

### 3. Test the Application

Once signed in, you should be able to:

#### Basic CRUD Operations
- ✅ Create, read, update, and delete Things
- ✅ Create, read, update, and delete Locations
- ✅ Create, read, update, and delete Rooms
- ✅ Create, read, update, and delete Categories
- ✅ Create, read, update, and delete People

#### Photo Management
- ✅ Upload photos to Things (drag & drop or browse)
- ✅ View photo previews
- ✅ Remove photos

#### Relationships
- ✅ Associate Things with Locations
- ✅ Associate Things with Rooms
- ✅ Associate Things with Categories
- ✅ Associate Things with People (owners)

#### Table Features
- ✅ Sort by clicking column headers
- ✅ Global search across all columns
- ✅ Column-specific filtering
- ✅ Pagination
- ✅ View item counts

#### Location Features
- ✅ Expand Location rows to see associated Things
- ✅ Manage Rooms within Location dialog
- ✅ Select country from dropdown with search

## Creating Additional Test Users

If you need more test users:

```bash
# Create a new user
aws cognito-idp sign-up \
  --client-id 6lcv99ikkeekm526u8slo96vb9 \
  --username your-email@example.com \
  --password YourPassword123! \
  --region us-east-1

# Confirm the user (admin command)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id us-east-1_qL27rL63E \
  --username your-email@example.com \
  --region us-east-1
```

## Testing API Endpoints Directly

You can also test the API endpoints directly using curl:

### 1. Get a JWT Token

```bash
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 6lcv99ikkeekm526u8slo96vb9 \
  --auth-parameters USERNAME=test-1765150434@example.com,PASSWORD=TestPassword123! \
  --region us-east-1 \
  --query 'AuthenticationResult.IdToken' \
  --output text)
```

### 2. Test Endpoints

```bash
# List all things
curl -H "Authorization: Bearer $TOKEN" \
  https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/things

# List all locations
curl -H "Authorization: Bearer $TOKEN" \
  https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/locations

# List all categories
curl -H "Authorization: Bearer $TOKEN" \
  https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/categories

# List all people
curl -H "Authorization: Bearer $TOKEN" \
  https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/people

# List all rooms
curl -H "Authorization: Bearer $TOKEN" \
  https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/rooms
```

### 3. Create a Test Thing

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","description":"A test item"}' \
  https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/things
```

## Troubleshooting

### Issue: "Cannot connect to API"
**Solution:** Verify the API URL in `frontend/.env` matches the deployed API Gateway URL.

### Issue: "Authentication failed"
**Solution:** 
1. Check that the User Pool ID and Client ID in `frontend/.env` are correct
2. Verify the user exists and is confirmed in Cognito
3. Check that the password meets the requirements (min 8 chars, uppercase, lowercase, numbers)

### Issue: "Photos not uploading"
**Solution:** 
1. Verify the S3 bucket name in `frontend/.env` is correct
2. Check that CORS is configured on the S3 bucket
3. Ensure the photo file is a valid image format

### Issue: "CORS error"
**Solution:** The API Gateway is configured to allow all origins (`*`). If you still see CORS errors, check the browser console for details.

## Browser Developer Tools

Open the browser developer tools (F12) to:
- View network requests and responses
- Check for JavaScript errors in the console
- Inspect authentication tokens
- Debug API calls

## Next Steps

Once you've verified the application works locally:

1. **Deploy the frontend** to a hosting service (see `FRONTEND_DEPLOYMENT.md`)
2. **Update CORS settings** in `template.yaml` to restrict to your domain
3. **Set up monitoring** with CloudWatch alarms
4. **Configure a custom domain** for both API and frontend
5. **Set up automated backups** for DynamoDB

## Resources

- **API URL:** https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev
- **User Pool ID:** us-east-1_qL27rL63E
- **Client ID:** 6lcv99ikkeekm526u8slo96vb9
- **S3 Bucket:** home-inventory-photos-982081071280-dev
- **Region:** us-east-1

## Support

For issues or questions:
- Check `DEPLOYMENT_SUMMARY.md` for deployment details
- Review `INFRASTRUCTURE.md` for architecture information
- See `README.md` for project overview

Happy testing! 🎉
