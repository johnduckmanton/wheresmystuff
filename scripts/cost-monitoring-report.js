#!/usr/bin/env node

/**
 * Cost Monitoring and Reporting Script
 * Generates monthly cost reports showing free tier usage and optimization recommendations
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configuration
const ENVIRONMENT = process.argv[2] || 'dev';
const REGION = process.argv[3] || 'eu-west-1';
const REPORT_MONTHS = parseInt(process.argv[4]) || 3; // Number of months to analyze

// AWS Configuration
AWS.config.update({ region: 'us-east-1' }); // Billing metrics are only in us-east-1
const cloudwatch = new AWS.CloudWatch();
const budgets = new AWS.Budgets();

// Free tier limits (monthly)
const FREE_TIER_LIMITS = {
    lambda: {
        requests: 1000000, // 1M requests
        computeTime: 400000, // 400,000 GB-seconds
        name: 'AWS Lambda'
    },
    apiGateway: {
        requests: 1000000, // 1M API calls
        name: 'Amazon API Gateway'
    },
    s3: {
        storage: 5 * 1024 * 1024 * 1024, // 5GB in bytes
        getRequests: 20000, // 20,000 GET requests
        putRequests: 2000, // 2,000 PUT requests
        name: 'Amazon S3'
    },
    cloudWatch: {
        logIngestion: 5 * 1024 * 1024 * 1024, // 5GB in bytes
        customMetrics: 10, // 10 custom metrics
        apiRequests: 1000000, // 1M API requests
        name: 'Amazon CloudWatch'
    },
    dynamodb: {
        // DynamoDB doesn't have a traditional free tier, but has on-demand pricing
        readUnits: 25 * 1024 * 1024 * 1024, // 25GB of data storage (free)
        writeUnits: 25 * 1024 * 1024 * 1024, // 25GB of data storage (free)
        name: 'Amazon DynamoDB'
    }
};

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'blue') {
    const timestamp = new Date().toISOString();
    console.log(`${colors[color]}[${timestamp}]${colors.reset} ${message}`);
}

function error(message) {
    log(`ERROR: ${message}`, 'red');
}

function warning(message) {
    log(`WARNING: ${message}`, 'yellow');
}

function success(message) {
    log(`SUCCESS: ${message}`, 'green');
}

/**
 * Get billing metrics for a specific service
 */
async function getBillingMetrics(serviceName, startDate, endDate) {
    try {
        const params = {
            Namespace: 'AWS/Billing',
            MetricName: 'EstimatedCharges',
            Dimensions: [
                {
                    Name: 'Currency',
                    Value: 'USD'
                }
            ],
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400, // Daily
            Statistics: ['Maximum']
        };

        if (serviceName) {
            params.Dimensions.push({
                Name: 'ServiceName',
                Value: serviceName
            });
        }

        const result = await cloudwatch.getMetricStatistics(params).promise();
        return result.Datapoints.sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));
    } catch (err) {
        warning(`Failed to get billing metrics for ${serviceName || 'total'}: ${err.message}`);
        return [];
    }
}

/**
 * Get usage metrics for free tier monitoring
 */
async function getUsageMetrics(startDate, endDate) {
    const metrics = {};

    try {
        // Lambda metrics
        const lambdaInvocations = await cloudwatch.getMetricStatistics({
            Namespace: 'AWS/Lambda',
            MetricName: 'Invocations',
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400,
            Statistics: ['Sum']
        }).promise();

        const lambdaDuration = await cloudwatch.getMetricStatistics({
            Namespace: 'AWS/Lambda',
            MetricName: 'Duration',
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400,
            Statistics: ['Sum']
        }).promise();

        metrics.lambda = {
            invocations: lambdaInvocations.Datapoints,
            duration: lambdaDuration.Datapoints
        };

        // API Gateway metrics
        const apiRequests = await cloudwatch.getMetricStatistics({
            Namespace: 'AWS/ApiGateway',
            MetricName: 'Count',
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400,
            Statistics: ['Sum']
        }).promise();

        metrics.apiGateway = {
            requests: apiRequests.Datapoints
        };

        // CloudWatch Logs metrics
        const logIngestion = await cloudwatch.getMetricStatistics({
            Namespace: 'AWS/Logs',
            MetricName: 'IncomingBytes',
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400,
            Statistics: ['Sum']
        }).promise();

        metrics.cloudWatch = {
            logIngestion: logIngestion.Datapoints
        };

        // DynamoDB metrics
        const dynamoReads = await cloudwatch.getMetricStatistics({
            Namespace: 'AWS/DynamoDB',
            MetricName: 'ConsumedReadCapacityUnits',
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400,
            Statistics: ['Sum']
        }).promise();

        const dynamoWrites = await cloudwatch.getMetricStatistics({
            Namespace: 'AWS/DynamoDB',
            MetricName: 'ConsumedWriteCapacityUnits',
            StartTime: startDate,
            EndTime: endDate,
            Period: 86400,
            Statistics: ['Sum']
        }).promise();

        metrics.dynamodb = {
            reads: dynamoReads.Datapoints,
            writes: dynamoWrites.Datapoints
        };

    } catch (err) {
        warning(`Failed to get usage metrics: ${err.message}`);
    }

    return metrics;
}

/**
 * Calculate free tier utilization
 */
function calculateFreeTierUtilization(metrics) {
    const utilization = {};

    // Lambda utilization
    const totalLambdaInvocations = metrics.lambda?.invocations?.reduce((sum, point) => sum + (point.Sum || 0), 0) || 0;
    const totalLambdaDuration = metrics.lambda?.duration?.reduce((sum, point) => sum + (point.Sum || 0), 0) || 0;
    
    utilization.lambda = {
        requests: {
            used: totalLambdaInvocations,
            limit: FREE_TIER_LIMITS.lambda.requests,
            percentage: (totalLambdaInvocations / FREE_TIER_LIMITS.lambda.requests) * 100
        },
        computeTime: {
            used: totalLambdaDuration / 1000, // Convert to seconds
            limit: FREE_TIER_LIMITS.lambda.computeTime,
            percentage: ((totalLambdaDuration / 1000) / FREE_TIER_LIMITS.lambda.computeTime) * 100
        }
    };

    // API Gateway utilization
    const totalApiRequests = metrics.apiGateway?.requests?.reduce((sum, point) => sum + (point.Sum || 0), 0) || 0;
    
    utilization.apiGateway = {
        requests: {
            used: totalApiRequests,
            limit: FREE_TIER_LIMITS.apiGateway.requests,
            percentage: (totalApiRequests / FREE_TIER_LIMITS.apiGateway.requests) * 100
        }
    };

    // CloudWatch utilization
    const totalLogIngestion = metrics.cloudWatch?.logIngestion?.reduce((sum, point) => sum + (point.Sum || 0), 0) || 0;
    
    utilization.cloudWatch = {
        logIngestion: {
            used: totalLogIngestion,
            limit: FREE_TIER_LIMITS.cloudWatch.logIngestion,
            percentage: (totalLogIngestion / FREE_TIER_LIMITS.cloudWatch.logIngestion) * 100
        }
    };

    // DynamoDB utilization
    const totalDynamoReads = metrics.dynamodb?.reads?.reduce((sum, point) => sum + (point.Sum || 0), 0) || 0;
    const totalDynamoWrites = metrics.dynamodb?.writes?.reduce((sum, point) => sum + (point.Sum || 0), 0) || 0;
    
    utilization.dynamodb = {
        reads: {
            used: totalDynamoReads,
            limit: 'Pay-per-use',
            percentage: 0 // No free tier limit
        },
        writes: {
            used: totalDynamoWrites,
            limit: 'Pay-per-use',
            percentage: 0 // No free tier limit
        }
    };

    return utilization;
}

/**
 * Get budget information
 */
async function getBudgetInfo() {
    try {
        const budgetName = `home-inventory-budget-${ENVIRONMENT}`;
        
        const budget = await budgets.describeBudget({
            AccountId: await getAccountId(),
            BudgetName: budgetName
        }).promise();

        return budget.Budget;
    } catch (err) {
        warning(`Failed to get budget information: ${err.message}`);
        return null;
    }
}

/**
 * Get AWS Account ID
 */
async function getAccountId() {
    const sts = new AWS.STS();
    const identity = await sts.getCallerIdentity().promise();
    return identity.Account;
}

/**
 * Generate cost optimization recommendations
 */
function generateRecommendations(costs, utilization, budget) {
    const recommendations = [];

    // Check free tier utilization
    Object.entries(utilization).forEach(([service, metrics]) => {
        Object.entries(metrics).forEach(([metric, data]) => {
            if (data.percentage > 80) {
                recommendations.push({
                    priority: 'HIGH',
                    category: 'Free Tier',
                    service: service,
                    issue: `${FREE_TIER_LIMITS[service]?.name || service} ${metric} usage at ${data.percentage.toFixed(1)}%`,
                    recommendation: `Optimize ${metric} usage to stay within free tier limits`,
                    impact: 'Avoid unexpected charges when exceeding free tier'
                });
            } else if (data.percentage > 50) {
                recommendations.push({
                    priority: 'MEDIUM',
                    category: 'Free Tier',
                    service: service,
                    issue: `${FREE_TIER_LIMITS[service]?.name || service} ${metric} usage at ${data.percentage.toFixed(1)}%`,
                    recommendation: `Monitor ${metric} usage closely`,
                    impact: 'Prevent free tier overage'
                });
            }
        });
    });

    // Check budget utilization
    if (budget) {
        const budgetLimit = parseFloat(budget.BudgetLimit.Amount);
        const currentCosts = costs.total[costs.total.length - 1]?.Maximum || 0;
        const budgetUtilization = (currentCosts / budgetLimit) * 100;

        if (budgetUtilization > 80) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Budget',
                service: 'Overall',
                issue: `Budget utilization at ${budgetUtilization.toFixed(1)}%`,
                recommendation: 'Implement immediate cost-saving measures',
                impact: 'Prevent budget overage'
            });
        } else if (budgetUtilization > 50) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Budget',
                service: 'Overall',
                issue: `Budget utilization at ${budgetUtilization.toFixed(1)}%`,
                recommendation: 'Review and optimize resource usage',
                impact: 'Maintain costs within budget'
            });
        }
    }

    // Service-specific recommendations
    const serviceRecommendations = [
        {
            priority: 'MEDIUM',
            category: 'Lambda Optimization',
            service: 'Lambda',
            issue: 'Potential function optimization opportunities',
            recommendation: 'Review function memory allocation and execution time',
            impact: 'Reduce compute costs by 20-40%'
        },
        {
            priority: 'MEDIUM',
            category: 'S3 Optimization',
            service: 'S3',
            issue: 'Storage lifecycle management',
            recommendation: 'Implement intelligent tiering and lifecycle policies',
            impact: 'Reduce storage costs by 30-60%'
        },
        {
            priority: 'LOW',
            category: 'CloudWatch Optimization',
            service: 'CloudWatch',
            issue: 'Log retention optimization',
            recommendation: 'Adjust log retention periods based on compliance needs',
            impact: 'Reduce log storage costs by 50-80%'
        }
    ];

    recommendations.push(...serviceRecommendations);

    return recommendations.sort((a, b) => {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Generate the cost report
 */
async function generateReport() {
    try {
        log(`Generating cost monitoring report for ${ENVIRONMENT} environment`);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - REPORT_MONTHS);

        // Get cost data
        log('Fetching billing data...');
        const costs = {
            total: await getBillingMetrics(null, startDate, endDate),
            lambda: await getBillingMetrics('AWSLambda', startDate, endDate),
            dynamodb: await getBillingMetrics('AmazonDynamoDB', startDate, endDate),
            s3: await getBillingMetrics('AmazonS3', startDate, endDate),
            apiGateway: await getBillingMetrics('AmazonApiGateway', startDate, endDate),
            cloudWatch: await getBillingMetrics('AmazonCloudWatch', startDate, endDate)
        };

        // Get usage metrics
        log('Fetching usage metrics...');
        const usageMetrics = await getUsageMetrics(startDate, endDate);
        const utilization = calculateFreeTierUtilization(usageMetrics);

        // Get budget information
        log('Fetching budget information...');
        const budget = await getBudgetInfo();

        // Generate recommendations
        const recommendations = generateRecommendations(costs, utilization, budget);

        // Calculate current month costs
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        const currentMonthCosts = {
            total: await getBillingMetrics(null, currentMonthStart, endDate),
            lambda: await getBillingMetrics('AWSLambda', currentMonthStart, endDate),
            dynamodb: await getBillingMetrics('AmazonDynamoDB', currentMonthStart, endDate),
            s3: await getBillingMetrics('AmazonS3', currentMonthStart, endDate),
            apiGateway: await getBillingMetrics('AmazonApiGateway', currentMonthStart, endDate),
            cloudWatch: await getBillingMetrics('AmazonCloudWatch', currentMonthStart, endDate)
        };

        // Generate report content
        const reportContent = generateReportContent(costs, currentMonthCosts, utilization, budget, recommendations);

        // Save report
        const reportFile = `cost-monitoring-report-${ENVIRONMENT}-${new Date().toISOString().split('T')[0]}.md`;
        fs.writeFileSync(reportFile, reportContent);

        success(`Cost monitoring report generated: ${reportFile}`);

        // Display summary
        displaySummary(currentMonthCosts, utilization, budget, recommendations);

        return reportFile;

    } catch (err) {
        error(`Failed to generate cost report: ${err.message}`);
        throw err;
    }
}

/**
 * Generate report content
 */
function generateReportContent(costs, currentMonthCosts, utilization, budget, recommendations) {
    const currentTotal = currentMonthCosts.total[currentMonthCosts.total.length - 1]?.Maximum || 0;
    const budgetLimit = budget ? parseFloat(budget.BudgetLimit.Amount) : 0;
    const budgetUtilization = budgetLimit > 0 ? (currentTotal / budgetLimit) * 100 : 0;

    return `# Cost Monitoring Report

**Generated:** ${new Date().toISOString()}
**Environment:** ${ENVIRONMENT}
**Report Period:** ${REPORT_MONTHS} months
**Budget Period:** Current month

## Executive Summary

This report provides comprehensive cost monitoring and free tier usage analysis for the Home Inventory System.

### Current Month Overview
- **Total Costs:** $${currentTotal.toFixed(2)}
- **Budget Limit:** $${budgetLimit.toFixed(2)}
- **Budget Utilization:** ${budgetUtilization.toFixed(1)}%
- **Recommendations:** ${recommendations.length} optimization opportunities identified

## Budget Analysis

${budget ? `
### Budget Status
- **Budget Name:** ${budget.BudgetName}
- **Budget Limit:** $${budgetLimit.toFixed(2)} USD
- **Current Spend:** $${currentTotal.toFixed(2)} USD
- **Remaining:** $${(budgetLimit - currentTotal).toFixed(2)} USD
- **Utilization:** ${budgetUtilization.toFixed(1)}%

### Budget Health
${budgetUtilization > 90 ? '🔴 **CRITICAL**: Budget utilization above 90%' :
  budgetUtilization > 80 ? '🟡 **WARNING**: Budget utilization above 80%' :
  budgetUtilization > 50 ? '🟠 **CAUTION**: Budget utilization above 50%' :
  '🟢 **HEALTHY**: Budget utilization within safe limits'}
` : '⚠️ **No budget configured for this environment**'}

## Service Costs (Current Month)

| Service | Current Cost | Previous Month | Change |
|---------|-------------|----------------|---------|
| **Total** | $${currentTotal.toFixed(2)} | - | - |
| Lambda | $${(currentMonthCosts.lambda[currentMonthCosts.lambda.length - 1]?.Maximum || 0).toFixed(2)} | - | - |
| DynamoDB | $${(currentMonthCosts.dynamodb[currentMonthCosts.dynamodb.length - 1]?.Maximum || 0).toFixed(2)} | - | - |
| S3 | $${(currentMonthCosts.s3[currentMonthCosts.s3.length - 1]?.Maximum || 0).toFixed(2)} | - | - |
| API Gateway | $${(currentMonthCosts.apiGateway[currentMonthCosts.apiGateway.length - 1]?.Maximum || 0).toFixed(2)} | - | - |
| CloudWatch | $${(currentMonthCosts.cloudWatch[currentMonthCosts.cloudWatch.length - 1]?.Maximum || 0).toFixed(2)} | - | - |

## Free Tier Usage Analysis

### AWS Lambda
- **Requests:** ${formatNumber(utilization.lambda.requests.used)} / ${formatNumber(utilization.lambda.requests.limit)} (${utilization.lambda.requests.percentage.toFixed(1)}%)
- **Compute Time:** ${formatNumber(utilization.lambda.computeTime.used)} / ${formatNumber(utilization.lambda.computeTime.limit)} GB-seconds (${utilization.lambda.computeTime.percentage.toFixed(1)}%)
- **Status:** ${utilization.lambda.requests.percentage > 80 ? '🔴 High Usage' : utilization.lambda.requests.percentage > 50 ? '🟡 Moderate Usage' : '🟢 Low Usage'}

### API Gateway
- **Requests:** ${formatNumber(utilization.apiGateway.requests.used)} / ${formatNumber(utilization.apiGateway.requests.limit)} (${utilization.apiGateway.requests.percentage.toFixed(1)}%)
- **Status:** ${utilization.apiGateway.requests.percentage > 80 ? '🔴 High Usage' : utilization.apiGateway.requests.percentage > 50 ? '🟡 Moderate Usage' : '🟢 Low Usage'}

### CloudWatch Logs
- **Log Ingestion:** ${formatBytes(utilization.cloudWatch.logIngestion.used)} / ${formatBytes(utilization.cloudWatch.logIngestion.limit)} (${utilization.cloudWatch.logIngestion.percentage.toFixed(1)}%)
- **Status:** ${utilization.cloudWatch.logIngestion.percentage > 80 ? '🔴 High Usage' : utilization.cloudWatch.logIngestion.percentage > 50 ? '🟡 Moderate Usage' : '🟢 Low Usage'}

### DynamoDB
- **Read Units:** ${formatNumber(utilization.dynamodb.reads.used)} (Pay-per-use)
- **Write Units:** ${formatNumber(utilization.dynamodb.writes.used)} (Pay-per-use)
- **Status:** 🔵 On-Demand Pricing

## Cost Optimization Recommendations

${recommendations.map((rec, index) => `
### ${index + 1}. ${rec.issue} (${rec.priority} Priority)

**Service:** ${rec.service}
**Category:** ${rec.category}
**Impact:** ${rec.impact}
**Recommendation:** ${rec.recommendation}
`).join('\n')}

## Cost Containment Measures

### Automatic Triggers
- **50% Budget:** Warning notifications sent
- **80% Budget:** Cost optimization recommendations activated
- **90% Budget:** Emergency cost containment measures triggered

### Available Cost-Saving Actions
1. **Reduce log retention** to 1-3 days
2. **Implement aggressive S3 lifecycle policies**
3. **Pause non-essential development resources**
4. **Optimize Lambda memory allocation**
5. **Enable S3 Intelligent Tiering**

## Monitoring Commands

### Check Current Costs
\`\`\`bash
# Get current month costs
aws cloudwatch get-metric-statistics \\
    --namespace AWS/Billing \\
    --metric-name EstimatedCharges \\
    --dimensions Name=Currency,Value=USD \\
    --start-time \$(date -u -d '1 month ago' +%Y-%m-%dT%H:%M:%S) \\
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\
    --period 86400 \\
    --statistics Maximum \\
    --region us-east-1
\`\`\`

### Monitor Free Tier Usage
\`\`\`bash
# Lambda invocations
aws cloudwatch get-metric-statistics \\
    --namespace AWS/Lambda \\
    --metric-name Invocations \\
    --start-time \$(date -u -d '1 month ago' +%Y-%m-%dT%H:%M:%S) \\
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\
    --period 86400 \\
    --statistics Sum \\
    --region ${REGION}

# API Gateway requests
aws cloudwatch get-metric-statistics \\
    --namespace AWS/ApiGateway \\
    --metric-name Count \\
    --start-time \$(date -u -d '1 month ago' +%Y-%m-%dT%H:%M:%S) \\
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\
    --period 86400 \\
    --statistics Sum \\
    --region ${REGION}
\`\`\`

### Run Cost Optimization
\`\`\`bash
# Run automatic cost optimization
./scripts/cost-optimization.sh ${ENVIRONMENT} ${REGION}

# Generate DynamoDB optimization report
./scripts/optimize-dynamodb-queries.js ${ENVIRONMENT} ${REGION}

# Pause development resources (dev only)
./scripts/pause-dev-resources.sh pause ${ENVIRONMENT} ${REGION}
\`\`\`

## Next Steps

### Immediate Actions (This Week)
- [ ] Review HIGH priority recommendations
- [ ] Implement cost-saving measures if budget utilization > 80%
- [ ] Set up automated monitoring alerts

### Short-term Actions (This Month)
- [ ] Optimize resource configurations based on recommendations
- [ ] Implement data lifecycle policies
- [ ] Review and adjust budget limits if needed

### Long-term Actions (Next Quarter)
- [ ] Establish regular cost optimization reviews
- [ ] Implement automated cost optimization
- [ ] Set up predictive cost modeling

---

*This report is generated automatically. For questions or assistance, please refer to the cost optimization documentation.*
`;
}

/**
 * Display summary to console
 */
function displaySummary(currentMonthCosts, utilization, budget, recommendations) {
    const currentTotal = currentMonthCosts.total[currentMonthCosts.total.length - 1]?.Maximum || 0;
    const budgetLimit = budget ? parseFloat(budget.BudgetLimit.Amount) : 0;
    const budgetUtilization = budgetLimit > 0 ? (currentTotal / budgetLimit) * 100 : 0;

    console.log('\n' + '='.repeat(80));
    console.log('COST MONITORING SUMMARY');
    console.log('='.repeat(80));

    console.log(`${colors.cyan}Environment:${colors.reset} ${ENVIRONMENT}`);
    console.log(`${colors.cyan}Current Month Costs:${colors.reset} $${currentTotal.toFixed(2)}`);
    
    if (budget) {
        console.log(`${colors.cyan}Budget Limit:${colors.reset} $${budgetLimit.toFixed(2)}`);
        console.log(`${colors.cyan}Budget Utilization:${colors.reset} ${budgetUtilization.toFixed(1)}%`);
        
        if (budgetUtilization > 90) {
            console.log(`${colors.red}⚠️  CRITICAL: Budget utilization above 90%${colors.reset}`);
        } else if (budgetUtilization > 80) {
            console.log(`${colors.yellow}⚠️  WARNING: Budget utilization above 80%${colors.reset}`);
        } else {
            console.log(`${colors.green}✅ Budget utilization within safe limits${colors.reset}`);
        }
    }

    console.log('\nFREE TIER USAGE:');
    console.log(`Lambda Requests: ${utilization.lambda.requests.percentage.toFixed(1)}%`);
    console.log(`API Gateway Requests: ${utilization.apiGateway.requests.percentage.toFixed(1)}%`);
    console.log(`CloudWatch Logs: ${utilization.cloudWatch.logIngestion.percentage.toFixed(1)}%`);

    const highPriority = recommendations.filter(r => r.priority === 'HIGH');
    const mediumPriority = recommendations.filter(r => r.priority === 'MEDIUM');

    console.log('\nRECOMMENDATIONS:');
    console.log(`${colors.red}HIGH Priority: ${highPriority.length}${colors.reset}`);
    console.log(`${colors.yellow}MEDIUM Priority: ${mediumPriority.length}${colors.reset}`);

    console.log('\n' + '='.repeat(80));
}

/**
 * Main execution function
 */
async function main() {
    try {
        const reportFile = await generateReport();
        success(`Cost monitoring report completed: ${reportFile}`);
    } catch (err) {
        error(`Cost monitoring failed: ${err.message}`);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    getBillingMetrics,
    getUsageMetrics,
    calculateFreeTierUtilization,
    generateRecommendations,
    generateReport
};