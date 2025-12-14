# Quick Start Guide

## ✅ Authentication Issue Fixed

The Cognito User Pool Client has been updated to support both `USER_PASSWORD_AUTH` and `USER_SRP_AUTH` authentication flows. The application is now ready to use!

## Running the Application Locally

The backend is deployed to AWS, and you can run the frontend locally to test the full application.

### Prerequisites
- Node.js 20.x or later
- The backend is already deployed to AWS

### Steps

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies (if not already installed):**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5173`

5. **Sign in with test credentials:**
   - **Email:** `test-1765150434@example.com`
   - **Password:** `TestPassword123!`

### What You Can Do

Once signed in, you can:

- **Manage Things:** Create, edit, delete, and view your inventory items
- **Upload Photos:** Drag and drop photos onto Things
- **Organize by Location:** Create locations and rooms
- **Categorize Items:** Create categories and assign them to Things
- **Track Ownership:** Create people and assign them as owners
- **Search & Filter:** Use the table search and filters to find items
- **Sort Data:** Click column headers to sort

### Creating Additional Test Users

If you need more test users:

```bash
# Sign up a new user
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

### Troubleshooting

**Issue:** "Cannot connect to API"
- **Solution:** Check that the backend is deployed and the API URL in `.env` is correct

**Issue:** "Authentication failed"
- **Solution:** Verify the User Pool ID and Client ID in `.env` match the deployed values

**Issue:** "Photos not uploading"
- **Solution:** Check that the S3 bucket name in `.env` is correct and CORS is configured

### Next Steps

- Review `DEPLOYMENT_SUMMARY.md` for full deployment details
- Check `FRONTEND_DEPLOYMENT.md` for production deployment options
- See `README.md` for project overview and architecture

### Deployed Resources

- **API URL:** https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev
- **User Pool ID:** us-east-1_qL27rL63E
- **Client ID:** 6lcv99ikkeekm526u8slo96vb9
- **S3 Bucket:** home-inventory-photos-982081071280-dev
- **Region:** us-east-1

Enjoy using your Home Inventory Management System! 🎉
