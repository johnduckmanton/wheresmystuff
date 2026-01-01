#!/usr/bin/env node

/**
 * DynamoDB Query Optimization Script
 * Analyzes and provides recommendations for DynamoDB query optimization
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configuration
const ENVIRONMENT = process.argv[2] || 'dev';
const REGION = process.argv[3] || 'eu-west-1';
const TABLE_NAME = `home-inv-${ENVIRONMENT}`;

// AWS Configuration
AWS.config.update({ region: REGION });
const dynamodb = new AWS.DynamoDB();
const cloudwatch = new AWS.CloudWatch();

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
 * Get DynamoDB table description and metrics
 */
async function analyzeTable() {
    try {
        log(`Analyzing DynamoDB table: ${TABLE_NAME}`);
        
        // Get table description
        const tableDescription = await dynamodb.describeTable({
            TableName: TABLE_NAME
        }).promise();
        
        const table = tableDescription.Table;
        
        // Get table metrics from CloudWatch
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        
        const metrics = await getTableMetrics(startTime, endTime);
        
        return {
            table,
            metrics
        };
    } catch (err) {
        error(`Failed to analyze table: ${err.message}`);
        throw err;
    }
}

/**
 * Get CloudWatch metrics for the table
 */
async function getTableMetrics(startTime, endTime) {
    const metricQueries = [
        {
            name: 'ConsumedReadCapacityUnits',
            metric: 'ConsumedReadCapacityUnits'
        },
        {
            name: 'ConsumedWriteCapacityUnits',
            metric: 'ConsumedWriteCapacityUnits'
        },
        {
            name: 'ThrottledRequests',
            metric: 'ThrottledRequests'
        },
        {
            name: 'SuccessfulRequestLatency',
            metric: 'SuccessfulRequestLatency'
        }
    ];
    
    const metrics = {};
    
    for (const query of metricQueries) {
        try {
            const params = {
                Namespace: 'AWS/DynamoDB',
                MetricName: query.metric,
                Dimensions: [
                    {
                        Name: 'TableName',
                        Value: TABLE_NAME
                    }
                ],
                StartTime: startTime,
                EndTime: endTime,
                Period: 3600, // 1 hour
                Statistics: ['Sum', 'Average', 'Maximum']
            };
            
            const result = await cloudwatch.getMetricStatistics(params).promise();
            metrics[query.name] = result.Datapoints;
        } catch (err) {
            warning(`Failed to get metric ${query.metric}: ${err.message}`);
            metrics[query.name] = [];
        }
    }
    
    return metrics;
}

/**
 * Analyze table structure and provide recommendations
 */
function analyzeTableStructure(table) {
    const recommendations = [];
    
    log('Analyzing table structure...');
    
    // Check billing mode
    if (table.BillingModeSummary && table.BillingModeSummary.BillingMode === 'PROVISIONED') {
        recommendations.push({
            priority: 'HIGH',
            category: 'Billing',
            issue: 'Using provisioned billing mode',
            recommendation: 'Consider switching to on-demand billing for unpredictable workloads to reduce costs',
            impact: 'Cost reduction of 20-50% for variable workloads'
        });
    }
    
    // Check Global Secondary Indexes
    if (table.GlobalSecondaryIndexes && table.GlobalSecondaryIndexes.length > 0) {
        table.GlobalSecondaryIndexes.forEach((gsi, index) => {
            // Check projection type
            if (gsi.Projection.ProjectionType === 'ALL') {
                recommendations.push({
                    priority: 'MEDIUM',
                    category: 'GSI Optimization',
                    issue: `GSI "${gsi.IndexName}" projects all attributes`,
                    recommendation: 'Consider using KEYS_ONLY or INCLUDE projection to reduce storage costs',
                    impact: 'Storage cost reduction of 30-70%'
                });
            }
            
            // Check if GSI has separate billing mode
            if (gsi.BillingModeSummary && gsi.BillingModeSummary.BillingMode === 'PROVISIONED') {
                recommendations.push({
                    priority: 'HIGH',
                    category: 'GSI Billing',
                    issue: `GSI "${gsi.IndexName}" uses provisioned billing`,
                    recommendation: 'Switch GSI to on-demand billing to match table billing mode',
                    impact: 'Cost reduction and simplified capacity management'
                });
            }
        });
    }
    
    // Check TTL configuration
    if (!table.TimeToLiveDescription || table.TimeToLiveDescription.TimeToLiveStatus !== 'ENABLED') {
        recommendations.push({
            priority: 'HIGH',
            category: 'Data Lifecycle',
            issue: 'TTL (Time To Live) not enabled',
            recommendation: 'Enable TTL to automatically delete expired items and reduce storage costs',
            impact: 'Automatic cleanup of old data, reducing storage costs by 20-80%'
        });
    }
    
    // Check encryption
    if (!table.SSEDescription || table.SSEDescription.Status !== 'ENABLED') {
        recommendations.push({
            priority: 'MEDIUM',
            category: 'Security',
            issue: 'Server-side encryption not enabled',
            recommendation: 'Enable server-side encryption for data protection (minimal cost impact)',
            impact: 'Enhanced security with minimal cost increase'
        });
    }
    
    return recommendations;
}

/**
 * Analyze metrics and provide performance recommendations
 */
function analyzeMetrics(metrics) {
    const recommendations = [];
    
    log('Analyzing performance metrics...');
    
    // Analyze throttling
    const throttledRequests = metrics.ThrottledRequests || [];
    const totalThrottled = throttledRequests.reduce((sum, point) => sum + (point.Sum || 0), 0);
    
    if (totalThrottled > 0) {
        recommendations.push({
            priority: 'HIGH',
            category: 'Performance',
            issue: `${totalThrottled} throttled requests in the last 24 hours`,
            recommendation: 'Increase provisioned capacity or switch to on-demand billing',
            impact: 'Improved application performance and user experience'
        });
    }
    
    // Analyze read/write patterns
    const readCapacity = metrics.ConsumedReadCapacityUnits || [];
    const writeCapacity = metrics.ConsumedWriteCapacityUnits || [];
    
    const avgReads = readCapacity.reduce((sum, point) => sum + (point.Average || 0), 0) / Math.max(readCapacity.length, 1);
    const avgWrites = writeCapacity.reduce((sum, point) => sum + (point.Average || 0), 0) / Math.max(writeCapacity.length, 1);
    
    if (avgReads > avgWrites * 10) {
        recommendations.push({
            priority: 'MEDIUM',
            category: 'Performance',
            issue: 'Read-heavy workload detected',
            recommendation: 'Consider implementing DynamoDB Accelerator (DAX) for read caching',
            impact: 'Reduced read latency and DynamoDB costs'
        });
    }
    
    // Analyze latency
    const latency = metrics.SuccessfulRequestLatency || [];
    const avgLatency = latency.reduce((sum, point) => sum + (point.Average || 0), 0) / Math.max(latency.length, 1);
    
    if (avgLatency > 100) { // 100ms
        recommendations.push({
            priority: 'MEDIUM',
            category: 'Performance',
            issue: `High average latency: ${avgLatency.toFixed(2)}ms`,
            recommendation: 'Optimize query patterns, use batch operations, or implement caching',
            impact: 'Improved application responsiveness'
        });
    }
    
    return recommendations;
}

/**
 * Generate cost optimization recommendations
 */
function generateCostOptimizations() {
    return [
        {
            priority: 'HIGH',
            category: 'Query Optimization',
            issue: 'Potential inefficient query patterns',
            recommendation: 'Use batch operations (BatchGetItem, BatchWriteItem) instead of individual operations',
            impact: 'Reduced request count and costs by up to 50%',
            implementation: `
// Instead of multiple GetItem calls:
const items = await Promise.all(ids.map(id => 
    dynamodb.getItem({TableName, Key: {pk: {S: id}}}).promise()
));

// Use BatchGetItem:
const result = await dynamodb.batchGetItem({
    RequestItems: {
        [TableName]: {
            Keys: ids.map(id => ({pk: {S: id}}))
        }
    }
}).promise();`
        },
        {
            priority: 'HIGH',
            category: 'Data Archiving',
            issue: 'Old data consuming storage',
            recommendation: 'Implement data archiving strategy for old records',
            impact: 'Storage cost reduction of 60-90%',
            implementation: `
// Enable TTL for temporary data
await dynamodb.updateTable({
    TableName: TABLE_NAME,
    AttributeDefinitions: [{
        AttributeName: 'expiresAt',
        AttributeType: 'N'
    }],
    TimeToLiveSpecification: {
        AttributeName: 'expiresAt',
        Enabled: true
    }
}).promise();`
        },
        {
            priority: 'MEDIUM',
            category: 'Query Efficiency',
            issue: 'Fetching unnecessary attributes',
            recommendation: 'Use ProjectionExpression to fetch only required attributes',
            impact: 'Reduced data transfer and costs by 20-40%',
            implementation: `
// Instead of fetching all attributes:
const result = await dynamodb.getItem({
    TableName,
    Key: {pk: {S: id}}
}).promise();

// Fetch only needed attributes:
const result = await dynamodb.getItem({
    TableName,
    Key: {pk: {S: id}},
    ProjectionExpression: 'pk, sk, #name, description',
    ExpressionAttributeNames: {'#name': 'name'}
}).promise();`
        },
        {
            priority: 'MEDIUM',
            category: 'Pagination',
            issue: 'Large scan/query operations',
            recommendation: 'Implement proper pagination for large result sets',
            impact: 'Reduced memory usage and improved performance',
            implementation: `
// Implement pagination:
let lastEvaluatedKey = null;
const allItems = [];

do {
    const params = {
        TableName,
        Limit: 100,
        ...(lastEvaluatedKey && {ExclusiveStartKey: lastEvaluatedKey})
    };
    
    const result = await dynamodb.scan(params).promise();
    allItems.push(...result.Items);
    lastEvaluatedKey = result.LastEvaluatedKey;
} while (lastEvaluatedKey);`
        },
        {
            priority: 'LOW',
            category: 'Consistency',
            issue: 'Using strong consistency unnecessarily',
            recommendation: 'Use eventually consistent reads when strong consistency is not required',
            impact: 'Cost reduction of 50% for read operations',
            implementation: `
// Use eventually consistent reads (default):
const result = await dynamodb.getItem({
    TableName,
    Key: {pk: {S: id}}
    // ConsistentRead: false (default)
}).promise();

// Only use strong consistency when necessary:
const result = await dynamodb.getItem({
    TableName,
    Key: {pk: {S: id}},
    ConsistentRead: true
}).promise();`
        }
    ];
}

/**
 * Generate optimization report
 */
async function generateReport(analysis) {
    const { table, metrics } = analysis;
    const structureRecommendations = analyzeTableStructure(table);
    const metricsRecommendations = analyzeMetrics(metrics);
    const costOptimizations = generateCostOptimizations();
    
    const allRecommendations = [
        ...structureRecommendations,
        ...metricsRecommendations,
        ...costOptimizations
    ];
    
    // Sort by priority
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    allRecommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    
    const reportContent = `# DynamoDB Optimization Report

**Generated:** ${new Date().toISOString()}
**Environment:** ${ENVIRONMENT}
**Table:** ${TABLE_NAME}
**Region:** ${REGION}

## Executive Summary

This report analyzes the DynamoDB table configuration and usage patterns to provide cost optimization and performance improvement recommendations.

### Table Overview
- **Table Name:** ${table.TableName}
- **Billing Mode:** ${table.BillingModeSummary?.BillingMode || 'ON_DEMAND'}
- **Item Count:** ${table.ItemCount?.toLocaleString() || 'Unknown'}
- **Table Size:** ${table.TableSizeBytes ? (table.TableSizeBytes / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}
- **Global Secondary Indexes:** ${table.GlobalSecondaryIndexes?.length || 0}
- **TTL Enabled:** ${table.TimeToLiveDescription?.TimeToLiveStatus === 'ENABLED' ? 'Yes' : 'No'}

## Recommendations

${allRecommendations.map((rec, index) => `
### ${index + 1}. ${rec.issue} (${rec.priority} Priority)

**Category:** ${rec.category}
**Impact:** ${rec.impact}
**Recommendation:** ${rec.recommendation}

${rec.implementation ? `**Implementation:**
\`\`\`javascript
${rec.implementation}
\`\`\`` : ''}
`).join('\n')}

## Cost Optimization Checklist

### Immediate Actions (0-1 week)
- [ ] Enable TTL for temporary/audit data
- [ ] Review and optimize GSI projections
- [ ] Switch to on-demand billing if using provisioned mode
- [ ] Implement batch operations where possible

### Short-term Actions (1-4 weeks)
- [ ] Implement data archiving strategy
- [ ] Optimize query patterns and projections
- [ ] Add proper pagination for large queries
- [ ] Review and remove unused GSIs

### Long-term Actions (1-3 months)
- [ ] Implement comprehensive monitoring and alerting
- [ ] Regular capacity planning reviews
- [ ] Consider DynamoDB Accelerator (DAX) for read-heavy workloads
- [ ] Implement automated cost optimization

## Monitoring Commands

### Check Current Costs
\`\`\`bash
# Get DynamoDB costs for the last 30 days
aws cloudwatch get-metric-statistics \\
    --namespace AWS/Billing \\
    --metric-name EstimatedCharges \\
    --dimensions Name=Currency,Value=USD Name=ServiceName,Value=AmazonDynamoDB \\
    --start-time \$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S) \\
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\
    --period 86400 \\
    --statistics Maximum \\
    --region us-east-1
\`\`\`

### Monitor Table Metrics
\`\`\`bash
# Check consumed capacity
aws cloudwatch get-metric-statistics \\
    --namespace AWS/DynamoDB \\
    --metric-name ConsumedReadCapacityUnits \\
    --dimensions Name=TableName,Value=${TABLE_NAME} \\
    --start-time \$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \\
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\
    --period 3600 \\
    --statistics Sum \\
    --region ${REGION}

# Check for throttling
aws cloudwatch get-metric-statistics \\
    --namespace AWS/DynamoDB \\
    --metric-name ThrottledRequests \\
    --dimensions Name=TableName,Value=${TABLE_NAME} \\
    --start-time \$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \\
    --end-time \$(date -u +%Y-%m-%dT%H:%M:%S) \\
    --period 3600 \\
    --statistics Sum \\
    --region ${REGION}
\`\`\`

## Next Steps

1. **Review Recommendations:** Prioritize HIGH priority items first
2. **Implement Changes:** Start with low-risk, high-impact changes
3. **Monitor Impact:** Track metrics before and after changes
4. **Schedule Reviews:** Set up monthly optimization reviews
5. **Automate:** Implement automated monitoring and optimization

---

*This report was generated automatically. For questions or assistance, please refer to the AWS DynamoDB documentation or contact your DevOps team.*
`;

    const reportFile = `dynamodb-optimization-report-${ENVIRONMENT}-${new Date().toISOString().split('T')[0]}.md`;
    fs.writeFileSync(reportFile, reportContent);
    
    success(`Optimization report generated: ${reportFile}`);
    
    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('OPTIMIZATION SUMMARY');
    console.log('='.repeat(80));
    
    const highPriority = allRecommendations.filter(r => r.priority === 'HIGH');
    const mediumPriority = allRecommendations.filter(r => r.priority === 'MEDIUM');
    const lowPriority = allRecommendations.filter(r => r.priority === 'LOW');
    
    console.log(`${colors.red}HIGH Priority Issues: ${highPriority.length}${colors.reset}`);
    highPriority.forEach(rec => console.log(`  • ${rec.issue}`));
    
    console.log(`\n${colors.yellow}MEDIUM Priority Issues: ${mediumPriority.length}${colors.reset}`);
    mediumPriority.forEach(rec => console.log(`  • ${rec.issue}`));
    
    console.log(`\n${colors.green}LOW Priority Issues: ${lowPriority.length}${colors.reset}`);
    lowPriority.forEach(rec => console.log(`  • ${rec.issue}`));
    
    console.log('\n' + '='.repeat(80));
    
    return reportFile;
}

/**
 * Main execution function
 */
async function main() {
    try {
        log(`Starting DynamoDB optimization analysis for ${ENVIRONMENT} environment`);
        
        const analysis = await analyzeTable();
        const reportFile = await generateReport(analysis);
        
        success('DynamoDB optimization analysis completed successfully');
        log(`Report saved to: ${reportFile}`);
        
    } catch (err) {
        error(`Optimization analysis failed: ${err.message}`);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    analyzeTable,
    analyzeTableStructure,
    analyzeMetrics,
    generateCostOptimizations,
    generateReport
};