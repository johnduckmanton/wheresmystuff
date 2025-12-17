// Mock AWS DynamoDB Client for testing
class DynamoDBClient {
  constructor() {}
  
  async send(command) {
    // Mock successful responses for all commands
    return {};
  }
}

module.exports = {
  DynamoDBClient
};