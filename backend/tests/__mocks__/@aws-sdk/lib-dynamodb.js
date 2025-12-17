// Mock AWS DynamoDB Document Client for testing
class DynamoDBDocumentClient {
  constructor() {}
  
  static from(client) {
    return new DynamoDBDocumentClient();
  }
  
  async send(command) {
    // Mock successful responses for all commands
    return {};
  }
}

class PutCommand {
  constructor(params) {
    this.params = params;
  }
}

class GetCommand {
  constructor(params) {
    this.params = params;
  }
}

class QueryCommand {
  constructor(params) {
    this.params = params;
  }
}

class UpdateCommand {
  constructor(params) {
    this.params = params;
  }
}

class DeleteCommand {
  constructor(params) {
    this.params = params;
  }
}

module.exports = {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand
};