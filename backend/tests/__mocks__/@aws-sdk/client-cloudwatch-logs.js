// Mock AWS CloudWatch Logs client for testing
class CloudWatchLogsClient {
  constructor() {}
  
  async send(command) {
    // Mock successful responses for all commands
    return {};
  }
}

class CreateLogStreamCommand {
  constructor(params) {
    this.params = params;
  }
}

class PutLogEventsCommand {
  constructor(params) {
    this.params = params;
  }
}

module.exports = {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand
};