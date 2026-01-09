import { Amplify } from 'aws-amplify';

// Use the exact configuration format from AWS Amplify v6 documentation
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || 'eu-west-1_VM85YGyV9',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '3kqeofa67e8buekk9cgav42216',
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code' as const,
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
};

// Configure Amplify
Amplify.configure(amplifyConfig);

export default amplifyConfig;
