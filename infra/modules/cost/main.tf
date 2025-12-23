# ==============================================================================
# NETKNIFE - COST MANAGEMENT MODULE
# ==============================================================================
# This module creates AWS cost management resources:
# - AWS Budget with email alerts at thresholds
# - Cost Anomaly Detection for unexpected spending
#
# Cost Management Features:
# - Monthly cost budget with configurable limit
# - Alerts at 80% and 100% of budget
# - Forecast alerts when projected to exceed budget
# - Automatic anomaly detection per service
#
# Pricing:
# - AWS Budgets: Free (no charge for budget notifications)
# - Cost Anomaly Detection: Free for basic monitoring
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

variable "alerts_topic_arn" {
  type        = string
  description = "SNS topic ARN for budget alerts"
}

variable "monthly_budget_usd" {
  type        = number
  default     = 25
  description = "Monthly cost budget in USD"
}

variable "budget_alert_thresholds" {
  type        = list(number)
  default     = [80, 100]
  description = "Percentage thresholds for budget alerts"
}

variable "anomaly_threshold_usd" {
  type        = number
  default     = 5
  description = "Dollar threshold for cost anomaly alerts"
}

variable "enable_anomaly_detection" {
  type        = bool
  default     = false
  description = "Enable Cost Anomaly Detection (set false if limit exceeded)"
}

# ------------------------------------------------------------------------------
# AWS BUDGET
# ------------------------------------------------------------------------------
# Creates a monthly cost budget with notifications at specified thresholds.
# Alerts are sent to the SNS topic when actual or forecasted spending
# exceeds the configured percentages.

resource "aws_budgets_budget" "monthly" {
  name         = "${var.name_prefix}-monthly-cost"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Actual spend notifications (e.g., at 80% and 100%)
  dynamic "notification" {
    for_each = toset([for t in var.budget_alert_thresholds : tostring(t)])
    content {
      comparison_operator       = "GREATER_THAN"
      threshold                 = tonumber(notification.value)
      threshold_type            = "PERCENTAGE"
      notification_type         = "ACTUAL"
      subscriber_sns_topic_arns = [var.alerts_topic_arn]
    }
  }

  # Forecasted spend notification (when projected to exceed budget)
  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "FORECASTED"
    subscriber_sns_topic_arns = [var.alerts_topic_arn]
  }
}

# ------------------------------------------------------------------------------
# COST ANOMALY DETECTION
# ------------------------------------------------------------------------------
# Automatically detects unusual spending patterns across all services.
# Uses machine learning to establish spending baselines and alert on deviations.
# No additional charge for basic anomaly monitoring.

# Anomaly monitor - tracks spending by service
# Skip if limit exceeded (some AWS accounts have a limit on dimensional monitors)
resource "aws_ce_anomaly_monitor" "services" {
  count             = var.enable_anomaly_detection ? 1 : 0
  name              = "${var.name_prefix}-anomaly-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

# Anomaly subscription - sends alerts for anomalies above threshold
resource "aws_ce_anomaly_subscription" "alerts" {
  count     = var.enable_anomaly_detection ? 1 : 0
  name      = "${var.name_prefix}-anomaly-subscription"
  frequency = "DAILY"  # Check for anomalies daily

  monitor_arn_list = [aws_ce_anomaly_monitor.services[0].arn]

  # Alert when anomaly impact exceeds threshold
  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      match_options = ["GREATER_THAN_OR_EQUAL"]
      values        = [tostring(var.anomaly_threshold_usd)]
    }
  }

  subscriber {
    type    = "SNS"
    address = var.alerts_topic_arn
  }
}

# ------------------------------------------------------------------------------
# OUTPUTS
# ------------------------------------------------------------------------------

output "budget_name" {
  value       = aws_budgets_budget.monthly.name
  description = "AWS Budget name"
}

output "anomaly_monitor_arn" {
  value       = var.enable_anomaly_detection ? aws_ce_anomaly_monitor.services[0].arn : null
  description = "Cost Anomaly Monitor ARN"
}

