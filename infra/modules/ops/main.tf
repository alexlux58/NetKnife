# ==============================================================================
# NETKNIFE - OPERATIONS & MONITORING MODULE
# ==============================================================================
# This module creates monitoring, alerting, and logging infrastructure:
# - SNS topic for alert notifications
# - CloudWatch alarms for Lambda errors, throttles, duration
# - CloudWatch alarms for API Gateway 5xx errors, latency
# - WAF logging configuration
# - CloudWatch log groups with retention policies
#
# All alerts are sent via email through SNS.
# ==============================================================================

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

# ------------------------------------------------------------------------------
# VARIABLES
# ------------------------------------------------------------------------------

variable "name_prefix" {
  type        = string
  description = "Prefix for resource names"
}

variable "alert_email" {
  type        = string
  description = "Email address for alert notifications"
}

variable "api_id" {
  type        = string
  description = "API Gateway HTTP API ID for monitoring"
}

variable "api_stage" {
  type        = string
  default     = "$default"
  description = "API Gateway stage name"
}

variable "lambda_function_names" {
  type        = list(string)
  description = "List of Lambda function names to monitor"
}

variable "waf_web_acl_arn" {
  type        = string
  default     = null
  description = "WAF Web ACL ARN for logging (optional)"
}

variable "waf_log_group_name" {
  type        = string
  default     = null
  description = "CloudWatch log group name for WAF logs (must start with aws-waf-logs-)"
}

variable "enable_waf_logging" {
  type        = bool
  default     = false
  description = "Enable WAF logging (set to true when waf_web_acl_arn is provided)"
}

# Get current AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ------------------------------------------------------------------------------
# SNS TOPIC FOR ALERTS
# ------------------------------------------------------------------------------
# Central topic for all monitoring alerts.
# Subscribers receive email notifications.

resource "aws_sns_topic" "alerts" {
  name         = "${var.name_prefix}-alerts"
  display_name = "NetKnife Alerts"

  tags = {
    Purpose = "Monitoring alerts"
  }
}

# Email subscription (requires confirmation)
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ------------------------------------------------------------------------------
# CLOUDWATCH LOG GROUPS (Lambda Functions)
# ------------------------------------------------------------------------------
# Creates log groups with 30-day retention for each Lambda.
# Lambda automatically creates log groups, but pre-creating them
# allows us to set retention policies.

resource "aws_cloudwatch_log_group" "lambda" {
  for_each          = toset(var.lambda_function_names)
  name              = "/aws/lambda/${each.value}"
  retention_in_days = 30

  tags = {
    Function = each.value
  }
}

# ------------------------------------------------------------------------------
# LAMBDA ALARMS
# ------------------------------------------------------------------------------
# Monitors Lambda functions for errors, throttles, and slow execution.

# ALARM: Lambda Errors > 0
# Fires when any Lambda function throws an error
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.name_prefix}-lambda-errors-${each.value}"
  alarm_description   = "Lambda errors > 0 for ${each.value}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300  # 5 minutes
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Function = each.value
    Type     = "Errors"
  }
}

# ALARM: Lambda Throttles > 0
# Fires when Lambda is throttled (hitting concurrency limits)
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.name_prefix}-lambda-throttles-${each.value}"
  alarm_description   = "Lambda throttles > 0 for ${each.value}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Function = each.value
    Type     = "Throttles"
  }
}

# ALARM: Lambda Duration p95 > 2000ms
# Fires when 95th percentile duration exceeds 2 seconds
resource "aws_cloudwatch_metric_alarm" "lambda_duration_p95" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.name_prefix}-lambda-duration-${each.value}"
  alarm_description   = "Lambda p95 duration > 2000ms for ${each.value}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 2000  # 2 seconds
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Function = each.value
    Type     = "Duration"
  }
}

# ------------------------------------------------------------------------------
# API GATEWAY ALARMS
# ------------------------------------------------------------------------------

# ALARM: API Gateway 5XX Errors > 0
resource "aws_cloudwatch_metric_alarm" "apigw_5xx" {
  alarm_name          = "${var.name_prefix}-apigw-5xx"
  alarm_description   = "API Gateway 5XX errors > 0"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_id
    Stage = var.api_stage
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Type = "API5xx"
  }
}

# ALARM: API Gateway Latency p95 > 1500ms
resource "aws_cloudwatch_metric_alarm" "apigw_latency" {
  alarm_name          = "${var.name_prefix}-apigw-latency"
  alarm_description   = "API Gateway p95 latency > 1500ms"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 1500
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_id
    Stage = var.api_stage
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Type = "APILatency"
  }
}

# ------------------------------------------------------------------------------
# WAF LOGGING (Optional)
# ------------------------------------------------------------------------------
# Logs WAF requests to CloudWatch for security analysis.
# Log group name MUST start with "aws-waf-logs-"

resource "aws_cloudwatch_log_group" "waf" {
  count             = var.enable_waf_logging ? 1 : 0
  name              = var.waf_log_group_name
  retention_in_days = 30

  tags = {
    Purpose = "WAF logging"
  }
}

# Resource policy to allow WAF to write logs
resource "aws_cloudwatch_log_resource_policy" "waf_logs" {
  count       = var.enable_waf_logging ? 1 : 0
  policy_name = "AWSWAFLogsToCloudWatch-${var.name_prefix}"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowWAFLogs"
      Effect = "Allow"
      Principal = {
        Service = "delivery.logs.amazonaws.com"
      }
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.waf[0].arn}:*"
      Condition = {
        ArnLike = {
          "aws:SourceArn" = "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:*"
        }
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })
}

# WAF logging configuration
resource "aws_wafv2_web_acl_logging_configuration" "waf" {
  count = var.enable_waf_logging ? 1 : 0

  resource_arn            = var.waf_web_acl_arn
  log_destination_configs = [aws_cloudwatch_log_group.waf[0].arn]

  # Redact sensitive headers from logs
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }

  redacted_fields {
    single_header {
      name = "x-api-key"
    }
  }

  depends_on = [aws_cloudwatch_log_resource_policy.waf_logs]
}

# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "alerts_topic_arn" {
  value       = aws_sns_topic.alerts.arn
  description = "SNS topic ARN for alerts"
}

output "alerts_topic_name" {
  value       = aws_sns_topic.alerts.name
  description = "SNS topic name"
}

