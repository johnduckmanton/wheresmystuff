# How to Get johnduckmanton@hotmail.com to Sign Up

## ✅ Frontend is Now Deployed!

The application is now live at:
**https://d2m4d2elac4ekv.cloudfront.net** (HTTPS via CloudFront)

Alternative URL: http://home-inventory-frontend-982081071280-simple.s3-website-us-east-1.amazonaws.com

---

## 📧 Send These Instructions to the User

### Email Template

```
Subject: Invitation to Home Inventory System

Hi John,

I'd like to add you to my home inventory system. To get started:

1. Go to: https://d2m4d2elac4ekv.cloudfront.net

2. Click "Sign Up" at the bottom of the sign-in page

3. Enter your email: johnduckmanton@hotmail.com

4. Create a password (must be at least 8 characters with uppercase, lowercase, and numbers)

5. Click "Create Account"

6. Check your email for a verification code and enter it on the verification page

7. Once verified, you'll be automatically signed in

8. Let me know when you're signed up, and I'll add you to my inventory as an owner

Thanks!
```

---

## 🔧 After They Sign Up

Once they've created their account, run this command to add them as an owner:

```bash
export USER_POOL_ID="us-east-1_qL27rL63E"
export TABLE_NAME="home-inventory-dev"
export AWS_REGION="us-east-1"
export ROLE="owner"

./backend/scripts/add-admin-user.sh \
  johnduckmanton@hotmail.com \
  4157a8a8-d8d0-4e7f-b67d-1cf6dd674c04 \
  f438c408-90e1-7041-3068-c2f110cf3980
```

This will:
- Look up their user account in Cognito
- Add them to your inventory with owner role
- Log the operation for audit purposes
- Grant them full permissions

---

## 🎯 What They'll See

After signing up and being added to your inventory:

1. **Their Own Inventory**: They'll automatically get a default inventory
2. **Your Inventory**: After you run the script, they'll also see your inventory
3. **Full Owner Access**: They can manage everything in your inventory

---

## 🔍 Verify They Signed Up

To check if they've created an account:

```bash
aws cognito-idp list-users \
  --user-pool-id us-east-1_qL27rL63E \
  --filter 'email = "johnduckmanton@hotmail.com"'
```

If this returns a user, they're ready to be added!

---

## ⚡ Alternative: Create Account via AWS CLI

If you prefer to create the account for them (they'll set their password on first login):

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_qL27rL63E \
  --username johnduckmanton@hotmail.com \
  --user-attributes \
    Name=email,Value=johnduckmanton@hotmail.com \
    Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL
```

This will:
- Create their account
- Send them an email with a temporary password
- They'll be prompted to change it on first login

Then immediately run the add-user script above.

**Note:** The web-based signup is now available and is the recommended method!

---

## 📱 Application URL

**CloudFront URL (HTTPS, recommended)**: https://d2m4d2elac4ekv.cloudfront.net

**S3 Website URL (HTTP, alternative)**: http://home-inventory-frontend-982081071280-simple.s3-website-us-east-1.amazonaws.com

Note: The CloudFront URL is now working and provides HTTPS security. Use this URL for production access.

---

## 🎉 Summary

1. ✅ Frontend deployed successfully
2. ✅ Admin script created and ready
3. ✅ Your data is safe in the database
4. ⏳ Waiting for user to sign up
5. ⏳ Then run the script to add them as owner

The application should be accessible now (or in 2-3 minutes if CloudFront is still propagating).
