#!/bin/bash

# Get a token for the user
echo "Testing API call for johnduckmanton@hotmail.com"
echo "User ID: 6428b4b8-6051-70d4-4949-b85da852b389"
echo ""
echo "You need to:"
echo "1. Log in as johnduckmanton@hotmail.com at https://d2m4d2elac4ekv.cloudfront.net"
echo "2. Open browser DevTools (F12)"
echo "3. Go to Console tab"
echo "4. Run this command:"
echo ""
echo "fetch('https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/inventories', {"
echo "  headers: {"
echo "    'Authorization': localStorage.getItem('idToken')"
echo "  }"
echo "}).then(r => r.json()).then(console.log)"
echo ""
echo "This will show you what inventories the API returns."
