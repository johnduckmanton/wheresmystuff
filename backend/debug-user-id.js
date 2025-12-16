#!/usr/bin/env node

/**
 * Debug script to check what user ID is being used in API requests
 * This will help us understand the mismatch between frontend auth and database
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

async function debugUserIds() {
  console.log('🔍 Debug: User ID Mismatch Investigation');
  console.log('==========================================');
  
  // Check what user IDs exist in the database
  console.log('📋 User IDs found in database:');
  
  const result = await docClient.send(new ScanCommand({
    TableName: 'home-inventory-dev',
    FilterExpression: 'begins_with(sk, :memberPrefix)',
    ExpressionAttributeValues: {
      ':memberPrefix': 'MEMBER#'
    }
  }));
  
  const userIds = new Set();
  result.Items?.forEach(item => {
    userIds.add(item.userId);
  });
  
  userIds.forEach(userId => {
    console.log(`   - ${userId}`);
  });
  
  console.log('');
  console.log('🎯 The main user ID with data: f438c408-90e1-7041-3068-c2f110cf3980');
  console.log('');
  console.log('💡 To fix this issue, you need to:');
  console.log('   1. Check what user ID your frontend authentication is using');
  console.log('   2. Either:');
  console.log('      a) Update the database to use your current user ID, OR');
  console.log('      b) Create a new inventory for your current user ID');
  console.log('');
  console.log('📝 Check the browser network tab:');
  console.log('   - Look at the Authorization header in the /inventories request');
  console.log('   - Decode the JWT token to see the user ID (sub field)');
  console.log('');
  console.log('🔧 Quick fix options:');
  console.log('   1. Create a script to migrate data to your current user ID');
  console.log('   2. Or manually create an inventory for your current user');
}

debugUserIds().catch(console.error);