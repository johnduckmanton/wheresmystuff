// AWS Configuration from environment variables

export const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '',
  apiUrl: import.meta.env.VITE_API_URL || '',
  s3Bucket: import.meta.env.VITE_S3_BUCKET || '',
};

// Validate that required configuration is present
export const validateConfig = (): boolean => {
  const required = [
    'userPoolId',
    'userPoolClientId',
    'apiUrl',
    's3Bucket',
  ] as const;

  const missing = required.filter((key) => !awsConfig[key]);

  if (missing.length > 0) {
    console.warn(
      'Missing AWS configuration:',
      missing.join(', '),
      '\nPlease update your .env file with the correct values.'
    );
    return false;
  }

  return true;
};
