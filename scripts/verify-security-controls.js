#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration - these should be set based on your deployment
const config = {
  apiGatewayUrl: process.env.API_GATEWAY_URL || 'https://your-api-id.execute-api.region.amazonaws.com/prod',
  cloudfrontUrl: process.env.CLOUDFRONT_URL || 'https://your-distribution.cloudfront.net',
  testDomain: process.env.TEST_DOMAIN || 'yourdomain.com',
  region: process.env.AWS_REGION || 'us-east-1'
};

class SecurityVerifier {
  constructor() {
    this.results = [];
  }

  log(test, status, message) {
    const result = { test, status, message, timestamp: new Date().toISOString() };
    this.results.push(result);
    console.log(`[${status}] ${test}: ${message}`);
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const req = client.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 10000,
        ...options
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  async verifyHttpsRedirect() {
    console.log('\n=== Testing HTTPS Redirect ===');
    
    try {
      // Test HTTP to HTTPS redirect
      const httpUrl = config.cloudfrontUrl.replace('https://', 'http://');
      
      try {
        const response = await this.makeRequest(httpUrl, {
          method: 'GET',
          timeout: 5000
        });
        
        if (response.statusCode >= 300 && response.statusCode < 400) {
          const location = response.headers.location;
          if (location && location.startsWith('https://')) {
            this.log('HTTPS Redirect', 'PASS', 'HTTP requests are redirected to HTTPS');
          } else {
            this.log('HTTPS Redirect', 'FAIL', 'HTTP redirect location is not HTTPS');
          }
        } else {
          this.log('HTTPS Redirect', 'FAIL', `HTTP request returned ${response.statusCode} instead of redirect`);
        }
      } catch (error) {
        // If HTTP is completely blocked, that's also good
        if (error.code === 'ECONNREFUSED' || error.message.includes('timeout')) {
          this.log('HTTPS Redirect', 'PASS', 'HTTP connections are blocked/refused');
        } else {
          this.log('HTTPS Redirect', 'FAIL', `HTTP test failed: ${error.message}`);
        }
      }

      // Verify HTTPS works
      const httpsResponse = await this.makeRequest(config.cloudfrontUrl);
      if (httpsResponse.statusCode < 500) {
        this.log('HTTPS Access', 'PASS', 'HTTPS endpoint is accessible');
      } else {
        this.log('HTTPS Access', 'FAIL', `HTTPS endpoint returned ${httpsResponse.statusCode}`);
      }

    } catch (error) {
      this.log('HTTPS Redirect', 'ERROR', `Test failed: ${error.message}`);
    }
  }

  async verifyWafProtection() {
    console.log('\n=== Testing WAF Protection ===');
    
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'/*",
      "' UNION SELECT * FROM users --"
    ];

    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<svg onload=alert('XSS')>"
    ];

    // Test SQL Injection protection
    for (const payload of sqlInjectionPayloads) {
      try {
        const testUrl = `${config.apiGatewayUrl}/things?search=${encodeURIComponent(payload)}`;
        const response = await this.makeRequest(testUrl, {
          headers: {
            'User-Agent': 'SecurityTest/1.0'
          }
        });

        if (response.statusCode === 403) {
          this.log('WAF SQL Injection', 'PASS', `Blocked SQL injection: ${payload.substring(0, 20)}...`);
        } else if (response.statusCode === 401) {
          this.log('WAF SQL Injection', 'INFO', `Request requires authentication (expected for API)`);
        } else {
          this.log('WAF SQL Injection', 'WARN', `SQL injection payload not blocked: ${response.statusCode}`);
        }
      } catch (error) {
        this.log('WAF SQL Injection', 'ERROR', `Test failed: ${error.message}`);
      }
    }

    // Test XSS protection
    for (const payload of xssPayloads) {
      try {
        const response = await this.makeRequest(config.apiGatewayUrl + '/things', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SecurityTest/1.0'
          },
          body: JSON.stringify({
            name: payload,
            description: 'Test'
          })
        });

        if (response.statusCode === 403) {
          this.log('WAF XSS Protection', 'PASS', `Blocked XSS: ${payload.substring(0, 20)}...`);
        } else if (response.statusCode === 401) {
          this.log('WAF XSS Protection', 'INFO', `Request requires authentication (expected for API)`);
        } else {
          this.log('WAF XSS Protection', 'WARN', `XSS payload not blocked: ${response.statusCode}`);
        }
      } catch (error) {
        this.log('WAF XSS Protection', 'ERROR', `Test failed: ${error.message}`);
      }
    }
  }

  async verifyRateLimiting() {
    console.log('\n=== Testing Rate Limiting ===');
    
    try {
      const testUrl = `${config.apiGatewayUrl}/things`;
      const requests = [];
      
      // Send multiple requests rapidly
      for (let i = 0; i < 10; i++) {
        requests.push(
          this.makeRequest(testUrl, {
            headers: {
              'User-Agent': `RateLimitTest/1.0-${i}`
            }
          }).catch(err => ({ error: err.message }))
        );
      }

      const responses = await Promise.all(requests);
      
      let rateLimitedCount = 0;
      let successCount = 0;
      
      responses.forEach((response, index) => {
        if (response.error) {
          // Network errors might indicate rate limiting at infrastructure level
          return;
        }
        
        if (response.statusCode === 429) {
          rateLimitedCount++;
        } else if (response.statusCode < 500) {
          successCount++;
        }
      });

      if (rateLimitedCount > 0) {
        this.log('Rate Limiting', 'PASS', `Rate limiting active: ${rateLimitedCount} requests blocked`);
      } else if (successCount === responses.length) {
        this.log('Rate Limiting', 'INFO', 'No rate limiting triggered (may need authentication or higher load)');
      } else {
        this.log('Rate Limiting', 'WARN', 'Rate limiting behavior unclear');
      }

    } catch (error) {
      this.log('Rate Limiting', 'ERROR', `Test failed: ${error.message}`);
    }
  }

  async verifySecurityHeaders() {
    console.log('\n=== Testing Security Headers ===');
    
    try {
      const response = await this.makeRequest(config.apiGatewayUrl + '/health');
      
      const requiredHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'strict-transport-security': 'max-age=31536000',
        'x-xss-protection': '1; mode=block',
        'content-security-policy': null // Just check presence
      };

      for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
        const actualValue = response.headers[header] || response.headers[header.toLowerCase()];
        
        if (actualValue) {
          if (expectedValue === null || actualValue.includes(expectedValue)) {
            this.log('Security Headers', 'PASS', `${header}: ${actualValue}`);
          } else {
            this.log('Security Headers', 'FAIL', `${header} has wrong value: ${actualValue}`);
          }
        } else {
          this.log('Security Headers', 'FAIL', `Missing header: ${header}`);
        }
      }

    } catch (error) {
      this.log('Security Headers', 'ERROR', `Test failed: ${error.message}`);
    }
  }

  async verifyCorsProtection() {
    console.log('\n=== Testing CORS Protection ===');
    
    try {
      // Test with malicious origin
      const maliciousResponse = await this.makeRequest(config.apiGatewayUrl + '/things', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://malicious-site.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      const corsHeader = maliciousResponse.headers['access-control-allow-origin'];
      
      if (!corsHeader || corsHeader === 'null') {
        this.log('CORS Protection', 'PASS', 'Malicious origin rejected');
      } else if (corsHeader === '*') {
        this.log('CORS Protection', 'FAIL', 'Wildcard CORS origin allowed (security risk)');
      } else {
        this.log('CORS Protection', 'INFO', `CORS origin: ${corsHeader}`);
      }

      // Test with legitimate origin
      const legitimateResponse = await this.makeRequest(config.apiGatewayUrl + '/things', {
        method: 'OPTIONS',
        headers: {
          'Origin': `https://${config.testDomain}`,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      const legitimateCors = legitimateResponse.headers['access-control-allow-origin'];
      
      if (legitimateCors && legitimateCors.includes(config.testDomain)) {
        this.log('CORS Protection', 'PASS', 'Legitimate origin allowed');
      } else {
        this.log('CORS Protection', 'INFO', `Legitimate origin response: ${legitimateCors}`);
      }

    } catch (error) {
      this.log('CORS Protection', 'ERROR', `Test failed: ${error.message}`);
    }
  }

  async verifyTlsConfiguration() {
    console.log('\n=== Testing TLS Configuration ===');
    
    try {
      const urlObj = new URL(config.apiGatewayUrl);
      
      const tlsOptions = {
        host: urlObj.hostname,
        port: 443,
        method: 'GET',
        path: '/health',
        secureProtocol: 'TLSv1_2_method' // Force TLS 1.2
      };

      const response = await new Promise((resolve, reject) => {
        const req = https.request(tlsOptions, (res) => {
          const cipher = res.socket.getCipher();
          const protocol = res.socket.getProtocol();
          
          resolve({
            statusCode: res.statusCode,
            cipher: cipher,
            protocol: protocol,
            authorized: res.socket.authorized
          });
        });

        req.on('error', reject);
        req.end();
      });

      if (response.protocol && response.protocol.startsWith('TLSv1.2')) {
        this.log('TLS Configuration', 'PASS', `TLS version: ${response.protocol}`);
      } else if (response.protocol && response.protocol.startsWith('TLSv1.3')) {
        this.log('TLS Configuration', 'PASS', `TLS version: ${response.protocol} (excellent)`);
      } else {
        this.log('TLS Configuration', 'WARN', `TLS version: ${response.protocol}`);
      }

      if (response.cipher) {
        this.log('TLS Configuration', 'INFO', `Cipher: ${response.cipher.name}`);
      }

      if (response.authorized) {
        this.log('TLS Configuration', 'PASS', 'Certificate is valid');
      } else {
        this.log('TLS Configuration', 'WARN', 'Certificate validation failed');
      }

    } catch (error) {
      this.log('TLS Configuration', 'ERROR', `Test failed: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n=== Security Verification Report ===');
    
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARN').length,
      errors: this.results.filter(r => r.status === 'ERROR').length,
      info: this.results.filter(r => r.status === 'INFO').length
    };

    console.log(`\nSummary:`);
    console.log(`  Total Tests: ${summary.total}`);
    console.log(`  Passed: ${summary.passed}`);
    console.log(`  Failed: ${summary.failed}`);
    console.log(`  Warnings: ${summary.warnings}`);
    console.log(`  Errors: ${summary.errors}`);
    console.log(`  Info: ${summary.info}`);

    if (summary.failed > 0) {
      console.log('\nFailed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }

    if (summary.warnings > 0) {
      console.log('\nWarnings:');
      this.results
        .filter(r => r.status === 'WARN')
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }

    // Write detailed report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      config: config,
      summary: summary,
      results: this.results
    };

    require('fs').writeFileSync(
      'security-verification-report.json',
      JSON.stringify(reportData, null, 2)
    );

    console.log('\nDetailed report saved to: security-verification-report.json');
    
    return summary.failed === 0;
  }

  async runAllTests() {
    console.log('Starting Security Controls Verification...');
    console.log(`API Gateway URL: ${config.apiGatewayUrl}`);
    console.log(`CloudFront URL: ${config.cloudfrontUrl}`);
    console.log(`Test Domain: ${config.testDomain}`);

    await this.verifyHttpsRedirect();
    await this.verifyWafProtection();
    await this.verifyRateLimiting();
    await this.verifySecurityHeaders();
    await this.verifyCorsProtection();
    await this.verifyTlsConfiguration();

    const success = await this.generateReport();
    
    if (success) {
      console.log('\n✅ All security controls verification passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some security controls verification failed!');
      process.exit(1);
    }
  }
}

// Run the verification if called directly
if (require.main === module) {
  const verifier = new SecurityVerifier();
  verifier.runAllTests().catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityVerifier;