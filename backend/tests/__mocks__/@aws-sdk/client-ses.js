// Mock AWS SES Client for testing
class SESClient {
  constructor() {}
  
  async send(command) {
    // Mock successful responses for all commands
    return {
      MessageId: 'test-message-id-123'
    };
  }
}

class SendEmailCommand {
  constructor(params) {
    this.params = params;
  }
}

module.exports = {
  SESClient,
  SendEmailCommand
};