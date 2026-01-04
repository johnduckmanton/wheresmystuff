#!/bin/bash

# SSL Certificate Setup Script for Custom Domain
# This script helps you request and validate an SSL certificate for CloudFront

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to validate domain name
validate_domain() {
    local domain=$1
    if [[ ! $domain =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        error "Invalid domain name format: $domain"
        exit 1
    fi
}

# Function to check if certificate already exists
check_existing_certificate() {
    local domain=$1
    log "Checking for existing certificates for domain: $domain"
    
    local existing_cert=$(aws acm list-certificates \
        --region us-east-1 \
        --query "CertificateSummaryList[?DomainName=='$domain'].CertificateArn" \
        --output text)
    
    if [ ! -z "$existing_cert" ] && [ "$existing_cert" != "None" ]; then
        warn "Certificate already exists for domain $domain"
        echo "Certificate ARN: $existing_cert"
        
        # Check certificate status
        local cert_status=$(aws acm describe-certificate \
            --certificate-arn "$existing_cert" \
            --region us-east-1 \
            --query 'Certificate.Status' \
            --output text)
        
        echo "Certificate Status: $cert_status"
        
        if [ "$cert_status" = "ISSUED" ]; then
            success "Certificate is already issued and ready to use!"
            echo ""
            echo "🎉 Your certificate ARN is:"
            echo "$existing_cert"
            echo ""
            echo "You can use this ARN in your deployment configuration."
            exit 0
        elif [ "$cert_status" = "PENDING_VALIDATION" ]; then
            warn "Certificate exists but is pending validation"
            echo "You can continue with the validation process below."
            echo "Certificate ARN: $existing_cert"
            return 0
        fi
    fi
    
    return 1
}

# Function to request certificate
request_certificate() {
    local domain=$1
    local include_www=$2
    
    log "Requesting SSL certificate for domain: $domain"
    
    # Build domain list
    local domain_args="--domain-name $domain"
    if [ "$include_www" = "true" ]; then
        domain_args="$domain_args --subject-alternative-names www.$domain"
        log "Including www.$domain as Subject Alternative Name"
    fi
    
    # Request certificate
    local cert_arn=$(aws acm request-certificate \
        $domain_args \
        --validation-method DNS \
        --region us-east-1 \
        --query 'CertificateArn' \
        --output text)
    
    if [ -z "$cert_arn" ] || [ "$cert_arn" = "None" ]; then
        error "Failed to request certificate"
        exit 1
    fi
    
    success "Certificate requested successfully!"
    echo "Certificate ARN: $cert_arn"
    
    return 0
}

# Function to get DNS validation records
get_dns_validation_records() {
    local domain=$1
    
    log "Getting DNS validation records for domain: $domain"
    
    # Find the certificate ARN
    local cert_arn=$(aws acm list-certificates \
        --region us-east-1 \
        --query "CertificateSummaryList[?DomainName=='$domain'].CertificateArn" \
        --output text)
    
    if [ -z "$cert_arn" ] || [ "$cert_arn" = "None" ]; then
        error "No certificate found for domain: $domain"
        exit 1
    fi
    
    # Get validation records
    log "Fetching DNS validation records..."
    
    local validation_records=$(aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions' \
        --output json)
    
    echo ""
    echo "📋 DNS Validation Records:"
    echo "=========================="
    echo ""
    
    # Parse and display validation records
    echo "$validation_records" | jq -r '.[] | 
        "Domain: " + .DomainName + "\n" +
        "Record Type: " + .ResourceRecord.Type + "\n" +
        "Record Name: " + .ResourceRecord.Name + "\n" +
        "Record Value: " + .ResourceRecord.Value + "\n" +
        "Status: " + .ValidationStatus + "\n" +
        "----------------------------------------"'
    
    echo ""
    echo "🔧 Next Steps:"
    echo "1. Add the DNS records above to your domain's DNS settings"
    echo "2. Wait for DNS propagation (usually 5-30 minutes)"
    echo "3. Run this script again with --check-status to verify"
    echo ""
    echo "Certificate ARN: $cert_arn"
}

# Function to check certificate status
check_certificate_status() {
    local domain=$1
    
    log "Checking certificate status for domain: $domain"
    
    # Find the certificate ARN
    local cert_arn=$(aws acm list-certificates \
        --region us-east-1 \
        --query "CertificateSummaryList[?DomainName=='$domain'].CertificateArn" \
        --output text)
    
    if [ -z "$cert_arn" ] || [ "$cert_arn" = "None" ]; then
        error "No certificate found for domain: $domain"
        exit 1
    fi
    
    # Get certificate details
    local cert_details=$(aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region us-east-1 \
        --output json)
    
    local cert_status=$(echo "$cert_details" | jq -r '.Certificate.Status')
    local domain_validations=$(echo "$cert_details" | jq -r '.Certificate.DomainValidationOptions')
    
    echo ""
    echo "📊 Certificate Status Report:"
    echo "============================="
    echo "Certificate ARN: $cert_arn"
    echo "Overall Status: $cert_status"
    echo ""
    
    # Show validation status for each domain
    echo "$domain_validations" | jq -r '.[] | 
        "Domain: " + .DomainName + "\n" +
        "Validation Status: " + .ValidationStatus + "\n" +
        "Validation Method: " + .ValidationMethod + "\n" +
        "----------------------------------------"'
    
    if [ "$cert_status" = "ISSUED" ]; then
        success "🎉 Certificate is ISSUED and ready to use!"
        echo ""
        echo "Your certificate ARN:"
        echo "$cert_arn"
        echo ""
        echo "You can now use this ARN in your production deployment."
    elif [ "$cert_status" = "PENDING_VALIDATION" ]; then
        warn "Certificate is still pending validation"
        echo ""
        echo "Please ensure you have added the DNS validation records."
        echo "DNS propagation can take up to 30 minutes."
        echo ""
        echo "Run: $0 --domain $domain --check-status"
        echo "to check again in a few minutes."
    else
        error "Certificate status: $cert_status"
        echo "Please check the AWS Console for more details."
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 --domain <domain-name> [options]"
    echo ""
    echo "Options:"
    echo "  --domain <domain>     Your domain name (required)"
    echo "  --include-www         Include www subdomain as SAN"
    echo "  --check-existing      Check if certificate already exists"
    echo "  --get-dns-records     Get DNS validation records"
    echo "  --check-status        Check certificate validation status"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --domain example.com --include-www"
    echo "  $0 --domain example.com --get-dns-records"
    echo "  $0 --domain example.com --check-status"
    echo ""
    echo "Prerequisites:"
    echo "  - AWS CLI configured with appropriate permissions"
    echo "  - Access to your domain's DNS settings"
    echo "  - jq installed for JSON parsing"
}

# Main script logic
main() {
    local domain=""
    local include_www=false
    local check_existing=false
    local get_dns_records=false
    local check_status=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                domain="$2"
                shift 2
                ;;
            --include-www)
                include_www=true
                shift
                ;;
            --check-existing)
                check_existing=true
                shift
                ;;
            --get-dns-records)
                get_dns_records=true
                shift
                ;;
            --check-status)
                check_status=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate required parameters
    if [ -z "$domain" ]; then
        error "Domain name is required"
        show_usage
        exit 1
    fi
    
    # Validate domain format
    validate_domain "$domain"
    
    # Check prerequisites
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        error "jq is not installed. Please install jq for JSON parsing."
        echo "On macOS: brew install jq"
        echo "On Ubuntu: sudo apt-get install jq"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
        echo "Please run: aws configure"
        exit 1
    fi
    
    log "🚀 SSL Certificate Setup for domain: $domain"
    echo ""
    
    # Execute requested action
    if [ "$check_existing" = true ]; then
        check_existing_certificate "$domain"
    elif [ "$get_dns_records" = true ]; then
        get_dns_validation_records "$domain"
    elif [ "$check_status" = true ]; then
        check_certificate_status "$domain"
    else
        # Default: request new certificate
        if check_existing_certificate "$domain"; then
            # Certificate exists, get DNS records
            get_dns_validation_records "$domain"
        else
            # Request new certificate
            request_certificate "$domain" "$include_www"
            echo ""
            log "Waiting 10 seconds for certificate to be processed..."
            sleep 10
            get_dns_validation_records "$domain"
        fi
    fi
}

# Run main function with all arguments
main "$@"