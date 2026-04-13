const { 
  CognitoIdentityProviderClient, 
  AdminGetUserCommand,
  ListUsersCommand,
  AdminUpdateUserAttributesCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

/**
 * User Management Service
 * Provides user lookup, profile management, and Cognito integration
 */
class UserService {
  constructor() {
    this.cognitoClient = new CognitoIdentityProviderClient({});
    this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.tableName = process.env.TABLE_NAME || 'home-inventory-dev';
    this.userPoolId = process.env.USER_POOL_ID;
    
    // Retry configuration for Cognito API calls
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      backoffMultiplier: 2
    };
    
    if (!this.userPoolId) {
      throw new Error('USER_POOL_ID environment variable is required');
    }
  }

  /**
   * Execute Cognito API call with retry logic
   * @param {Function} apiCall - Function that returns a promise for the API call
   * @param {string} operation - Name of the operation for logging
   * @returns {Promise<any>} API response
   */
  async executeWithRetry(apiCall, operation) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain error types
        if (this.isNonRetryableError(error)) {
          throw this.enhanceError(error, operation);
        }
        
        // If this is the last attempt, throw the error
        if (attempt === this.retryConfig.maxRetries) {
          throw this.enhanceError(error, operation);
        }
        
        // Calculate delay for next attempt
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );
        
        console.warn(`${operation} failed (attempt ${attempt}/${this.retryConfig.maxRetries}), retrying in ${delay}ms:`, error.message);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw this.enhanceError(lastError, operation);
  }

  /**
   * Check if an error should not be retried
   * @param {Error} error - Error to check
   * @returns {boolean} True if error should not be retried
   */
  isNonRetryableError(error) {
    // Don't retry on validation errors, not found errors, or permission errors
    const nonRetryableErrors = [
      'UserNotFoundException',
      'InvalidParameterException',
      'InvalidParameterValueException',
      'NotAuthorizedException',
      'UserPoolTaggingException',
      'TooManyRequestsException' // Rate limiting - should be handled differently
    ];
    
    return nonRetryableErrors.includes(error.name) || 
           error.statusCode === 400 || 
           error.statusCode === 401 || 
           error.statusCode === 403 || 
           error.statusCode === 404;
  }

  /**
   * Enhance error with user-friendly messages
   * @param {Error} error - Original error
   * @param {string} operation - Operation that failed
   * @returns {Error} Enhanced error
   */
  enhanceError(error, operation) {
    let userMessage = `Failed to ${operation}`;
    
    switch (error.name) {
      case 'UserNotFoundException':
        userMessage = 'User not found in the system';
        break;
      case 'InvalidParameterException':
      case 'InvalidParameterValueException':
        userMessage = 'Invalid input provided';
        break;
      case 'NotAuthorizedException':
        userMessage = 'Not authorized to perform this operation';
        break;
      case 'TooManyRequestsException':
        userMessage = 'Too many requests. Please try again in a few minutes';
        break;
      case 'InternalErrorException':
        userMessage = 'Service temporarily unavailable. Please try again later';
        break;
      case 'LimitExceededException':
        userMessage = 'Service limit exceeded. Please try again later';
        break;
      default:
        if (error.message && error.message.includes('network')) {
          userMessage = 'Network error. Please check your connection and try again';
        } else if (error.message && error.message.includes('timeout')) {
          userMessage = 'Request timed out. Please try again';
        }
        break;
    }
    
    const enhancedError = new Error(userMessage);
    enhancedError.originalError = error;
    enhancedError.operation = operation;
    return enhancedError;
  }

  /**
   * Look up a user by email address in Cognito
   * @param {string} email - Email address to search for
   * @returns {Promise<object|null>} User profile or null if not found
   */
  async lookupUserByEmail(email) {
    // Enhanced email validation
    const { validateEmail } = require('../utils/validation');
    const emailValidation = validateEmail(email);
    
    if (!emailValidation.valid) {
      throw new Error(emailValidation.error);
    }

    const normalizedEmail = emailValidation.normalizedEmail;

    try {
      // Search for user in Cognito by email with retry logic
      const response = await this.executeWithRetry(async () => {
        const command = new ListUsersCommand({
          UserPoolId: this.userPoolId,
          Filter: `email = "${normalizedEmail}"`,
          Limit: 1
        });
        return await this.cognitoClient.send(command);
      }, 'lookup user by email');
      
      if (!response.Users || response.Users.length === 0) {
        return null; // User not found
      }

      const cognitoUser = response.Users[0];
      
      // Extract user information from Cognito response
      const userProfile = this.extractUserProfile(cognitoUser);
      
      // Get or create user profile in DynamoDB
      await this.ensureUserProfile(userProfile);
      
      return userProfile;
    } catch (error) {
      console.error('Error looking up user by email:', error);
      
      // If it's already an enhanced error, re-throw it
      if (error.operation) {
        throw error;
      }
      
      if (error.name === 'UserNotFoundException') {
        return null;
      }
      
      throw new Error(`Failed to lookup user: ${error.message}`);
    }
  }

  /**
   * Get user profile by User ID
   * @param {string} userId - Cognito User ID (sub)
   * @returns {Promise<object|null>} User profile or null if not found
   */
  async getUserProfile(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { validateUUID } = require('../utils/validation');
    if (!validateUUID(userId)) {
      throw new Error('Invalid User ID format');
    }

    try {
      // First try to get from DynamoDB
      const dbProfile = await this.getUserProfileFromDB(userId);
      if (dbProfile) {
        return dbProfile;
      }

      // If not in DB, get from Cognito and create profile with retry logic
      const response = await this.executeWithRetry(async () => {
        const command = new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: userId
        });
        return await this.cognitoClient.send(command);
      }, 'get user profile');

      const userProfile = this.extractUserProfile(response);
      
      // Store in DynamoDB for future lookups
      await this.ensureUserProfile(userProfile);
      
      return userProfile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      
      // If it's already an enhanced error, re-throw it
      if (error.operation) {
        throw error;
      }
      
      if (error.name === 'UserNotFoundException') {
        return null;
      }
      
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  /**
   * List users with optional filtering
   * @param {object} filters - Optional filters (email, username, etc.)
   * @param {number} limit - Maximum number of results (default: 20)
   * @returns {Promise<Array>} Array of user profiles
   */
  async listUsers(filters = {}, limit = 20) {
    // Validate limit
    if (typeof limit !== 'number' || limit < 1 || limit > 60) {
      throw new Error('Limit must be a number between 1 and 60');
    }

    try {
      const params = {
        UserPoolId: this.userPoolId,
        Limit: Math.min(limit, 60) // Cognito max is 60
      };

      // Validate and add filter if provided
      if (filters.email) {
        const { validateEmail } = require('../utils/validation');
        const emailValidation = validateEmail(filters.email);
        if (!emailValidation.valid) {
          throw new Error(`Invalid email filter: ${emailValidation.error}`);
        }
        params.Filter = `email ^= "${emailValidation.normalizedEmail}"`;
      } else if (filters.username) {
        if (typeof filters.username !== 'string' || filters.username.trim().length === 0) {
          throw new Error('Username filter must be a non-empty string');
        }
        params.Filter = `username ^= "${filters.username.trim()}"`;
      }

      const response = await this.executeWithRetry(async () => {
        const command = new ListUsersCommand(params);
        return await this.cognitoClient.send(command);
      }, 'list users');

      if (!response.Users) {
        return [];
      }

      // Convert Cognito users to our user profile format
      const userProfiles = response.Users.map(user => this.extractUserProfile(user));
      
      // Ensure all profiles exist in DynamoDB (with error handling)
      const profilePromises = userProfiles.map(async (profile) => {
        try {
          await this.ensureUserProfile(profile);
          return profile;
        } catch (error) {
          console.warn(`Failed to ensure profile for user ${profile.userId}:`, error.message);
          return profile; // Return profile even if DB operation fails
        }
      });
      
      return await Promise.all(profilePromises);
    } catch (error) {
      console.error('Error listing users:', error);
      
      // If it's already an enhanced error, re-throw it
      if (error.operation) {
        throw error;
      }
      
      throw new Error(`Failed to list users: ${error.message}`);
    }
  }

  /**
   * Update user profile information
   * @param {string} userId - User ID to update
   * @param {object} updates - Profile updates
   * @returns {Promise<object>} Updated user profile
   */
  async updateUserProfile(userId, updates) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const now = new Date().toISOString();
      
      // Update in DynamoDB
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
      
      if (updates.displayName) {
        updateExpression.push('#displayName = :displayName');
        expressionAttributeNames['#displayName'] = 'displayName';
        expressionAttributeValues[':displayName'] = updates.displayName;
      }

      if (updates.avatarUrl !== undefined) {
        updateExpression.push('#avatarUrl = :avatarUrl');
        expressionAttributeNames['#avatarUrl'] = 'avatarUrl';
        expressionAttributeValues[':avatarUrl'] = updates.avatarUrl;
      }
      
      // Always update the updatedAt timestamp
      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = now;

      if (updateExpression.length === 1) {
        // Only updatedAt, no actual changes
        throw new Error('No valid updates provided');
      }

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `USER#${userId}`,
          sk: 'PROFILE'
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      });

      const response = await this.dynamoClient.send(command);
      return response.Attributes;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }

  /**
   * Extract user profile from Cognito user object
   * @param {object} cognitoUser - Cognito user object
   * @returns {object} Standardized user profile
   */
  extractUserProfile(cognitoUser) {
    const attributes = {};
    
    // Handle both AdminGetUser and ListUsers response formats
    if (cognitoUser.UserAttributes) {
      // AdminGetUser format
      cognitoUser.UserAttributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });
    } else if (cognitoUser.Attributes) {
      // ListUsers format
      cognitoUser.Attributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });
    }

    return {
      userId: cognitoUser.Username || attributes.sub,
      email: attributes.email,
      username: cognitoUser.Username || attributes.email,
      displayName: attributes.name || attributes.given_name || attributes.email,
      emailVerified: attributes.email_verified === 'true',
      enabled: cognitoUser.Enabled !== false,
      userStatus: cognitoUser.UserStatus || 'CONFIRMED',
      createdAt: cognitoUser.UserCreateDate ? cognitoUser.UserCreateDate.toISOString() : new Date().toISOString(),
      updatedAt: cognitoUser.UserLastModifiedDate ? cognitoUser.UserLastModifiedDate.toISOString() : new Date().toISOString()
    };
  }

  /**
   * Get user profile from DynamoDB
   * @param {string} userId - User ID
   * @returns {Promise<object|null>} User profile or null
   */
  async getUserProfileFromDB(userId) {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `USER#${userId}`,
          sk: 'PROFILE'
        }
      });

      const response = await this.dynamoClient.send(command);
      return response.Item || null;
    } catch (error) {
      console.error('Error getting user profile from DB:', error);
      return null;
    }
  }

  /**
   * Ensure user profile exists in DynamoDB
   * @param {object} userProfile - User profile to store
   * @returns {Promise<object>} Stored user profile
   */
  async ensureUserProfile(userProfile) {
    try {
      // Check if profile already exists
      const existing = await this.getUserProfileFromDB(userProfile.userId);
      if (existing) {
        return existing;
      }

      // Create new profile
      const profileData = {
        pk: `USER#${userProfile.userId}`,
        sk: 'PROFILE',
        ...userProfile,
        createdAt: userProfile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: profileData,
        ConditionExpression: 'attribute_not_exists(pk)' // Only create if doesn't exist
      });

      await this.dynamoClient.send(command);
      return profileData;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        // Profile already exists, get it
        return await this.getUserProfileFromDB(userProfile.userId);
      }
      
      console.error('Error ensuring user profile:', error);
      throw new Error(`Failed to create user profile: ${error.message}`);
    }
  }

  /**
   * Check if email address exists in Cognito
   * @param {string} email - Email address to check
   * @returns {Promise<boolean>} True if email exists
   */
  async emailExists(email) {
    const user = await this.lookupUserByEmail(email);
    return user !== null;
  }

  /**
   * Get user's last login time
   * @param {string} userId - User ID
   * @returns {Promise<string|null>} Last login timestamp or null
   */
  async getLastLoginTime(userId) {
    try {
      const profile = await this.getUserProfileFromDB(userId);
      return profile?.lastLoginAt || null;
    } catch (error) {
      console.error('Error getting last login time:', error);
      return null;
    }
  }

  /**
   * Update user's last login time
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async updateLastLoginTime(userId) {
    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `USER#${userId}`,
          sk: 'PROFILE'
        },
        UpdateExpression: 'SET #lastLoginAt = :timestamp',
        ExpressionAttributeNames: {
          '#lastLoginAt': 'lastLoginAt'
        },
        ExpressionAttributeValues: {
          ':timestamp': new Date().toISOString()
        }
      });

      await this.dynamoClient.send(command);
    } catch (error) {
      console.error('Error updating last login time:', error);
      // Don't throw - this is not critical
    }
  }
}

module.exports = new UserService();