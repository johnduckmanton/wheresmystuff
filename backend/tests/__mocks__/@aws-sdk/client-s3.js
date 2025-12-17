// Mock AWS S3 Client for testing
class S3Client {
  constructor() {}
  
  async send(command) {
    // Mock successful responses for all commands
    return {};
  }
}

class PutObjectCommand {
  constructor(params) {
    this.params = params;
  }
}

class GetObjectCommand {
  constructor(params) {
    this.params = params;
  }
}

class DeleteObjectCommand {
  constructor(params) {
    this.params = params;
  }
}

module.exports = {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
};