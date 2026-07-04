/**
 * AWS monthly cost estimator (us-west-2 approximate rates).
 * Rates are static estimates — not live AWS Pricing API. For planning only.
 */

export const AWS_REGION = 'us-west-2'

export const AWS_RATE_DISCLAIMER =
  'Approximate us-west-2 list prices for planning. Actual bills vary by region, discounts, free tier, and usage patterns. Last reviewed 2026.'

/** USD per unit per month unless noted */
export const AWS_RATES = {
  ec2: {
    't3.micro': 0.0104,
    't3.small': 0.0208,
    't3.medium': 0.0416,
    't3.large': 0.0832,
    'm5.large': 0.096,
  },
  ebsGp3PerGbMonth: 0.08,
  natGatewayHourly: 0.045,
  natGatewayPerGb: 0.045,
  albHourly: 0.0225,
  albLcuHourly: 0.008,
  lambdaPer1MRequests: 0.2,
  lambdaGbSecond: 0.0000166667,
  dynamoWritePer1M: 1.25,
  dynamoReadPer1M: 0.25,
  s3StandardPerGbMonth: 0.023,
  cloudFrontPerGb: 0.085,
  apiGatewayHttpPer1M: 1.0,
  wafBaseMonthly: 5.0,
  wafRuleMonthly: 1.0,
  route53HostedZone: 0.5,
  dataTransferOutPerGb: 0.09,
  cognitoMau: 0.0055,
} as const

export type AwsTemplateId = 'minimal' | 'ha-web' | 'netknife-like' | 'custom'

export interface AwsServiceInput {
  id: string
  label: string
  quantity: number
  unit: string
  unitPriceUsd: number
  /** 'hourly' | 'monthly' | 'perUnit' */
  billing: 'hourly' | 'monthly' | 'perUnit'
  enabled: boolean
  category: string
}

export interface AwsPricingInput {
  template: AwsTemplateId
  hoursPerMonth: number
  services: AwsServiceInput[]
}

export interface AwsLineItem {
  id: string
  label: string
  quantity: number
  unit: string
  unitPriceUsd: number
  monthlyUsd: number
  category: string
}

export interface AwsPricingEstimate {
  region: string
  lineItems: AwsLineItem[]
  byCategory: Record<string, number>
  totalMonthlyUsd: number
  disclaimer: string
}

export function hoursPerMonth(hoursPerDay = 730 / 30): number {
  return Math.round(hoursPerDay * 30)
}

export function serviceMonthlyCost(s: AwsServiceInput, hoursPerMonthVal: number): number {
  if (!s.enabled || s.quantity <= 0) return 0
  switch (s.billing) {
    case 'hourly':
      return s.quantity * s.unitPriceUsd * hoursPerMonthVal
    case 'monthly':
      return s.quantity * s.unitPriceUsd
    case 'perUnit':
      return s.quantity * s.unitPriceUsd
    default:
      return 0
  }
}

export function estimateAwsPricing(input: AwsPricingInput): AwsPricingEstimate {
  const hpm = input.hoursPerMonth
  const lineItems: AwsLineItem[] = input.services
    .filter((s) => s.enabled && s.quantity > 0)
    .map((s) => ({
      id: s.id,
      label: s.label,
      quantity: s.quantity,
      unit: s.unit,
      unitPriceUsd: s.unitPriceUsd,
      monthlyUsd: serviceMonthlyCost(s, hpm),
      category: s.category,
    }))
    .sort((a, b) => b.monthlyUsd - a.monthlyUsd)

  const byCategory: Record<string, number> = {}
  for (const item of lineItems) {
    byCategory[item.category] = (byCategory[item.category] || 0) + item.monthlyUsd
  }

  const totalMonthlyUsd = lineItems.reduce((sum, i) => sum + i.monthlyUsd, 0)

  return {
    region: AWS_REGION,
    lineItems,
    byCategory,
    totalMonthlyUsd,
    disclaimer: AWS_RATE_DISCLAIMER,
  }
}

export function buildTemplateServices(template: AwsTemplateId): AwsServiceInput[] {
  const h = AWS_RATES
  const base = (s: Omit<AwsServiceInput, 'enabled'> & { enabled?: boolean }): AwsServiceInput => ({
    ...s,
    enabled: s.enabled ?? true,
  })

  switch (template) {
    case 'minimal':
      return [
        base({ id: 'lambda-req', label: 'Lambda requests (millions)', quantity: 0.5, unit: 'M req', unitPriceUsd: h.lambdaPer1MRequests, billing: 'perUnit', category: 'Compute' }),
        base({ id: 'lambda-gb', label: 'Lambda GB-seconds (thousands)', quantity: 100, unit: 'K GB-s', unitPriceUsd: h.lambdaGbSecond * 1000, billing: 'perUnit', category: 'Compute' }),
        base({ id: 'apigw', label: 'API Gateway HTTP (millions)', quantity: 0.5, unit: 'M req', unitPriceUsd: h.apiGatewayHttpPer1M, billing: 'perUnit', category: 'Networking' }),
        base({ id: 'dynamo-w', label: 'DynamoDB writes (millions)', quantity: 0.2, unit: 'M WCU', unitPriceUsd: h.dynamoWritePer1M, billing: 'perUnit', category: 'Database' }),
        base({ id: 'dynamo-r', label: 'DynamoDB reads (millions)', quantity: 1, unit: 'M RCU', unitPriceUsd: h.dynamoReadPer1M, billing: 'perUnit', category: 'Database' }),
        base({ id: 's3', label: 'S3 storage', quantity: 5, unit: 'GB', unitPriceUsd: h.s3StandardPerGbMonth, billing: 'monthly', category: 'Storage' }),
        base({ id: 'cf', label: 'CloudFront egress', quantity: 20, unit: 'GB', unitPriceUsd: h.cloudFrontPerGb, billing: 'perUnit', category: 'CDN' }),
      ]
    case 'ha-web':
      return [
        base({ id: 'ec2', label: 'EC2 t3.small instances', quantity: 2, unit: 'instances', unitPriceUsd: h.ec2['t3.small'], billing: 'hourly', category: 'Compute' }),
        base({ id: 'ebs', label: 'EBS gp3', quantity: 60, unit: 'GB', unitPriceUsd: h.ebsGp3PerGbMonth, billing: 'monthly', category: 'Storage' }),
        base({ id: 'alb', label: 'Application Load Balancer', quantity: 1, unit: 'ALB', unitPriceUsd: h.albHourly, billing: 'hourly', category: 'Networking' }),
        base({ id: 'alb-lcu', label: 'ALB LCU-hours', quantity: 730, unit: 'LCU-hr', unitPriceUsd: h.albLcuHourly, billing: 'perUnit', category: 'Networking' }),
        base({ id: 'nat', label: 'NAT Gateway', quantity: 1, unit: 'NAT', unitPriceUsd: h.natGatewayHourly, billing: 'hourly', category: 'Networking' }),
        base({ id: 'nat-gb', label: 'NAT Gateway data processed', quantity: 50, unit: 'GB', unitPriceUsd: h.natGatewayPerGb, billing: 'perUnit', category: 'Networking' }),
        base({ id: 'r53', label: 'Route 53 hosted zones', quantity: 1, unit: 'zone', unitPriceUsd: h.route53HostedZone, billing: 'monthly', category: 'DNS' }),
        base({ id: 'egress', label: 'Data transfer out', quantity: 100, unit: 'GB', unitPriceUsd: h.dataTransferOutPerGb, billing: 'perUnit', category: 'Networking' }),
      ]
    case 'netknife-like':
      return [
        base({ id: 'lambda-req', label: 'Lambda requests (millions)', quantity: 2, unit: 'M req', unitPriceUsd: h.lambdaPer1MRequests, billing: 'perUnit', category: 'Compute' }),
        base({ id: 'lambda-gb', label: 'Lambda GB-seconds (thousands)', quantity: 400, unit: 'K GB-s', unitPriceUsd: h.lambdaGbSecond * 1000, billing: 'perUnit', category: 'Compute' }),
        base({ id: 'apigw', label: 'API Gateway HTTP (millions)', quantity: 2, unit: 'M req', unitPriceUsd: h.apiGatewayHttpPer1M, billing: 'perUnit', category: 'Networking' }),
        base({ id: 'dynamo-w', label: 'DynamoDB writes (millions)', quantity: 1, unit: 'M WCU', unitPriceUsd: h.dynamoWritePer1M, billing: 'perUnit', category: 'Database' }),
        base({ id: 'dynamo-r', label: 'DynamoDB reads (millions)', quantity: 5, unit: 'M RCU', unitPriceUsd: h.dynamoReadPer1M, billing: 'perUnit', category: 'Database' }),
        base({ id: 's3', label: 'S3 static site + assets', quantity: 10, unit: 'GB', unitPriceUsd: h.s3StandardPerGbMonth, billing: 'monthly', category: 'Storage' }),
        base({ id: 'cf', label: 'CloudFront egress', quantity: 50, unit: 'GB', unitPriceUsd: h.cloudFrontPerGb, billing: 'perUnit', category: 'CDN' }),
        base({ id: 'waf', label: 'WAF base', quantity: 1, unit: 'ACL', unitPriceUsd: h.wafBaseMonthly, billing: 'monthly', category: 'Security' }),
        base({ id: 'waf-rules', label: 'WAF rules', quantity: 5, unit: 'rules', unitPriceUsd: h.wafRuleMonthly, billing: 'monthly', category: 'Security' }),
        base({ id: 'cognito', label: 'Cognito MAUs', quantity: 500, unit: 'MAU', unitPriceUsd: h.cognitoMau, billing: 'perUnit', category: 'Auth' }),
        base({ id: 'r53', label: 'Route 53 hosted zone', quantity: 1, unit: 'zone', unitPriceUsd: h.route53HostedZone, billing: 'monthly', category: 'DNS' }),
        base({ id: 'ec2-lab', label: 'Kali lab EC2 t3.medium (avg hrs)', quantity: 20, unit: 'inst-hr', unitPriceUsd: h.ec2['t3.medium'], billing: 'perUnit', category: 'Labs' }),
        base({ id: 'ebs-lab', label: 'Lab EBS gp3', quantity: 30, unit: 'GB', unitPriceUsd: h.ebsGp3PerGbMonth, billing: 'monthly', category: 'Labs' }),
      ]
    case 'custom':
    default:
      return buildTemplateServices('minimal')
  }
}

export const AWS_TEMPLATES: { id: AwsTemplateId; name: string; description: string }[] = [
  { id: 'minimal', name: 'Minimal serverless', description: 'Lambda, API GW, DynamoDB, S3, CloudFront' },
  { id: 'ha-web', name: 'HA web app', description: '2× EC2, ALB, NAT Gateway, Route 53' },
  { id: 'netknife-like', name: 'NetKnife-like stack', description: 'Serverless API, WAF, Cognito, labs EC2' },
  { id: 'custom', name: 'Custom', description: 'Start from minimal and edit line items' },
]

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
