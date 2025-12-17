// Mock AWS S3 Request Presigner for testing
async function getSignedUrl(client, command, options = {}) {
  return 'https://mock-presigned-url.s3.amazonaws.com/test-key?signature=mock';
}

module.exports = {
  getSignedUrl
};