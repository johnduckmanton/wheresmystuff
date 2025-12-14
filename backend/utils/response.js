/**
 * Get CORS headers for API responses
 * @returns {object} CORS headers object
 */
function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

/**
 * Create a success response
 * @param {*} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {object} Lambda response object
 */
function success(data, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({
      success: true,
      data
    })
  };
}

/**
 * Create an error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @returns {object} Lambda response object
 */
function error(message, statusCode = 400) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({
      success: false,
      error: message
    })
  };
}

module.exports = {
  corsHeaders,
  success,
  error
};
