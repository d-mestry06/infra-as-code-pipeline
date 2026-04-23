# ─────────────────────────────────────────────
# KMS Key for CloudWatch Logs + SNS encryption
# ─────────────────────────────────────────────

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_kms_key" "monitoring" {
  description             = "KMS key for ${var.env} CloudWatch logs and SNS"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM root access"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${data.aws_region.current.name}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey*",
          "kms:DescribeKey", "kms:ReEncrypt*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow SNS"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = ["kms:Decrypt", "kms:GenerateDataKey*"]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.env}-monitoring-key"
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "monitoring" {
  name          = "alias/${var.env}-monitoring"
  target_key_id = aws_kms_key.monitoring.key_id
}

# ─────────────────────────────────────────────
# CloudWatch Log Group
# ─────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.env}-app"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.monitoring.arn

  tags = {
    Name        = "/ecs/${var.env}-app"
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

# ─────────────────────────────────────────────
# SNS Topic for Alerts
# ─────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name              = "${var.env}-alerts"
  kms_master_key_id = aws_kms_key.monitoring.arn

  tags = {
    Name        = "${var.env}-alerts"
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ─────────────────────────────────────────────
# CloudWatch Alarms
# ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.env}-ecs-cpu-high"
  alarm_description   = "ECS CPU utilization above 85% for 2 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = "${var.env}-cluster"
    ServiceName = "${var.env}-app"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_metric_alarm" "memory_high" {
  alarm_name          = "${var.env}-ecs-memory-high"
  alarm_description   = "ECS memory utilization above 85% for 2 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = "${var.env}-cluster"
    ServiceName = "${var.env}-app"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${var.env}-alb-unhealthy-hosts"
  alarm_description   = "ALB has unhealthy targets"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.env}-alb-5xx-errors"
  alarm_description   = "ALB 5XX error rate above 5%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_ELB_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.env
    ManagedBy   = "terraform"
  }
}

# ─────────────────────────────────────────────
# CloudWatch Dashboard
# ─────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.env}-app-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ECS CPU & Memory"
          period = 60
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", "${var.env}-cluster", "ServiceName", "${var.env}-app"],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", "${var.env}-cluster", "ServiceName", "${var.env}-app"]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ALB Request Count & Errors"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", "LoadBalancer", var.alb_arn_suffix],
            ["AWS/ApplicationELB", "UnHealthyHostCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix]
          ]
          view = "timeSeries"
        }
      }
    ]
  })
}
