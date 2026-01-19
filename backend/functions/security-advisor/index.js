/**
 * ==============================================================================
 * NETKNIFE - SECURITY ADVISOR CHATBOT LAMBDA
 * ==============================================================================
 * 
 * AI-powered security advisor that provides guidance on security incidents
 * and recommends NetKnife tools for investigation.
 * 
 * FEATURES:
 * - Context-aware security advice
 * - Tool recommendations with step-by-step guidance
 * - Technical explanations for engineers
 * - Executive-friendly summaries
 * - Uses OpenAI GPT-4o-mini (cost-effective, high quality)
 * 
 * REQUEST:
 *   POST {
 *     "message": "I think I got breached",
 *     "conversation_history": [] // optional
 *   }
 * 
 * RESPONSE:
 *   {
 *     "response": "Based on your situation...",
 *     "recommended_tools": ["emailrep", "breachdirectory", ...],
 *     "steps": [...]
 *   }
 * ==============================================================================
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const CACHE_TABLE = process.env.CACHE_TABLE;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // Cost-effective, high quality

// Available NetKnife tools for the AI to recommend
const AVAILABLE_TOOLS = {
  email: [
    { id: 'emailrep', name: 'Email Reputation (EmailRep)', description: 'Check email reputation and suspicious activity' },
    { id: 'breachdirectory', name: 'Email Breach Check', description: 'Check if email appears in data breaches' },
    { id: 'hibp', name: 'Password Breach Check (HIBP)', description: 'Check if password has been compromised' },
    { id: 'hunter', name: 'Email Finder (Hunter)', description: 'Verify email and find associated accounts' },
    { id: 'ipqs-email', name: 'Email Verification (IPQS)', description: 'Validate email, detect disposable/spamtraps' },
    { id: 'osint-dashboard', name: 'OSINT Dashboard', description: 'Comprehensive email analysis from multiple sources' },
  ],
  ip: [
    { id: 'ip-api', name: 'IP Geolocation', description: 'Get IP location and ISP information' },
    { id: 'abuseipdb', name: 'AbuseIPDB', description: 'Check IP reputation and abuse reports' },
    { id: 'ipqualityscore', name: 'IP Reputation (IPQS)', description: 'Fraud score and VPN/proxy detection' },
    { id: 'greynoise', name: 'GreyNoise', description: 'Internet scanner and threat intelligence' },
    { id: 'osint-dashboard', name: 'OSINT Dashboard', description: 'Comprehensive IP analysis from multiple sources' },
  ],
  domain: [
    { id: 'dns', name: 'DNS Lookup', description: 'DNS resolution and record analysis' },
    { id: 'rdap', name: 'RDAP / WHOIS', description: 'Domain registration information' },
    { id: 'dns-propagation', name: 'DNS Propagation', description: 'Check DNS across global resolvers' },
    { id: 'security-trails', name: 'SecurityTrails', description: 'Historical DNS and domain data' },
  ],
  general: [
    { id: 'osint-dashboard', name: 'OSINT Dashboard', description: 'Consolidated threat intelligence' },
    { id: 'headers', name: 'HTTP Headers', description: 'Security headers analysis' },
    { id: 'tls', name: 'TLS Inspector', description: 'Certificate chain and expiry' },
  ],
  phone: [
    { id: 'ipqs-phone', name: 'Phone Validation (IPQS)', description: 'Validate phone numbers and detect risky numbers' },
    { id: 'phone-validator', name: 'Phone Validator', description: 'Phone number validation and carrier detection' },
  ],
  url: [
    { id: 'ipqs-url', name: 'URL Scanner (IPQS)', description: 'Scan URLs for phishing, malware, suspicious content' },
  ],
};

// System prompt that guides the AI
const SYSTEM_PROMPT = `You are a cybersecurity advisor integrated into NetKnife, a network and security Swiss Army knife tool.

Your role is to:
1. Provide expert security guidance for incidents (breaches, hacks, suspicious activity)
2. Recommend specific NetKnife tools that can help investigate
3. Provide step-by-step guidance on using those tools
4. Explain findings in both technical (for engineers) and executive-friendly terms

Available NetKnife Tools:

EMAIL SECURITY:
- Email Reputation (EmailRep): Check email reputation, suspicious activity, credentials leaked
- Email Breach Check (BreachDirectory): Check if email appears in data breaches
- Password Breach Check (HIBP): Check if password hash appears in breaches (k-anonymity)
- Email Finder (Hunter): Verify email and find associated accounts
- Email Verification (IPQualityScore): Validate email, detect disposable/spamtraps, check deliverability
- OSINT Dashboard: Comprehensive email analysis from multiple sources

IP SECURITY:
- IP Geolocation (IP-API): Get IP location, ISP, ASN information
- AbuseIPDB: Check IP reputation and community abuse reports
- IP Reputation (IPQualityScore): Fraud score, VPN/proxy/Tor detection
- GreyNoise: Internet scanner and threat intelligence
- OSINT Dashboard: Comprehensive IP analysis from multiple sources

DOMAIN SECURITY:
- DNS Lookup: DNS resolution and record analysis
- RDAP / WHOIS: Domain registration information
- DNS Propagation: Check DNS across global resolvers
- SecurityTrails: Historical DNS and domain data

PHONE SECURITY:
- Phone Validation (IPQualityScore): Validate phone numbers, detect risky numbers, carrier info

URL SECURITY:
- URL Scanner (IPQualityScore): Scan URLs for phishing, malware, suspicious content

GENERAL:
- OSINT Dashboard: Consolidated threat intelligence (email, IP, domain)
- HTTP Headers: Security headers analysis
- TLS Inspector: Certificate chain and expiry

When providing advice:
1. Assess the situation and identify what type of investigation is needed
2. Recommend specific tools in order of priority
3. Provide step-by-step guidance on what to check in each tool
4. Explain what to look for in the results
5. Provide both technical details (for engineers) and executive summary
6. Include actionable next steps

Format your response as JSON with:
{
  "advice": "Main advice text",
  "recommended_tools": [
    {
      "id": "tool-id",
      "name": "Tool Name",
      "reason": "Why this tool is recommended",
      "steps": ["Step 1", "Step 2", ...],
      "what_to_look_for": "What to check in the results"
    }
  ],
  "technical_details": "Detailed technical explanation for engineers",
  "executive_summary": "High-level summary for executives",
  "next_steps": ["Action 1", "Action 2", ...]
}`;

// System prompt for help/navigation mode (floating assistant)
const HELP_SYSTEM_PROMPT = `You are a friendly in-app assistant for NetKnife, a network and security Swiss Army knife with 57+ tools.

Your role: help users navigate NetKnife and answer questions about the app.

NAVIGATION:
- Sidebar (left): all tools by category (Network Calculators, DNS & Domain, Certificates & TLS, Network Intelligence, Threat Intelligence, Email Security, etc.). Click a tool to open it.
- Top bar: Account (profile: avatar, name, bio) → /settings | Pricing (plans, usage, donate) → /pricing | Board (message board) → /board | Reports → /tools/report-builder | Sign out.

MAIN ROUTES:
- /pricing — Plans (Free, API Access $5/mo), usage, donations
- /settings — Profile (avatar, display name, bio), theme, subscription link
- /board — Message board: channels, threads, comments, likes, bookmarks, DMs. Request new channels: admin@alexflux.com
- /tools/report-builder — Collect tool outputs and build PDF reports
- /tools/security-advisor — AI security incident guidance and tool recommendations

TOOLS (path = /tools/ID). Key tools:
- subnet, cidr-range, ip-converter, ipv6-analyzer (Network)
- dns, reverse-dns, rdap, dns-propagation (DNS & Domain)
- tls, pem-decoder, ssl-labs (TLS)
- peeringdb, bgp-looking-glass, asn-details, traceroute, ip-api (Network Intelligence)
- abuseipdb, hibp, emailrep, breachdirectory, ipqualityscore, ipqs-email, ipqs-phone, ipqs-url, phone-validator, hunter, osint-dashboard, security-advisor, virustotal, shodan, greynoise, censys, security-trails (Threat / Email)
- report-builder (Reports)
Plus 40+ more in the Sidebar (headers, email-auth, diff, regex, jwt-decoder, etc.). Path format: /tools/<id>.

RULES:
1. Be concise. For "where is X" or "how do I get to X", give a short answer AND add a suggested_links entry so the user can jump there.
2. When suggesting a tool or page, always add {"label": "Open <Name>", "path": "/tools/xxx"} or {"label": "Pricing", "path": "/pricing"} to suggested_links.
3. For security investigations, suggest the Security Advisor: /tools/security-advisor.
4. Respond with JSON only: {"response": "your answer here", "suggested_links": [{"label": "..", "path": ".."}]}. suggested_links can be [] when no specific page fits.`;

// ------------------------------------------------------------------------------
// CACHE HELPERS
// ------------------------------------------------------------------------------

async function cacheGet(key) {
  if (!CACHE_TABLE) return null;
  try {
    const res = await ddb.send(new GetCommand({ TableName: CACHE_TABLE, Key: { cache_key: key } }));
    if (res.Item && res.Item.expires_at > Math.floor(Date.now() / 1000)) {
      return res.Item.data;
    }
  } catch (e) {
    console.warn("Cache get error:", e.message);
  }
  return null;
}

async function cachePut(key, data, ttlSeconds) {
  if (!CACHE_TABLE) return;
  try {
    await ddb.send(new PutCommand({
      TableName: CACHE_TABLE,
      Item: {
        cache_key: key,
        data,
        expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
      },
    }));
  } catch (e) {
    console.warn("Cache put error:", e.message);
  }
}

// ------------------------------------------------------------------------------
// OPENAI API CALL
// ------------------------------------------------------------------------------

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }, // Force JSON response
    }),
    timeout: 30000,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
    throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || "Unknown error"}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ------------------------------------------------------------------------------
// RESPONSE HELPER
// ------------------------------------------------------------------------------

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

// ------------------------------------------------------------------------------
// LAMBDA HANDLER
// ------------------------------------------------------------------------------

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const userMessage = String(body.message || "").trim();
    const conversationHistory = Array.isArray(body.conversation_history) 
      ? body.conversation_history 
      : [];

    if (!userMessage) {
      return json(400, { error: "Missing required field: message" });
    }

    if (!OPENAI_API_KEY) {
      return json(500, { 
        error: "OpenAI API key not configured",
        hint: "Set OPENAI_API_KEY in Lambda environment variables"
      });
    }

    const isHelp = body.mode === "help";
    const systemPrompt = isHelp ? HELP_SYSTEM_PROMPT : SYSTEM_PROMPT;

    // Build conversation context
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role || "user",
        content: msg.content || msg.message || ""
      })),
      { role: "user", content: userMessage }
    ];

    // Check cache (cache by message hash for similar queries)
    const crypto = require("crypto");
    const messageHash = crypto
      .createHash("sha256")
      .update(userMessage.toLowerCase().trim())
      .digest("hex")
      .substring(0, 16);
    
    const cacheKey = isHelp ? `help:${messageHash}` : `advisor:${messageHash}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return json(200, { ...cached, cached: true });
    }

    // Call OpenAI API
    const aiResponse = await callOpenAI(messages);
    
    // Help mode: { response, suggested_links }
    if (isHelp) {
      let parsed = {};
      try {
        parsed = JSON.parse(aiResponse);
      } catch (e) {
        parsed = { response: aiResponse, suggested_links: [] };
      }
      const helpResult = {
        response: parsed.response || parsed.advice || aiResponse,
        suggested_links: Array.isArray(parsed.suggested_links)
          ? parsed.suggested_links.filter((l) => l && (l.path || l.label))
          : [],
        cached: false,
      };
      await cachePut(cacheKey, helpResult, 1800); // 30 min
      return json(200, helpResult);
    }

    // Security advisor mode: existing JSON shape
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (e) {
      parsedResponse = {
        advice: aiResponse,
        recommended_tools: [],
        technical_details: "",
        executive_summary: "",
        next_steps: []
      };
    }

    const result = {
      response: parsedResponse.advice || parsedResponse.response || aiResponse,
      recommended_tools: parsedResponse.recommended_tools || [],
      technical_details: parsedResponse.technical_details || "",
      executive_summary: parsedResponse.executive_summary || "",
      next_steps: parsedResponse.next_steps || [],
      raw_response: parsedResponse,
    };

    await cachePut(cacheKey, result, 3600); // 1 hour

    return json(200, { ...result, cached: false });

  } catch (e) {
    console.error("Security advisor error:", e);
    return json(500, { 
      error: e.message || "Server error",
      hint: e.message?.includes("API key") 
        ? "Configure OPENAI_API_KEY in Lambda environment" 
        : "Check logs for details"
    });
  }
};
