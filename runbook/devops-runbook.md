# DevOps Runbook: `devops-demo-service`

**Service Description**: A high-traffic web service that allows users to create and manage lists. Used by millions of users globally.

**Environment**: AWS Cloud

**Version**: 1.0.0

**Last Updated**: March 6, 2025

**Team Contact**: devops-team@example.com

---

## Table of Contents

1. [Service Architecture](#service-architecture)
2. [Monitoring and Alerting](#monitoring-and-alerting)
3. [Common Failure Scenarios](#common-failure-scenarios)
   - [High CPU/Memory Usage](#high-cpumemory-usage)
   - [Database Connection Issues](#database-connection-issues)
   - [API Latency Spikes](#api-latency-spikes)
   - [Authentication Service Failures](#authentication-service-failures)
   - [Queue Processing Delays](#queue-processing-delays)
4. [Disaster Recovery](#disaster-recovery)
   - [Data Corruption](#data-corruption)
   - [Region Failure](#region-failure)
5. [Deployment Procedures](#deployment-procedures)
   - [Rollback Procedures](#rollback-procedures)
6. [Security Incidents](#security-incidents)
7. [Appendix: Common Commands](#appendix-common-commands)

---

## Service Architecture

`devops-demo-service` is designed with a microservices architecture deployed on AWS ECS with the following components:

- **Frontend**: React application served via CloudFront and S3
- **API Layer**: Node.js services running on ECS Fargate
- **Authentication**: AWS Cognito
- **Database**: Amazon Aurora PostgreSQL (Primary) with Read Replicas
- **Caching**: Amazon ElastiCache (Redis)
- **Message Queue**: Amazon SQS for asynchronous processing
- **Storage**: S3 buckets for object storage
- **CDN**: CloudFront for static asset delivery
- **Monitoring**: CloudWatch, X-Ray, and Datadog integration

![Architecture Diagram (Reference Only)]

The service is deployed across multiple Availability Zones in the primary region (us-west-2) with disaster recovery capabilities in a secondary region (us-east-1).

---

## Monitoring and Alerting

### Key Metrics

| Metric | Warning Threshold | Critical Threshold | Source |
|--------|-------------------|-------------------|--------|
| API Response Time | > 200ms | > 500ms | CloudWatch |
| Error Rate | > 1% | > 5% | CloudWatch |
| CPU Utilization | > 70% | > 85% | CloudWatch |
| Memory Utilization | > 75% | > 90% | CloudWatch |
| Database Connections | > 80% | > 90% | RDS CloudWatch |
| Cache Hit Rate | < 85% | < 75% | ElastiCache |
| Queue Depth | > 1000 | > 5000 | SQS CloudWatch |
| 5xx Errors | > 10/min | > 50/min | ALB CloudWatch |

### Dashboards

- **Primary Dashboard**: https://monitoring.example.com/devops-demo-service
- **Database Dashboard**: https://monitoring.example.com/devops-demo-service/database
- **Infrastructure Dashboard**: https://monitoring.example.com/devops-demo-service/infrastructure

### Alerts

All alerts are sent to:
- PagerDuty rotation: `devops-demo-service-oncall`
- Slack: `#devops-demo-service-alerts`

---

## Common Failure Scenarios

### High CPU/Memory Usage

#### Symptoms:
- CloudWatch alarms for CPU > 85% or Memory > 90%
- Increased API latency
- Task failures or restarts

#### Investigation Steps:

1. Check CloudWatch metrics for the affected services:

```bash
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"cpu","metricStat":{"metric":{"namespace":"AWS/ECS","metricName":"CPUUtilization","dimensions":[{"name":"ServiceName","value":"devops-demo-service"},{"name":"ClusterName","value":"production-cluster"}]},"period":60,"stat":"Average"},"returnData":true}]' \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

2. Check for recent deployments or configuration changes:

```bash
aws ecs describe-services \
  --cluster production-cluster \
  --services devops-demo-service \
  --query 'services[0].deployments'
```

3. Check application logs for error patterns:

```bash
aws logs filter-log-events \
  --log-group-name /ecs/devops-demo-service \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-30M +%s000) \
  --end-time $(date -u +%s000)
```

4. Examine X-Ray traces for bottlenecks:

```bash
aws xray get-service-graph \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s)
```

#### Remediation Steps:

1. Scale the service out by increasing desired count:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service \
  --desired-count $(( $(aws ecs describe-services --cluster production-cluster --services devops-demo-service --query 'services[0].desiredCount' --output text) + 5 ))
```

2. If the issue is database-related, enable read replicas for read queries:

```bash
# Update parameter in SSM to enable read replica routing
aws ssm put-parameter \
  --name "/devops-demo-service/use-read-replicas" \
  --value "true" \
  --type String \
  --overwrite
```

3. If CPU usage is related to background processing, scale up the worker fleet:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service-workers \
  --desired-count 10
```

4. Enable request throttling if necessary:

```bash
aws apigateway update-stage \
  --rest-api-id $(aws apigateway get-rest-apis --query 'items[?name==`devops-demo-service`].id' --output text) \
  --stage-name prod \
  --patch-operations op=replace,path=/methodSettings/*/*/throttling/rateLimit,value=1000
```

#### Prevention:

- Implement auto-scaling based on CPU/memory utilization
- Optimize expensive database queries
- Implement caching for frequently accessed data
- Use performance testing in the CI/CD pipeline to catch performance regressions

---

### Database Connection Issues

#### Symptoms:
- Database connection timeout errors in application logs
- Increased latency for database operations
- Connection pool exhaustion alerts

#### Investigation Steps:

1. Check RDS status and metrics:

```bash
aws rds describe-db-instances \
  --db-instance-identifier devops-demo-service-db

aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"conn","metricStat":{"metric":{"namespace":"AWS/RDS","metricName":"DatabaseConnections","dimensions":[{"name":"DBInstanceIdentifier","value":"devops-demo-service-db"}]},"period":60,"stat":"Average"},"returnData":true}]' \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

2. Check for long-running queries:

```bash
# Connect to the database and run this query
# psql -h <db-endpoint> -U <username> -d <database>
# Then run:
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE pg_stat_activity.query != ''
  AND state != 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 minutes'
ORDER BY duration DESC;
```

3. Check if connections are being properly released:

```bash
# In psql:
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

#### Remediation Steps:

1. If there are stuck connections, terminate them:

```bash
# In psql (be careful with this - only terminate connections that are truly stuck):
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'devops_demo_service' 
  AND state = 'idle in transaction'
  AND now() - state_change > interval '30 minutes';
```

2. If the connection pool is misconfigured, update the service's environment variables:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service \
  --force-new-deployment \
  --task-definition $(aws ecs describe-task-definition \
    --task-definition devops-demo-service \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)
```

3. Then update the environment configuration:

```bash
# Create a new revision with updated DB_POOL_SIZE
aws ecs register-task-definition \
  --cli-input-json file://updated-task-definition.json
```

4. If RDS instance is undersized, initiate a scaling operation:

```bash
aws rds modify-db-instance \
  --db-instance-identifier devops-demo-service-db \
  --db-instance-class db.r5.2xlarge \
  --apply-immediately
```

5. If read load is high, route read queries to read replicas:

```bash
# Update parameter in SSM to enable read replica routing
aws ssm put-parameter \
  --name "/devops-demo-service/use-read-replicas" \
  --value "true" \
  --type String \
  --overwrite
```

#### Prevention:

- Implement proper connection pooling
- Add read replicas for read-heavy workloads
- Use RDS Proxy to manage database connections
- Set up alarms for database connection counts
- Regularly review and optimize queries

---

### API Latency Spikes

#### Symptoms:
- CloudWatch alarms for increased API latency
- Increased error rates
- Customer complaints about slowness

#### Investigation Steps:

1. Check CloudWatch metrics for API Gateway:

```bash
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"latency","metricStat":{"metric":{"namespace":"AWS/ApiGateway","metricName":"Latency","dimensions":[{"name":"ApiName","value":"devops-demo-service"}]},"period":60,"stat":"Average"},"returnData":true}]' \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

2. Check for regional AWS issues on the AWS Health Dashboard

3. Analyze X-Ray traces for slow requests:

```bash
aws xray get-trace-summaries \
  --start-time $(date -u -v-30M +%s) \
  --end-time $(date -u +%s) \
  --filter-expression "responsetime > 1"
```

4. Check for cache hit rates:

```bash
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"cache","metricStat":{"metric":{"namespace":"AWS/ElastiCache","metricName":"CacheHitRate","dimensions":[{"name":"CacheClusterId","value":"devops-demo-redis"}]},"period":60,"stat":"Average"},"returnData":true}]' \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

#### Remediation Steps:

1. Scale the service to handle increased load:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service \
  --desired-count $(( $(aws ecs describe-services --cluster production-cluster --services devops-demo-service --query 'services[0].desiredCount' --output text) + 5 ))
```

2. Implement circuit breakers for failing dependencies:

```bash
# Update the circuit breaker configuration in the service parameter store
aws ssm put-parameter \
  --name "/devops-demo-service/circuit-breaker/enabled" \
  --value "true" \
  --type String \
  --overwrite
```

3. If a specific endpoint is problematic, implement a fallback:

```bash
# Update the fallback configuration in the service parameter store
aws ssm put-parameter \
  --name "/devops-demo-service/endpoints/problematic-endpoint/fallback-enabled" \
  --value "true" \
  --type String \
  --overwrite
```

4. If caching issues are detected, flush or resize the cache:

```bash
# Flush specific cache keys (example using Redis CLI)
redis-cli -h devops-demo-redis.example.com -c "KEYS *problematic-pattern*" | xargs redis-cli -h devops-demo-redis.example.com -c DEL

# Resize ElastiCache
aws elasticache increase-replica-count \
  --replication-group-id devops-demo-redis \
  --apply-immediately \
  --new-replica-count 3
```

#### Prevention:

- Implement proactive auto-scaling
- Use CloudFront caching for appropriate endpoints
- Implement circuit breakers and bulkheads
- Regularly conduct load testing
- Use throttling for non-critical endpoints during peak loads

---

### Authentication Service Failures

#### Symptoms:
- Increased 401/403 errors
- User complaints about login failures
- CloudWatch alarms for Cognito failures

#### Investigation Steps:

1. Check Cognito service health:

```bash
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"auth","metricStat":{"metric":{"namespace":"AWS/Cognito","metricName":"SignInSuccesses","dimensions":[{"name":"UserPool","value":"devops-demo-userpool"}]},"period":60,"stat":"Sum"},"returnData":true}]' \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

2. Check for misconfigurations in the user pool:

```bash
aws cognito-idp describe-user-pool \
  --user-pool-id us-west-2_xxxxxxxxx
```

3. Check application logs for authentication errors:

```bash
aws logs filter-log-events \
  --log-group-name /ecs/devops-demo-service \
  --filter-pattern "authentication error" \
  --start-time $(date -u -v-30M +%s000) \
  --end-time $(date -u +%s000)
```

#### Remediation Steps:

1. If there's an issue with the Cognito configuration, update it:

```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id us-west-2_xxxxxxxxx \
  --client-id 1example23456789 \
  --refresh-token-validity 30 \
  --access-token-validity 1 \
  --id-token-validity 1
```

2. If token expiration is causing issues, temporarily extend token validity:

```bash
aws cognito-idp update-user-pool \
  --user-pool-id us-west-2_xxxxxxxxx \
  --auto-verified-attributes email \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}'
```

3. If users are locked out, you can force a password reset:

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id us-west-2_xxxxxxxxx \
  --username example@example.com \
  --password "TemporaryPassword123!" \
  --permanent
```

4. If the authentication service is having high latency, implement a fallback authentication mechanism:

```bash
# Enable local JWT verification without calling Cognito
aws ssm put-parameter \
  --name "/devops-demo-service/auth/local-verification" \
  --value "true" \
  --type String \
  --overwrite
```

#### Prevention:

- Implement token caching to reduce Cognito API calls
- Use refresh tokens appropriately
- Implement proper error handling for authentication failures
- Monitor authentication success rates
- Implement client-side token refreshing

---

### Queue Processing Delays

#### Symptoms:
- CloudWatch alarms for SQS queue depth
- Delayed processing of user requests
- Stale data in the application

#### Investigation Steps:

1. Check SQS queue metrics:

```bash
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"queue","metricStat":{"metric":{"namespace":"AWS/SQS","metricName":"ApproximateNumberOfMessagesVisible","dimensions":[{"name":"QueueName","value":"devops-demo-service-queue"}]},"period":60,"stat":"Average"},"returnData":true}]' \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

2. Check worker service health:

```bash
aws ecs describe-services \
  --cluster production-cluster \
  --services devops-demo-service-workers
```

3. Check worker logs for processing errors:

```bash
aws logs filter-log-events \
  --log-group-name /ecs/devops-demo-service-workers \
  --filter-pattern "ERROR" \
  --start-time $(date -u -v-30M +%s000) \
  --end-time $(date -u +%s000)
```

#### Remediation Steps:

1. Scale up the worker fleet:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service-workers \
  --desired-count $(( $(aws ecs describe-services --cluster production-cluster --services devops-demo-service-workers --query 'services[0].desiredCount' --output text) * 2 ))
```

2. If there are poison messages (messages that cause errors when processed), move them to a dead-letter queue:

```bash
aws sqs receive-message \
  --queue-url https://sqs.us-west-2.amazonaws.com/123456789012/devops-demo-service-queue \
  --attribute-names All \
  --message-attribute-names All \
  --max-number-of-messages 10 \
  | jq -r '.Messages[] | .ReceiptHandle' \
  | xargs -I {} aws sqs delete-message \
    --queue-url https://sqs.us-west-2.amazonaws.com/123456789012/devops-demo-service-queue \
    --receipt-handle {}
```

3. If the worker service is unhealthy, force a new deployment:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service-workers \
  --force-new-deployment
```

4. If message processing is taking too long, adjust the visibility timeout:

```bash
aws sqs set-queue-attributes \
  --queue-url https://sqs.us-west-2.amazonaws.com/123456789012/devops-demo-service-queue \
  --attributes '{"VisibilityTimeout":"300"}'
```

#### Prevention:

- Implement auto-scaling for worker services based on queue depth
- Use dead-letter queues for failed message handling
- Implement proper error handling in workers
- Monitor message age and processing time
- Batch message processing where appropriate

---

## Disaster Recovery

### Data Corruption

#### Symptoms:
- Unexpected data in the application
- Errors related to data integrity
- User complaints about missing or incorrect data

#### Investigation Steps:

1. Determine the extent of corruption:

```bash
# Connect to the database and run diagnostic queries
# For example, to check for users with invalid data:
SELECT COUNT(*) FROM users WHERE created_at > NOW();
```

2. Check for recent database changes or migrations:

```bash
# Review migration logs in your CI/CD pipeline
aws logs filter-log-events \
  --log-group-name /ci-cd/devops-demo-service/migrations \
  --filter-pattern "migration" \
  --start-time $(date -u -v-24H +%s000) \
  --end-time $(date -u +%s000)
```

3. Review recent application deployments:

```bash
aws ecs describe-services \
  --cluster production-cluster \
  --services devops-demo-service \
  --query 'services[0].deployments'
```

#### Remediation Steps:

1. If the corruption is limited, apply targeted fixes:

```bash
# Example SQL to fix corrupted timestamp data
# UPDATE users SET created_at = '2025-03-06T00:00:00Z' WHERE created_at > NOW();
```

2. If widespread corruption exists, restore from a backup:

```bash
# Identify the latest snapshot before corruption
aws rds describe-db-snapshots \
  --db-instance-identifier devops-demo-service-db \
  --snapshot-type automated \
  --query 'sort_by(DBSnapshots, &SnapshotCreateTime)[-5:]'

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier devops-demo-service-db-restored \
  --db-snapshot-identifier rds:devops-demo-service-db-2025-03-05-03-00 \
  --db-instance-class db.r5.2xlarge
```

3. Point the application to the restored database:

```bash
aws ssm put-parameter \
  --name "/devops-demo-service/database/endpoint" \
  --value "devops-demo-service-db-restored.xxxxxxx.us-west-2.rds.amazonaws.com" \
  --type String \
  --overwrite
```

4. Update the service to use the new database:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service \
  --force-new-deployment
```

#### Prevention:

- Implement database constraints to prevent invalid data
- Use transaction logging
- Implement application-level validation
- Regular backup testing
- Database health monitoring

---

### Region Failure

#### Symptoms:
- Multiple AWS service failures in the same region
- Complete service outage in the primary region
- AWS Health Dashboard showing region-wide issues

#### Investigation Steps:

1. Check AWS Health Dashboard for region status

2. Verify the status of critical services in the primary region:

```bash
aws ec2 describe-regions --region us-east-1
aws cloudwatch describe-alarms --region us-west-2 --state-value ALARM
```

3. Check the readiness of the disaster recovery region:

```bash
aws ecs describe-services \
  --cluster dr-cluster \
  --services devops-demo-service \
  --region us-east-1
```

#### Remediation Steps:

1. Initiate DNS failover to the DR region:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://dns-failover.json
```

Content of dns-failover.json:
```json
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.devops-demo-service.example.com",
        "Type": "A",
        "SetIdentifier": "primary",
        "Failover": "SECONDARY",
        "TTL": 60,
        "ResourceRecords": [
          {
            "Value": "54.321.123.231"
          }
        ]
      }
    }
  ]
}
```

2. Scale up resources in the DR region:

```bash
aws ecs update-service \
  --cluster dr-cluster \
  --service devops-demo-service \
  --desired-count 10 \
  --region us-east-1
```

3. Enable write operations in the DR region database:

```bash
# Promote read replica to primary
aws rds promote-read-replica \
  --db-instance-identifier devops-demo-service-db-dr \
  --region us-east-1
```

4. Update the application configuration to use the DR database:

```bash
aws ssm put-parameter \
  --name "/devops-demo-service/database/endpoint" \
  --value "devops-demo-service-db-dr.xxxxxxx.us-east-1.rds.amazonaws.com" \
  --type String \
  --overwrite \
  --region us-east-1
```

5. Monitor the DR environment closely:

```bash
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"cpu","metricStat":{"metric":{"namespace":"AWS/ECS","metricName":"CPUUtilization","dimensions":[{"name":"ServiceName","value":"devops-demo-service"},{"name":"ClusterName","value":"dr-cluster"}]},"period":60,"stat":"Average"},"returnData":true}]' \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --region us-east-1
```

#### Recovery Steps (when primary region is restored):

1. Ensure databases are synchronized:

```bash
# Check replication status and ensure data is synchronized
# This may involve custom scripts to verify data consistency
```

2. Scale up the primary region resources:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service \
  --desired-count 10 \
  --region us-west-2
```

3. Switch DNS back to the primary region:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://dns-restore.json
```

4. Monitor traffic shift and performance:

```bash
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"traffic","metricStat":{"metric":{"namespace":"AWS/ApplicationELB","metricName":"RequestCount","dimensions":[{"name":"LoadBalancer","value":"app/devops-demo-lb/123456789012"}]},"period":60,"stat":"Sum"},"returnData":true}]' \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --region us-west-2
```

#### Prevention:

- Regularly test DR procedures (at least quarterly)
- Automate failover procedures
- Use multi-region database replication
- Implement Route 53 health checks and DNS failover
- Keep infrastructure-as-code templates up-to-date for both regions

---

## Deployment Procedures

### Rollback Procedures

If a deployment causes issues or exhibits unexpected behavior, follow these steps to roll back:

1. Identify the previous stable deployment:

```bash
aws ecs describe-services \
  --cluster production-cluster \
  --services devops-demo-service
```

2. Roll back to the previous task definition:

```bash
# Get the previous task definition ARN (second most recent)
PREVIOUS_TASK_DEF=$(aws ecs list-task-definitions \
  --family-prefix devops-demo-service \
  --sort DESC \
  --query 'taskDefinitionArns[1]' \
  --output text)

# Update the service to use the previous task definition
aws ecs update-service \
  --cluster production-cluster \
  --service devops-demo-service \
  --task-definition $PREVIOUS_TASK_DEF \
  --force-new-deployment
```

3. Monitor the rollback progress:

```bash
aws ecs describe-services \
  --cluster production-cluster \
  --services devops-demo-service \
  --query 'services[0].deployments'
```

4. Verify that the service has stabilized:

```bash
# Check for CloudWatch alarms in ALARM state
aws cloudwatch describe-alarms \
  --state-value ALARM

# Check error rates
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"errors","metricStat":{"metric":{"namespace":"AWS/ApiGateway","metricName":"5XXError","dimensions":[{"name":"ApiName","value":"devops-demo-service"}]},"period":60,"stat":"Sum"},"returnData":true}]' \
  --start-time $(date -u -v-30M +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

5. Document the rollback in the incident log:

```
Record the following:
- Deployment version that was rolled back
- Reason for rollback
- Impact observed
- Time to detect, time to rollback, time to recovery
- Action items to prevent similar issues
```

---

## Security Incidents

### Unauthorized Access Detection

#### Symptoms:
- Unusual API access patterns
- CloudTrail alerts for suspicious activity
- GuardDuty findings

#### Investigation Steps:

1. Check GuardDuty for findings:

```bash
aws guardduty list-findings \
  --detector-id 12abc34d567e8fa901bc2d34eexample \
  --finding-criteria '{"Criterion":{"severity":{"Gte":7}}}'
```

2. Review CloudTrail logs for suspicious activity:

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=suspicious-user
```

3. Check for unusual access patterns:

```bash
aws cloudwatch get-metric-data \
  --metric-data-queries '[{"id":"access","metricStat":{"metric":{"namespace":"AWS/ApiGateway","metricName":"Count","dimensions":[{"name":"ApiName","value":"devops-demo-service"}]},"period":60,"stat":"Sum"},"returnData":true}]' \
  --start-time $(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

#### Remediation Steps:

1. Revoke suspicious tokens or credentials:

```bash
# Revoke affected tokens in Cognito
aws cognito-idp admin-user-global-sign-out \
  --user-pool-id us-west-2_xxxxxxxxx \
  --username compromised-user

# If IAM credentials are compromised
aws iam update-access-key \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --status Inactive \
  --user-name compromised-iam-user
```

2. Implement IP blocking if necessary:

```bash
# Add IP to WAF blocklist
aws wafv2 update-ip-set \
  --name devops-demo-service-blocklist \
  --scope REGIONAL \
  --id a1b2c3d4-5678-90ab-cdef-EXAMPLE11111 \
  --addresses "192.0.2.44/32" \