export interface MermaidTemplate {
  id: string
  name: string
  description: string
  code: string
}

export const MERMAID_TEMPLATES: MermaidTemplate[] = [
  {
    id: 'network-topology',
    name: 'Network topology',
    description: 'Simple LAN with router, switch, and hosts',
    code: `graph LR
  Internet((Internet))
  FW[Firewall]
  RTR[Router]
  SW[Switch]
  SRV[Server]
  WS1[Workstation]
  WS2[Workstation]

  Internet --> FW
  FW --> RTR
  RTR --> SW
  SW --> SRV
  SW --> WS1
  SW --> WS2`,
  },
  {
    id: 'dns-sequence',
    name: 'DNS lookup sequence',
    description: 'Client resolver → recursive → authoritative',
    code: `sequenceDiagram
  participant C as Client
  participant R as Resolver
  participant A as Authoritative NS

  C->>R: Query example.com A
  R->>A: Recursive query
  A-->>R: A 93.184.216.34
  R-->>C: Response + TTL`,
  },
  {
    id: 'aws-serverless',
    name: 'AWS serverless flow',
    description: 'CloudFront → API Gateway → Lambda → DynamoDB',
    code: `flowchart TB
  U[User] --> CF[CloudFront]
  CF --> S3[S3 Static Site]
  U --> APIGW[API Gateway]
  APIGW --> L[Lambda]
  L --> DDB[(DynamoDB)]
  L --> CW[CloudWatch]`,
  },
  {
    id: 'incident-flow',
    name: 'Incident response',
    description: 'Triage flowchart for security alerts',
    code: `flowchart TD
  A[Alert received] --> B{True positive?}
  B -->|No| C[Close / tune rule]
  B -->|Yes| D[Contain]
  D --> E[Investigate]
  E --> F[Remediate]
  F --> G[Post-incident review]`,
  },
  {
    id: 'git-flow',
    name: 'Git branching',
    description: 'Feature branch merge workflow',
    code: `gitGraph
  commit id: "init"
  branch feature
  checkout feature
  commit id: "work"
  commit id: "tests"
  checkout main
  merge feature
  commit id: "release"`,
  },
]

export const DEFAULT_MERMAID = MERMAID_TEMPLATES[0].code
