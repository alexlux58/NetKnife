/**
 * Privacy policy. Includes Google Analytics disclosure (G-2TX7V4D26R, G-QJ74ES61XQ).
 */

import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Privacy policy</h1>
      <p className="text-[var(--color-text-secondary)] text-sm mb-8">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <div className="card p-6 space-y-6 text-[var(--color-text-secondary)]">
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Data we collect</h2>
          <p className="text-sm mb-4">
            We collect only what is needed to run the service and to improve it. When you use NetKnife we may collect:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm ml-2">
            <li>
              <strong className="text-[var(--color-text-primary)]">Account and usage:</strong> Cognito (auth), subscription and usage data for billing and limits.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Google Analytics data:</strong> We use Google Analytics (tracking IDs: G-2TX7V4D26R and G-QJ74ES61XQ) to collect information about how you interact with our website, including: page views, approximate location (country/region), device type, browser, and general browsing behavior. This helps us improve the site. IP anonymization is enabled. Analytics runs only if you accept analytics cookies in the cookie banner.
            </li>
            <li>
              <strong className="text-[var(--color-text-primary)]">Logs and errors:</strong> API and app errors may be logged (e.g. in AWS CloudWatch) for debugging; we do not log request bodies that contain your inputs.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Cookies</h2>
          <p className="text-sm">
            We use a cookie consent banner so you can choose whether to allow analytics cookies. Required cookies (e.g. session, auth) are essential and cannot be disabled. See the cookie preferences in the banner to change your choices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Sharing and retention</h2>
          <p className="text-sm">
            We do not sell your data. We use AWS (Cognito, Lambda, DynamoDB, etc.) and, if you consent, Google Analytics. Data is retained as needed for the service and as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Your rights</h2>
          <p className="text-sm">
            You can request access, correction, or deletion of your data by contacting us. You can withdraw analytics consent at any time via the cookie preferences.
          </p>
        </section>

        <p className="text-sm pt-4 border-t border-[var(--color-border)]">
          <Link to="/" className="text-blue-400 hover:underline">Back to NetKnife</Link>
        </p>
      </div>
    </div>
  )
}
