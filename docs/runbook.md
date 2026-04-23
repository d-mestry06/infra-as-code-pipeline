# Runbook — infra-as-code-pipeline

On-call reference for common failure scenarios.  
Owner: DevOps Team | Last updated: 2025

---

## Scenario 1: ECS Service Not Stabilizing

**Symptoms**
- GitHub Actions pipeline hangs on `aws ecs wait services-stable`
- Pipeline eventually times out and triggers rollback
- ECS console shows tasks cycling between PENDING → STOPPED

**Diagnosis**

```bash
# 1. Check ECS service events (most useful first step)
aws ecs describe-services \
  --cluster production-cluster \
  --services production-app \
  --query 'services[0].events[:10]'

# 2. Check CloudWatch logs for the crashing container
aws logs tail /ecs/production-app --follow --since 10m

# 3. Check stopped tasks for exit codes
aws ecs list-tasks \
  --cluster production-cluster \
  --desired-status STOPPED \
  --service-name production-app

aws ecs describe-tasks \
  --cluster production-cluster \
  --tasks <TASK_ARN> \
  --query 'tasks[0].containers[0].{exitCode:exitCode,reason:reason}'
```

**Common causes and fixes**

| Event message                          | Cause                         | Fix                                    |
|----------------------------------------|-------------------------------|----------------------------------------|
| `CannotPullContainerError`             | ECR auth expired or wrong URI | Re-authenticate; verify image URI      |
| `Task failed ELB health checks`        | App crash or /health broken   | Check CloudWatch logs for stack trace  |
| `ResourceInitializationError`          | No internet from private subnet | Check NAT Gateway routes             |
| `exec format error`                    | Wrong CPU arch in Docker image | Build with `--platform linux/amd64`   |
| `OutOfMemoryError`                     | Container using too much RAM  | Increase `task_memory` in Terraform   |

**Manual rollback (if auto-rollback also failed)**

```bash
# Get list of task definition revisions
aws ecs list-task-definitions \
  --family-prefix production-app \
  --sort DESC \
  --query 'taskDefinitionArns[:5]'

# Roll back to a specific revision
aws ecs update-service \
  --cluster production-cluster \
  --service production-app \
  --task-definition production-app:<REVISION_NUMBER>

# Wait for it to stabilize
aws ecs wait services-stable \
  --cluster production-cluster \
  --services production-app

echo "Rollback complete"
```

---

## Scenario 2: ALB Returning 502 / 503

**Symptoms**
- ALB DNS returns HTTP 502 or 503
- Users see "Bad Gateway" or "Service Unavailable"
- ECS service shows RUNNING tasks

**Diagnosis**

```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN>

# Check ALB access logs in S3
aws s3 ls s3://<ENV>-alb-logs-<ACCOUNT_ID>/<ENV>-alb/

# Check CloudWatch ALB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name UnHealthyHostCount \
  --dimensions Name=LoadBalancer,Value=<ALB_ARN_SUFFIX> \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average
```

**Common causes and fixes**

- **502**: ECS tasks are unhealthy (health check failing). Fix the app, redeploy.
- **503**: No healthy targets registered. Tasks may be starting up — wait 60s for `startPeriod`.
- **Security group**: ECS tasks must allow inbound from ALB security group on container port.

```bash
# Force ECS to re-register tasks with target group
aws ecs update-service \
  --cluster production-cluster \
  --service production-app \
  --force-new-deployment
```

---

## Scenario 3: ECR Image Pull Failure

**Symptoms**
- ECS event: `CannotPullContainerError: pull access denied`
- GitHub Actions push step succeeded but ECS cannot pull

**Diagnosis**

```bash
# Verify the image exists in ECR
aws ecr list-images \
  --repository-name production-app \
  --query 'imageIds[:5]'

# Verify task execution role has ECR permissions
aws iam get-role-policy \
  --role-name production-ecs-task-execution-role \
  --policy-name AmazonECSTaskExecutionRolePolicy 2>/dev/null || \
aws iam list-attached-role-policies \
  --role-name production-ecs-task-execution-role
```

**Fix**

```bash
# The task execution role needs these ECR permissions:
# ecr:GetAuthorizationToken
# ecr:BatchCheckLayerAvailability
# ecr:GetDownloadUrlForLayer
# ecr:BatchGetImage
# These are all in AmazonECSTaskExecutionRolePolicy

# If missing, attach it:
aws iam attach-role-policy \
  --role-name production-ecs-task-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

---

## Scenario 4: Terraform State Lock Not Releasing

**Symptoms**
- `terraform plan` or `terraform apply` fails with:  
  `Error acquiring the state lock: ConditionalCheckFailedException`
- A previous run crashed mid-apply

**Diagnosis**

```bash
# List locks in DynamoDB
aws dynamodb scan \
  --table-name terraform-state-lock \
  --query 'Items'
```

**Fix**

```bash
# Get the LockID from the scan above (it looks like: staging/terraform.tfstate)
LOCK_ID="staging/terraform.tfstate"

# ONLY do this if you are 100% sure no terraform apply is actually running
aws dynamodb delete-item \
  --table-name terraform-state-lock \
  --key "{\"LockID\": {\"S\": \"${LOCK_ID}\"}}"

echo "Lock released. Run terraform plan to verify state is clean."
```

> **Warning:** Never release a lock if another `terraform apply` might be running.  
> Check with your team first. Releasing an active lock can corrupt state.

---

## Scenario 5: GitHub Actions Pipeline Failing on terraform validate

**Symptoms**
- CI fails at the `terraform validate` step
- Error: `Error: Unsupported argument` or `missing required argument`

**Fix locally**

```bash
cd terraform/environments/staging
terraform init -backend=false
terraform validate
terraform fmt -recursive ../../
```

Common causes:
- Variable referenced but not declared in `variables.tf`
- Module output referenced that doesn't exist in the module's `outputs.tf`
- Wrong attribute name for an AWS resource (check provider version)

---

## Scenario 6: Auto-scaling Not Triggering

**Symptoms**
- High CPU/memory on ECS tasks but no new tasks starting
- CloudWatch CPU alarm in ALARM state but task count unchanged

**Diagnosis**

```bash
# Check auto-scaling activity
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id service/production-cluster/production-app

# Check current scaling policies
aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id service/production-cluster/production-app
```

**Fix**

Usually a permissions issue or the target tracking hasn't collected enough data points.  
Wait 2–3 minutes (2 evaluation periods of 60s each).  
If still stuck, manually set desired count:

```bash
aws ecs update-service \
  --cluster production-cluster \
  --service production-app \
  --desired-count 4
```

---

## Useful Commands Reference

```bash
# Tail ECS container logs live
aws logs tail /ecs/production-app --follow

# Get current image running in production
aws ecs describe-task-definition \
  --task-definition production-app \
  --query 'taskDefinition.containerDefinitions[0].image'

# Check ECS service status
aws ecs describe-services \
  --cluster production-cluster \
  --services production-app \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount,taskDef:taskDefinition}'

# List recent stopped tasks with exit codes
aws ecs list-tasks --cluster production-cluster --desired-status STOPPED --service-name production-app \
  | jq -r '.taskArns[]' \
  | xargs -I{} aws ecs describe-tasks --cluster production-cluster --tasks {} \
  | jq '.tasks[].containers[] | {name:.name, exit:.exitCode, reason:.reason}'

# Force a new deployment (without changing image)
aws ecs update-service \
  --cluster production-cluster \
  --service production-app \
  --force-new-deployment

# Manually trigger rollback to specific revision
aws ecs update-service \
  --cluster production-cluster \
  --service production-app \
  --task-definition production-app:42
```
