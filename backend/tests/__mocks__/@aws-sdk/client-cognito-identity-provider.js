// Mock AWS Cognito Identity Provider Client for testing
class CognitoIdentityProviderClient {
  constructor() {}
  
  async send(command) {
    // Mock successful responses for all commands
    return {
      Users: [{
        Username: 'test-user',
        Attributes: [
          { Name: 'email', Value: 'test@example.com' },
          { Name: 'sub', Value: '550e8400-e29b-41d4-a716-446655440000' }
        ]
      }]
    };
  }
}

class ListUsersCommand {
  constructor(params) {
    this.params = params;
  }
}

class AdminGetUserCommand {
  constructor(params) {
    this.params = params;
  }
}

module.exports = {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminGetUserCommand
};