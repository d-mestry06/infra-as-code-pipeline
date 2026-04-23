# Architecture — infra-as-code-pipeline

## Design Principles

1. **No human touches production** — all changes flow through code review + CI/CD
2. **Infrastructure is versioned** — Terraform state in S3, every change is a commit
3. **Secrets never in code** — GitHub Secrets and SSM Parameter Store only
4. **Immutable deployments** — new image tag per git SHA, never overwrite
5. **Automatic recovery** — ECS circuit breaker + pipeline rollback

---

## Network Architecture

### CIDR Allocation

| Environment | VPC CIDR      | Public Subnets            | Private Subnets            |
|-------------|---------------|---------------------------|----------------------------|
| dev         | 10.0.0.0/16   | 10.0.1.0/24, 10.0.2.0/24 | 10.0.10.0/24, 10.0.11.0/24|
| staging     | 10.1.0.0/16   | 10.1.1.0/24, 10.1.2.0/24 | 10.1.10.0/24, 10.1.11.0/24|
| production  | 10.2.0.0/16   | 10.2.1.0/24, 10.2.2.0/24 | 10.2.10.0/24, 10.2.11.0/24|

### Traffic Flow

```
Internet
  │
  ▼  port 80
ALB (public subnet, 2 AZs)
  │
  │  security group: ALB → ECS on port 8080 only
  ▼
ECS Tasks (private subnet, no public IP)
  │
  ├─► ECR (image pull via NAT Gateway)
  ├─► CloudWatch Logs (via NAT Gateway)
  └─► SSM Parameter Store (via NAT Gateway)
```

### Security Group Rules

**ALB Security Group**
- Inbound: 0.0.0.0/0 → port 80 (HTTP)
- Inbound: 0.0.0.0/0 → port 443 (HTTPS, for future TLS)
- Outbound: all

**ECS Security Group**
- Inbound: ALB SG → port 8080 (container port) only
- Outbound: all (for ECR pull, CloudWatch, SSM)

---

## ECS Fargate Configuration

### Task Definition

| Setting              | Dev     | Staging | Production |
|----------------------|---------|---------|------------|
| CPU units            | 256     | 256     | 512        |
| Memory (MB)          | 512     | 512     | 1024       |
| Desired tasks        | 1       | 2       | 2          |
| Min tasks            | 1       | 2       | 2          |
| Max tasks            | 2       | 4       | 6          |
| Log retention        | 7 days  | 14 days | 30 days    |

### Health Check Configuration

- **Path:** `GET /health`
- **Expected response:** HTTP 200
- **Interval:** 30 seconds
- **Timeout:** 5 seconds
- **Healthy threshold:** 2 consecutive passes
- **Unhealthy threshold:** 3 consecutive failures
- **Start period:** 60 seconds (allows container to warm up)

### Auto-scaling Triggers

| Metric              | Target | Scale-out cooldown | Scale-in cooldown |
|---------------------|--------|-------------------|-------------------|
| CPU Utilization     | 70%    | 60 seconds        | 300 seconds       |
| Memory Utilization  | 80%    | 60 seconds        | 300 seconds       |

---

## Deployment Strategy

### Blue/Green via ECS Rolling Update

ECS uses rolling updates by default with these settings:

- `deployment_minimum_healthy_percent = 100` → never drop below current capacity
- `deployment_maximum_percent = 200` → can run 2× tasks temporarily

**Flow for a 2-task service:**
1. Register new task definition
2. Start 2 new tasks (now 4 total running)
3. New tasks pass ALB health checks
4. Old 2 tasks are deregistered and stopped
5. Service stabilized at 2 new tasks

### Deployment Circuit Breaker

ECS native circuit breaker is enabled:

```hcl
deployment_circuit_breaker {
  enable   = true
  rollback = true
}
```

This is a second layer of protection — even before the pipeline's `aws ecs wait` times out, ECS itself will roll back if a deployment consistently fails health checks.

---

## Terraform Remote State

### State Isolation

Each environment has its own state file key in S3:

```
s3://terraform-state-<YOUR_BUCKET_SUFFIX>/
├── dev/terraform.tfstate
├── staging/terraform.tfstate
└── production/terraform.tfstate
```

### State Locking

DynamoDB table `terraform-state-lock` uses `LockID` as the primary key.  
Terraform writes a lock record before any `plan` or `apply` and deletes it after.  
If a process crashes mid-apply, the lock remains — see the runbook for how to release it.

---

## IAM Roles

### ECS Task Execution Role (`<env>-ecs-task-execution-role`)

Used by ECS to set up the container (not by the running app).  
Permissions:
- `AmazonECSTaskExecutionRolePolicy` (ECR pull, CloudWatch log create/write)
- Custom: `ssm:GetParameters` for `/env/*` Parameter Store paths
- Custom: `kms:Decrypt` for encrypted parameters

### ECS Task Role (`<env>-ecs-task-role`)

Used by the running application code.  
Currently empty — extend this when the app needs to call other AWS services  
(e.g., S3, SQS, DynamoDB).

### GitHub Actions IAM User

Minimum permissions required:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:ListImages"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:ListTaskDefinitions"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeTargetHealth"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["iam:PassRole"],
      "Resource": "arn:aws:iam::*:role/*-ecs-task-*"
    }
  ]
}
```
