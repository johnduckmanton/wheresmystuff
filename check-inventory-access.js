const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

async function checkAccess() {
  const result = await docClient.send(new ScanCommand({
    TableName: 'home-inventory-dev',
    FilterExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': 'INVENTORY#4157a8a8-d8d0-4e7f-b67d-1cf6dd674c04',
      ':sk': 'MEMBER#'
    }
  }));
  
  console.log('Members of inventory 4157a8a8-d8d0-4e7f-b67d-1cf6dd674c04:');
  result.Items.forEach(item => {
    console.log('User:', item.sk.replace('MEMBER#', ''), 'Role:', item.role);
  });
}

checkAccess().catch(console.error);