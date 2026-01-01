#!/bin/bash

# Monthly Cost Report Generator
# Creates comprehensive monthly cost reports with free tier usage analysis

set -e

# Configuration
ENVIRONMENT=${1:-dev}
REGION=${2:-eu-west-1}
REPORT_MONTH=${3:-$(date +%Y-%m)}
OUTPUT_DIR=${4:-./cost-reports}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Function to create output directory
setup_output_directory() {
    mkdir -p "$OUTPUT_DIR"
    log "Output directory: $OUTPUT_DIR"
}

# Function to generate monthly cost report
generate_monthly_report() {
    log "Generating monthly cost report for $REPORT_MONTH"
    
    # Calculate date range for the month
    YEAR=$(echo "$REPORT_MONTH" | cut -d'-' -f1)
    MONTH=$(echo "$REPORT_MONTH" | cut -d'-' -f2)
    
    # First day of the month
    START_DATE="${YEAR}-${MONTH}-01T00:00:00Z"
    
    # Last day of the month
    if [ "$MONTH" = "12" ]; then
        NEXT_YEAR=$((YEAR + 1))
        END_DATE="${NEXT_YEAR}-01-01T00:00:00Z"
    else
        NEXT_MONTH=$(printf "%02d" $((10#$MONTH + 1)))
        END_DATE="${YEAR}-${NEXT_MONTH}-01T00:00:00Z"
    fi
    
    log "Report period: $START_DATE to $END_DATE"
    
    # Generate detailed cost report using Node.js script
    log "Running detailed cost analysis..."
    node scripts/cost-monitoring-report.js "$ENVIRONMENT" "$REGION" > /tmp/cost-analysis.log 2>&1 || warning "Cost analysis script had issues"
    
    # Get billing data for each service
    log "Fetching billing data for all services..."
    
    # Total costs
    TOTAL_COSTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Billing \
        --metric-name EstimatedCharges \
        --dimensions Name=Currency,Value=USD \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Maximum \
        --region us-east-1 \
        --query 'Datapoints[-1].Maximum' \
        --output text 2>/dev/null || echo "0")
    
    # Lambda costs
    LAMBDA_COSTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Billing \
        --metric-name EstimatedCharges \
        --dimensions Name=Currency,Value=USD Name=ServiceName,Value=AWSLambda \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Maximum \
        --region us-east-1 \
        --query 'Datapoints[-1].Maximum' \
        --output text 2>/dev/null || echo "0")
    
    # DynamoDB costs
    DYNAMODB_COSTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Billing \
        --metric-name EstimatedCharges \
        --dimensions Name=Currency,Value=USD Name=ServiceName,Value=AmazonDynamoDB \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Maximum \
        --region us-east-1 \
        --query 'Datapoints[-1].Maximum' \
        --output text 2>/dev/null || echo "0")
    
    # S3 costs
    S3_COSTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Billing \
        --metric-name EstimatedCharges \
        --dimensions Name=Currency,Value=USD Name=ServiceName,Value=AmazonS3 \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Maximum \
        --region us-east-1 \
        --query 'Datapoints[-1].Maximum' \
        --output text 2>/dev/null || echo "0")
    
    # API Gateway costs
    API_COSTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Billing \
        --metric-name EstimatedCharges \
        --dimensions Name=Currency,Value=USD Name=ServiceName,Value=AmazonApiGateway \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Maximum \
        --region us-east-1 \
        --query 'Datapoints[-1].Maximum' \
        --output text 2>/dev/null || echo "0")
    
    # CloudWatch costs
    CLOUDWATCH_COSTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Billing \
        --metric-name EstimatedCharges \
        --dimensions Name=Currency,Value=USD Name=ServiceName,Value=AmazonCloudWatch \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Maximum \
        --region us-east-1 \
        --query 'Datapoints[-1].Maximum' \
        --output text 2>/dev/null || echo "0")
    
    log "Cost data collected successfully"
}

# Function to get free tier usage data
get_free_tier_usage() {
    log "Calculating free tier usage for $REPORT_MONTH"
    
    # Lambda invocations
    LAMBDA_INVOCATIONS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text | tr '\t' '+' | bc -l 2>/dev/null || echo "0")
    
    # Lambda duration (GB-seconds)
    LAMBDA_DURATION=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Duration \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text | tr '\t' '+' | bc -l 2>/dev/null || echo "0")
    
    # Convert duration to GB-seconds (assuming 512MB memory)
    LAMBDA_GB_SECONDS=$(echo "scale=2; $LAMBDA_DURATION * 0.0005" | bc -l)
    
    # API Gateway requests
    API_REQUESTS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/ApiGateway \
        --metric-name Count \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text | tr '\t' '+' | bc -l 2>/dev/null || echo "0")
    
    # CloudWatch log ingestion
    LOG_INGESTION=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Logs \
        --metric-name IncomingBytes \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text | tr '\t' '+' | bc -l 2>/dev/null || echo "0")
    
    # DynamoDB usage
    DYNAMODB_READS=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/DynamoDB \
        --metric-name ConsumedReadCapacityUnits \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text | tr '\t' '+' | bc -l 2>/dev/null || echo "0")
    
    DYNAMODB_WRITES=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/DynamoDB \
        --metric-name ConsumedWriteCapacityUnits \
        --start-time "$START_DATE" \
        --end-time "$END_DATE" \
        --period 86400 \
        --statistics Sum \
        --region "$REGION" \
        --query 'Datapoints[].Sum' \
        --output text | tr '\t' '+' | bc -l 2>/dev/null || echo "0")
    
    log "Free tier usage data collected"
}

# Function to calculate percentages
calculate_percentages() {
    # Lambda percentages
    LAMBDA_REQUESTS_PCT=$(echo "scale=2; ($LAMBDA_INVOCATIONS / 1000000) * 100" | bc -l)
    LAMBDA_COMPUTE_PCT=$(echo "scale=2; ($LAMBDA_GB_SECONDS / 400000) * 100" | bc -l)
    
    # API Gateway percentage
    API_REQUESTS_PCT=$(echo "scale=2; ($API_REQUESTS / 1000000) * 100" | bc -l)
    
    # CloudWatch percentage (5GB = 5368709120 bytes)
    LOG_INGESTION_PCT=$(echo "scale=2; ($LOG_INGESTION / 5368709120) * 100" | bc -l)
}

# Function to format numbers
format_number() {
    local num=$1
    printf "%'.0f" "$num" 2>/dev/null || echo "$num"
}

# Function to format bytes
format_bytes() {
    local bytes=$1
    if (( $(echo "$bytes >= 1073741824" | bc -l) )); then
        echo "$(echo "scale=2; $bytes / 1073741824" | bc -l) GB"
    elif (( $(echo "$bytes >= 1048576" | bc -l) )); then
        echo "$(echo "scale=2; $bytes / 1048576" | bc -l) MB"
    elif (( $(echo "$bytes >= 1024" | bc -l) )); then
        echo "$(echo "scale=2; $bytes / 1024" | bc -l) KB"
    else
        echo "${bytes} bytes"
    fi
}

# Function to get budget information
get_budget_info() {
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    BUDGET_NAME="home-inventory-budget-${ENVIRONMENT}"
    
    BUDGET_LIMIT=$(aws budgets describe-budget \
        --account-id "$ACCOUNT_ID" \
        --budget-name "$BUDGET_NAME" \
        --region us-east-1 \
        --query 'Budget.BudgetLimit.Amount' \
        --output text 2>/dev/null || echo "20")
    
    BUDGET_UTILIZATION=$(echo "scale=2; ($TOTAL_COSTS / $BUDGET_LIMIT) * 100" | bc -l)
}

# Function to generate HTML report
generate_html_report() {
    local REPORT_FILE="$OUTPUT_DIR/monthly-cost-report-${ENVIRONMENT}-${REPORT_MONTH}.html"
    
    log "Generating HTML report: $REPORT_FILE"
    
    cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Cost Report - ${ENVIRONMENT} - ${REPORT_MONTH}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .card.warning { border-left-color: #ffc107; }
        .card.danger { border-left-color: #dc3545; }
        .card.success { border-left-color: #28a745; }
        .metric { font-size: 24px; font-weight: bold; color: #333; }
        .label { font-size: 14px; color: #666; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .progress-bar { width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background-color: #007bff; transition: width 0.3s ease; }
        .progress-fill.warning { background-color: #ffc107; }
        .progress-fill.danger { background-color: #dc3545; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Monthly Cost Report</h1>
            <h2>Environment: ${ENVIRONMENT} | Period: ${REPORT_MONTH}</h2>
            <p>Generated on: $(date)</p>
        </div>

        <div class="summary">
            <div class="card $([ $(echo "$BUDGET_UTILIZATION > 80" | bc -l) -eq 1 ] && echo "danger" || [ $(echo "$BUDGET_UTILIZATION > 50" | bc -l) -eq 1 ] && echo "warning" || echo "success")">
                <div class="label">Total Monthly Costs</div>
                <div class="metric">\$${TOTAL_COSTS}</div>
                <div class="label">Budget: \$${BUDGET_LIMIT} (${BUDGET_UTILIZATION}% used)</div>
            </div>
            
            <div class="card">
                <div class="label">Largest Cost Center</div>
                <div class="metric">$([ $(echo "$LAMBDA_COSTS > $DYNAMODB_COSTS && $LAMBDA_COSTS > $S3_COSTS" | bc -l) -eq 1 ] && echo "Lambda (\$${LAMBDA_COSTS})" || [ $(echo "$DYNAMODB_COSTS > $S3_COSTS" | bc -l) -eq 1 ] && echo "DynamoDB (\$${DYNAMODB_COSTS})" || echo "S3 (\$${S3_COSTS})")</div>
            </div>
            
            <div class="card $([ $(echo "$LAMBDA_REQUESTS_PCT > 80" | bc -l) -eq 1 ] && echo "danger" || [ $(echo "$LAMBDA_REQUESTS_PCT > 50" | bc -l) -eq 1 ] && echo "warning" || echo "success")">
                <div class="label">Lambda Free Tier Usage</div>
                <div class="metric">${LAMBDA_REQUESTS_PCT}%</div>
                <div class="label">$(format_number $LAMBDA_INVOCATIONS) / 1,000,000 requests</div>
            </div>
            
            <div class="card $([ $(echo "$API_REQUESTS_PCT > 80" | bc -l) -eq 1 ] && echo "danger" || [ $(echo "$API_REQUESTS_PCT > 50" | bc -l) -eq 1 ] && echo "warning" || echo "success")">
                <div class="label">API Gateway Free Tier</div>
                <div class="metric">${API_REQUESTS_PCT}%</div>
                <div class="label">$(format_number $API_REQUESTS) / 1,000,000 requests</div>
            </div>
        </div>

        <h3>Service Breakdown</h3>
        <table>
            <thead>
                <tr>
                    <th>Service</th>
                    <th>Monthly Cost</th>
                    <th>Percentage of Total</th>
                    <th>Free Tier Usage</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>AWS Lambda</td>
                    <td>\$${LAMBDA_COSTS}</td>
                    <td>$(echo "scale=1; ($LAMBDA_COSTS / $TOTAL_COSTS) * 100" | bc -l)%</td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill $([ $(echo "$LAMBDA_REQUESTS_PCT > 80" | bc -l) -eq 1 ] && echo "danger" || [ $(echo "$LAMBDA_REQUESTS_PCT > 50" | bc -l) -eq 1 ] && echo "warning")" style="width: ${LAMBDA_REQUESTS_PCT}%"></div>
                        </div>
                        ${LAMBDA_REQUESTS_PCT}% requests, ${LAMBDA_COMPUTE_PCT}% compute
                    </td>
                </tr>
                <tr>
                    <td>Amazon DynamoDB</td>
                    <td>\$${DYNAMODB_COSTS}</td>
                    <td>$(echo "scale=1; ($DYNAMODB_COSTS / $TOTAL_COSTS) * 100" | bc -l)%</td>
                    <td>Pay-per-use ($(format_number $DYNAMODB_READS) reads, $(format_number $DYNAMODB_WRITES) writes)</td>
                </tr>
                <tr>
                    <td>Amazon S3</td>
                    <td>\$${S3_COSTS}</td>
                    <td>$(echo "scale=1; ($S3_COSTS / $TOTAL_COSTS) * 100" | bc -l)%</td>
                    <td>Storage and requests</td>
                </tr>
                <tr>
                    <td>API Gateway</td>
                    <td>\$${API_COSTS}</td>
                    <td>$(echo "scale=1; ($API_COSTS / $TOTAL_COSTS) * 100" | bc -l)%</td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill $([ $(echo "$API_REQUESTS_PCT > 80" | bc -l) -eq 1 ] && echo "danger" || [ $(echo "$API_REQUESTS_PCT > 50" | bc -l) -eq 1 ] && echo "warning")" style="width: ${API_REQUESTS_PCT}%"></div>
                        </div>
                        ${API_REQUESTS_PCT}% of free tier
                    </td>
                </tr>
                <tr>
                    <td>CloudWatch</td>
                    <td>\$${CLOUDWATCH_COSTS}</td>
                    <td>$(echo "scale=1; ($CLOUDWATCH_COSTS / $TOTAL_COSTS) * 100" | bc -l)%</td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill $([ $(echo "$LOG_INGESTION_PCT > 80" | bc -l) -eq 1 ] && echo "danger" || [ $(echo "$LOG_INGESTION_PCT > 50" | bc -l) -eq 1 ] && echo "warning")" style="width: ${LOG_INGESTION_PCT}%"></div>
                        </div>
                        ${LOG_INGESTION_PCT}% log ingestion ($(format_bytes $LOG_INGESTION))
                    </td>
                </tr>
            </tbody>
        </table>

        <div class="recommendations">
            <h3>💡 Cost Optimization Recommendations</h3>
            <ul>
                $([ $(echo "$BUDGET_UTILIZATION > 80" | bc -l) -eq 1 ] && echo "<li><strong>HIGH PRIORITY:</strong> Budget utilization above 80%. Implement immediate cost-saving measures.</li>")
                $([ $(echo "$LAMBDA_REQUESTS_PCT > 80" | bc -l) -eq 1 ] && echo "<li><strong>HIGH PRIORITY:</strong> Lambda free tier usage above 80%. Optimize function efficiency.</li>")
                $([ $(echo "$API_REQUESTS_PCT > 80" | bc -l) -eq 1 ] && echo "<li><strong>HIGH PRIORITY:</strong> API Gateway free tier usage above 80%. Implement caching or rate limiting.</li>")
                $([ $(echo "$LOG_INGESTION_PCT > 50" | bc -l) -eq 1 ] && echo "<li><strong>MEDIUM PRIORITY:</strong> CloudWatch log ingestion above 50%. Consider reducing log retention.</li>")
                <li>Review and optimize DynamoDB query patterns to reduce read/write operations.</li>
                <li>Implement S3 lifecycle policies to move old data to cheaper storage classes.</li>
                <li>Consider using Lambda provisioned concurrency only for production workloads.</li>
                <li>Enable S3 Intelligent Tiering for automatic cost optimization.</li>
            </ul>
        </div>

        <h3>📊 Usage Trends</h3>
        <p>This month's usage compared to free tier limits:</p>
        <ul>
            <li><strong>Lambda:</strong> $(format_number $LAMBDA_INVOCATIONS) invocations (${LAMBDA_REQUESTS_PCT}% of free tier)</li>
            <li><strong>API Gateway:</strong> $(format_number $API_REQUESTS) requests (${API_REQUESTS_PCT}% of free tier)</li>
            <li><strong>CloudWatch:</strong> $(format_bytes $LOG_INGESTION) log ingestion (${LOG_INGESTION_PCT}% of free tier)</li>
            <li><strong>DynamoDB:</strong> $(format_number $DYNAMODB_READS) read units, $(format_number $DYNAMODB_WRITES) write units</li>
        </ul>

        <h3>🔧 Cost Management Actions</h3>
        <p>To optimize costs for next month:</p>
        <ol>
            <li>Run the cost optimization script: <code>./scripts/cost-optimization.sh ${ENVIRONMENT} ${REGION}</code></li>
            <li>Generate DynamoDB optimization report: <code>./scripts/optimize-dynamodb-queries.js ${ENVIRONMENT} ${REGION}</code></li>
            <li>Review and implement S3 lifecycle policies</li>
            <li>Monitor free tier usage weekly using: <code>./scripts/cost-monitoring-report.js ${ENVIRONMENT} ${REGION}</code></li>
            $([ "$ENVIRONMENT" = "dev" ] && echo "<li>Consider pausing development resources when not in use: <code>./scripts/pause-dev-resources.sh pause ${ENVIRONMENT} ${REGION}</code></li>")
        </ol>

        <div class="footer">
            <p>This report was generated automatically on $(date). For questions or assistance, please refer to the cost optimization documentation.</p>
        </div>
    </div>
</body>
</html>
EOF
    
    success "HTML report generated: $REPORT_FILE"
}

# Function to generate CSV report for data analysis
generate_csv_report() {
    local CSV_FILE="$OUTPUT_DIR/monthly-cost-data-${ENVIRONMENT}-${REPORT_MONTH}.csv"
    
    log "Generating CSV report: $CSV_FILE"
    
    cat > "$CSV_FILE" << EOF
Service,Cost,Free Tier Usage,Usage Amount,Free Tier Limit
Total,${TOTAL_COSTS},${BUDGET_UTILIZATION}%,${TOTAL_COSTS},${BUDGET_LIMIT}
Lambda,${LAMBDA_COSTS},${LAMBDA_REQUESTS_PCT}%,${LAMBDA_INVOCATIONS},1000000
DynamoDB,${DYNAMODB_COSTS},N/A,${DYNAMODB_READS},Pay-per-use
S3,${S3_COSTS},N/A,N/A,5GB
API Gateway,${API_COSTS},${API_REQUESTS_PCT}%,${API_REQUESTS},1000000
CloudWatch,${CLOUDWATCH_COSTS},${LOG_INGESTION_PCT}%,${LOG_INGESTION},5368709120
EOF
    
    success "CSV report generated: $CSV_FILE"
}

# Function to send report summary
send_report_summary() {
    log "Generating report summary"
    
    cat << EOF

================================================================================
MONTHLY COST REPORT SUMMARY - ${ENVIRONMENT} - ${REPORT_MONTH}
================================================================================

BUDGET STATUS:
  Total Costs: \$${TOTAL_COSTS}
  Budget Limit: \$${BUDGET_LIMIT}
  Utilization: ${BUDGET_UTILIZATION}%
  Status: $([ $(echo "$BUDGET_UTILIZATION > 80" | bc -l) -eq 1 ] && echo "🔴 OVER BUDGET" || [ $(echo "$BUDGET_UTILIZATION > 50" | bc -l) -eq 1 ] && echo "🟡 APPROACHING LIMIT" || echo "🟢 WITHIN BUDGET")

SERVICE BREAKDOWN:
  Lambda:     \$${LAMBDA_COSTS} (${LAMBDA_REQUESTS_PCT}% free tier usage)
  DynamoDB:   \$${DYNAMODB_COSTS} (pay-per-use)
  S3:         \$${S3_COSTS}
  API Gateway: \$${API_COSTS} (${API_REQUESTS_PCT}% free tier usage)
  CloudWatch: \$${CLOUDWATCH_COSTS} (${LOG_INGESTION_PCT}% free tier usage)

FREE TIER STATUS:
  Lambda Requests: $(format_number $LAMBDA_INVOCATIONS) / 1,000,000 (${LAMBDA_REQUESTS_PCT}%)
  API Requests: $(format_number $API_REQUESTS) / 1,000,000 (${API_REQUESTS_PCT}%)
  Log Ingestion: $(format_bytes $LOG_INGESTION) / 5GB (${LOG_INGESTION_PCT}%)

RECOMMENDATIONS:
$([ $(echo "$BUDGET_UTILIZATION > 80" | bc -l) -eq 1 ] && echo "  🔴 URGENT: Implement cost containment measures immediately")
$([ $(echo "$LAMBDA_REQUESTS_PCT > 80" | bc -l) -eq 1 ] && echo "  🔴 URGENT: Lambda usage approaching free tier limit")
$([ $(echo "$API_REQUESTS_PCT > 80" | bc -l) -eq 1 ] && echo "  🔴 URGENT: API Gateway usage approaching free tier limit")
$([ $(echo "$LOG_INGESTION_PCT > 50" | bc -l) -eq 1 ] && echo "  🟡 WARNING: Consider reducing log retention")
  📊 Run monthly cost optimization review
  🔧 Implement automated cost monitoring

REPORTS GENERATED:
  HTML Report: $OUTPUT_DIR/monthly-cost-report-${ENVIRONMENT}-${REPORT_MONTH}.html
  CSV Data: $OUTPUT_DIR/monthly-cost-data-${ENVIRONMENT}-${REPORT_MONTH}.csv

================================================================================

EOF
}

# Main execution
main() {
    log "Starting monthly cost report generation"
    log "Environment: $ENVIRONMENT"
    log "Region: $REGION"
    log "Report Month: $REPORT_MONTH"
    
    setup_output_directory
    generate_monthly_report
    get_free_tier_usage
    calculate_percentages
    get_budget_info
    
    generate_html_report
    generate_csv_report
    send_report_summary
    
    success "Monthly cost report generation completed"
}

# Check dependencies
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v bc &> /dev/null; then
    error "bc calculator not found. Please install bc."
    exit 1
fi

if ! command -v node &> /dev/null; then
    warning "Node.js not found. Some features may not work."
fi

# Run main function
main "$@"