// Quick test script to verify getUserInventories works
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'home-inventory-dev';

async function getUserInventories(userId) {
  console.log(`Scanning for memberships for user: ${userId}`);
  
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(pk, :invPrefix) AND begins_with(sk, :memberPrefix) AND userId = :userId',
    ExpressionAttributeValues: {
      ':invPrefix': 'INVENTORY#',
      ':memberPrefix': 'MEMBER#',
      ':userId': userId
    }
  }));
  
  console.log(`Found ${result.Items.length} memberships`);
  
  if (!result.Items || result.Items.length === 0) {
    return [];
  }
  
  const inventories = [];
  for (const membership of result.Items) {
    console.log(`Fetching inventory: ${membership.inventoryId}`);
    try {
      const invResult = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `INVENTORY#${membership.inventoryId}`,
          sk: 'METADATA'
        }
      }));
      
      if (invResult.Item) {
        inventories.push({
          ...invResult.Item,
          userRole: membership.role,
          userPermissions: membership.permissions
        });
      }
    } catch (err) {
      console.error(`Error fetching inventory ${membership.inventoryId}:`, err);
    }
  }
  
  return inventories;
}

// Test with the user
getUserInventories('6428b4b8-6051-70d4-4949-b85da852b389')
  .then(inventories => {
    console.log('\n=== RESULT ===');
    console.log(`Found ${inventories.length} inventories:`);
    inventories.forEach(inv => {
      console.log(`- ${inv.name} (${inv.id}) - Role: ${inv.userRole}`);
    });
  })
  .catch(err => {
    console.error('Error:', err);
  });
