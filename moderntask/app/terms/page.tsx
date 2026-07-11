import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2 text-muted-foreground hover:text-foreground">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: July 10, 2026</p>
        </div>

        {/* Content card */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-8 space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-3">
              These Terms of Service ("Terms") are entered into by and between you ("Customer," "you," or "your") and the individual operator of Meridian ("Meridian," "we," "us," or "our"), doing business as "Meridian." Meridian is not currently operated through a separate corporate or limited liability entity; "Meridian" in these Terms refers to that individual operator.
            </p>
            <p className="text-muted-foreground mb-3">
              By accessing or using Meridian's AI-powered lead generation platform (the "Service"), you accept and agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Service.
            </p>
            <p className="text-muted-foreground">
              If you use the Service on behalf of a company or other legal entity, you represent and warrant that you have the authority to bind that entity to these Terms, and "you" and "Customer" will refer to that entity. If you do not have such authority, you may not use the Service on that entity's behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Definitions</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li><span className="font-medium text-foreground">"Customer Data"</span> — company information, targeting criteria, campaign configuration, and other data you input into or upload to the Service.</li>
              <li><span className="font-medium text-foreground">"Lead Data"</span> — prospect and contact records sourced, uploaded, enriched, or generated through the Service, including data pulled from third-party providers.</li>
              <li><span className="font-medium text-foreground">"Campaign Data"</span> — email content, send history, and engagement metrics (opens, clicks, replies) associated with your campaigns.</li>
              <li><span className="font-medium text-foreground">"AI Output"</span> — lead recommendations, qualification scores, research summaries, generated email content, and other output produced by the Service's automated or AI-driven features.</li>
              <li><span className="font-medium text-foreground">"De-identified Data"</span> — information that cannot reasonably be used to identify Customer, its users, or any prospect or recipient, and for which Meridian maintains technical and organizational measures designed to prevent re-identification.</li>
              <li><span className="font-medium text-foreground">"Third-Party Services"</span> — external services the Service integrates with or relies on, including Apollo.io, OpenAI, Anthropic, Mailgun, Stripe, Google, Microsoft, and similar providers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Description of Service</h2>
            <p className="text-muted-foreground mb-3">
              Meridian provides an automated platform for B2B lead research, qualification, and outreach. The Service uses artificial intelligence to:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground mb-3">
              <li>Search for potential business leads using third-party data providers</li>
              <li>Research and analyze company information</li>
              <li>Qualify leads based on your targeting criteria</li>
              <li>Generate personalized email content</li>
              <li>Send and track email campaigns</li>
              <li>Provide analytics and performance insights</li>
            </ul>
            <p className="text-muted-foreground">
              The Service does not provide legal, compliance, marketing, deliverability, or other professional advice, and nothing produced by the Service should be treated as such.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. User Accounts</h2>
            <p className="text-muted-foreground mb-3">You must create an account to use the Service. You agree to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update your account information if it changes</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Acceptable Use Policy</h2>
            <p className="text-muted-foreground mb-3">You agree NOT to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground mb-3">
              <li>Send spam, unsolicited bulk emails, or deceptive messages</li>
              <li>Violate any applicable laws, including CAN-SPAM, CASL, or anti-spam regulations</li>
              <li>Harvest or scrape data without proper authorization</li>
              <li>Impersonate others or misrepresent your identity</li>
              <li>Distribute malware, viruses, or harmful code</li>
              <li>Interfere with the Service's security or infrastructure</li>
              <li>Use the Service for illegal, fraudulent, or malicious purposes</li>
              <li>Target individuals who have opted out of communications</li>
              <li>Send emails to purchased or non-permissioned contact lists</li>
              <li>Evade or disable unsubscribe links or suppression mechanisms</li>
              <li>Use multiple accounts to bypass usage limits or enforcement actions</li>
              <li>Run campaigns targeting adult content, gambling, payday lending, debt relief, credit repair, or other high-risk financial offers without our prior written approval</li>
              <li>Process or target based on health information, biometric data, children's data, government identification numbers, or other sensitive personal data</li>
              <li>Use AI Output to make or materially inform employment, housing, credit, insurance, healthcare, or education eligibility decisions about any individual</li>
              <li>Target individuals in a manner that discriminates based on a protected characteristic</li>
            </ul>
            <p className="text-muted-foreground">
              We may suspend or limit access under Section 15 (Suspension) if we reasonably believe your use falls into any of the above categories.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Compliance Requirements</h2>
            <p className="text-muted-foreground mb-3">
              You are solely responsible for ensuring your use of the Service — including lead sourcing, enrichment, qualification, campaign creation, email sending, tracking, and follow-up — complies with all applicable laws, regulations, and third-party terms, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground mb-3">
              <li><span className="font-medium text-foreground">CAN-SPAM Act (USA)</span> — Commercial email requirements</li>
              <li><span className="font-medium text-foreground">CASL (Canada)</span> — Anti-spam legislation</li>
              <li><span className="font-medium text-foreground">GDPR / UK GDPR / ePrivacy (EU/UK)</span> — Data protection and electronic communications regulations, if applicable</li>
              <li><span className="font-medium text-foreground">CCPA and other U.S. state privacy laws</span> — Consumer privacy rights</li>
            </ul>
            <p className="text-muted-foreground mb-3">
              You represent and warrant that you have obtained and will maintain all rights, permissions, consents, notices, opt-ins, suppression records, and lawful bases necessary to upload, process, enrich, contact, and send communications to any Lead Data or other personal information used with the Service. You are solely responsible for determining whether a recipient may lawfully be contacted, whether consent or opt-in is required, and whether any jurisdiction-specific notice or suppression obligation applies. Meridian provides tools; you remain responsible for lawful campaign strategy and execution.
            </p>
            <p className="text-muted-foreground">
              Violation of these laws may result in immediate termination of your account without refund.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Email Deliverability and Sender Responsibility</h2>
            <p className="text-muted-foreground mb-3">
              You are responsible for configuring and maintaining accurate sender identity, domain authentication (SPF, DKIM, DMARC), mailbox permissions, unsubscribe links, suppression lists, and sending practices for any account you connect to the Service.
            </p>
            <p className="text-muted-foreground">
              Meridian does not guarantee inbox placement, deliverability, open rates, reply rates, conversion rates, or avoidance of spam filters, blocklists, throttling, or domain reputation degradation. We may suspend or limit sending under Section 15 (Suspension) if we believe your use may harm deliverability, violate law, trigger complaints, or jeopardize our infrastructure or third-party service relationships.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Third-Party Services</h2>
            <p className="text-muted-foreground mb-3">
              Meridian integrates with Third-Party Services (Apollo.io, OpenAI, Mailgun, Stripe, etc.). You acknowledge that:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground mb-3">
              <li>You must comply with each Third-Party Service's terms of service</li>
              <li>Third-Party Services are not controlled by Meridian, and their data, outputs, availability, pricing, and policies may change at any time</li>
              <li>We are not responsible for Third-Party Service availability or performance</li>
              <li>API rate limits and costs may apply based on usage</li>
              <li>If you connect your own API keys or credentials, you are responsible for all charges, usage, permissions, and compliance obligations associated with them</li>
              <li>We may add, remove, suspend, or replace Third-Party Services where necessary to operate the Service</li>
            </ul>
            <p className="text-muted-foreground">
              You authorize Meridian to transmit Customer Data, Lead Data, prompts, and campaign metadata to Third-Party Services solely as needed to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. AI Outputs</h2>
            <p className="text-muted-foreground mb-3">
              The Service generates lead recommendations, qualification scores, research summaries, campaign copy, and other AI Output using artificial intelligence and automated systems. AI Output may be inaccurate, incomplete, outdated, duplicative, or unsuitable for your intended use.
            </p>
            <p className="text-muted-foreground mb-3">
              You are responsible for reviewing and approving AI Output before relying on it or sending it to a third party. Meridian does not represent or warrant that AI Output is accurate, complete, non-infringing, compliant with law, or appropriate for any particular purpose.
            </p>
            <p className="text-muted-foreground">
              Subject to these Terms, you may use AI Output generated for your account for your internal business and outreach purposes. You acknowledge that similar or identical output may be generated for other customers, since the underlying models are not customer-specific.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Pricing and Payment</h2>
            <div className="space-y-4 text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.1 Subscription Plans</h3>
                <p>Service fees are based on your selected plan and usage tier. Plans may include usage limits, credits, contacts, campaigns, enrichments, AI generations, or other metered features. Unused credits expire at the end of the billing period unless otherwise stated. If you exceed plan limits, we may charge overage fees, require an upgrade, throttle usage, or suspend affected features. You agree to pay all fees on time, provide valid payment information, maintain up-to-date billing details, and accept responsibility for third-party API costs.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.2 Billing Cycle</h3>
                <p>Subscriptions are billed monthly or annually. Payment is due at the beginning of each billing period. Failure to pay may result in service suspension or termination. Downgrades take effect at the next renewal unless otherwise agreed.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.3 Auto-Renewal</h3>
                <p>Before you are charged, we will disclose the subscription price, billing frequency, and renewal terms. By purchasing a subscription, you authorize Meridian and its payment processor to charge your payment method on a recurring basis until you cancel. Your subscription automatically renews at the end of each billing period unless you cancel before the renewal date. You may cancel at any time through your account settings, using substantially the same method used to subscribe. Cancellation takes effect at the end of the then-current billing period unless otherwise required by law.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.4 Payment Processing</h3>
                <p>Payments are processed securely through Stripe. We do not store your full credit card information on our servers.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.5 Refund Policy</h3>
                <p>All fees are non-refundable except as required by law or at our sole discretion. No prorated refunds are issued for mid-cycle cancellations.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.6 Failed Payments</h3>
                <p>If a payment fails, we will retry up to three times. If all attempts fail, your account may be suspended until payment is received.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.7 Price Changes</h3>
                <p>We reserve the right to change pricing with 30 days' advance notice. You may cancel your subscription before the price change takes effect.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.8 Taxes</h3>
                <p>All fees are exclusive of applicable taxes. You are responsible for paying all taxes associated with your purchase.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">10.9 Disputed Charges</h3>
                <p>If you believe you have been incorrectly charged, notify us within 30 days. Chargeback disputes may result in immediate account suspension.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Intellectual Property</h2>
            <p className="text-muted-foreground mb-3">
              Meridian and its original content, features, and functionality are owned by us and protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or reverse engineer any part of the Service. No rights are granted to you except as expressly stated in these Terms.
            </p>
            <p className="text-muted-foreground">
              If you submit feedback, suggestions, or ideas about the Service, you agree that we may use them without restriction or obligation to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Data Ownership and Platform Learning</h2>
            <div className="space-y-4 text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">12.1 Your Data</h3>
                <p>You retain ownership of your company data, lead lists, and email content. By using the Service, you grant us a limited license to process your data to provide the Service. We do not sell your data to third parties.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">12.2 Campaign Outcome Data</h3>
                <p>The Service records the outcome of each email sent through the platform: delivery status, engagement events, replies received, and the context in which the email was sent (such as recipient attributes, send timing, and message characteristics). We retain this outcome data for as long as reasonably necessary to provide the Service, maintain analytics, enforce these Terms, and comply with legal obligations, unless a different retention period is agreed in writing.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">12.3 Platform Improvement and Model Training</h3>
                <p>You agree that Meridian may use campaign and outcome data, in aggregated and De-identified form, to improve the platform and to train and improve the models that power the Service. De-identified, feature-level campaign outcome data (for example, statistical patterns such as which message characteristics correlate with replies for a given audience segment) is pooled across customers and used to improve the models serving all customers. Meridian will not use Customer Data to train third-party foundation models outside the Service unless expressly authorized by you in writing.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">12.4 What Never Crosses Customer Boundaries</h3>
                <p>The following are never shared between customer accounts, never included in pooled model training, and never visible to any other customer: your verbatim email copy, your prospect and lead identities, your research data, and your campaign strategy or configuration. Cross-customer learning operates exclusively on derived, De-identified statistical features. What another customer receives from pooled learning is the equivalent of an aggregate industry benchmark, never your content or contacts.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">12.5 Opt-Out</h3>
                <p>Enterprise customers may opt out of contributing data to pooled learning by written request. Opted-out accounts run on platform-wide model defaults as they existed at the time of opt-out, plus learning from the customer's own data only. Opting out may reduce the quality of model-driven recommendations for your account.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">12.6 Privacy Policy and Data Processing</h3>
                <p>Our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> explains how we collect, use, disclose, and protect personal information, and is incorporated into these Terms. Where Meridian processes personal information on your behalf as a data processor, a separate Data Processing Addendum governs that processing and takes precedence over conflicting terms here for that purpose.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. Confidentiality</h2>
            <p className="text-muted-foreground">
              Each party may receive non-public business, technical, financial, product, customer, pricing, or security information from the other party ("Confidential Information"). The receiving party will use Confidential Information only to perform under these Terms and will protect it using reasonable care, at least as protective as the care it uses for its own similar information. Confidential Information does not include information that is or becomes public through no fault of the receiving party, was independently developed without use of the disclosing party's Confidential Information, or must be disclosed by law (provided the receiving party gives reasonable notice where legally permitted).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">14. Service Changes; Beta Features</h2>
            <p className="text-muted-foreground mb-3">
              We may modify, suspend, discontinue, or replace features of the Service from time to time. We will not materially reduce core paid functionality during a subscription term without reasonable notice, except where required for security, legal compliance, vendor changes, or operational necessity.
            </p>
            <p className="text-muted-foreground">
              Beta, preview, or experimental features are provided "as is," may be modified or discontinued at any time, and may be excluded from support, uptime, or liability commitments that otherwise apply to the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">15. Suspension</h2>
            <p className="text-muted-foreground mb-3">
              We may suspend, limit, or throttle your access to the Service — including email sending, lead enrichment, AI generation, or integrations — if we reasonably believe your use violates these Terms or applicable law, creates legal, security, privacy, deliverability, vendor, or infrastructure risk, may harm recipients or third-party service providers, is fraudulent or abusive, exceeds plan limits, or involves overdue payment.
            </p>
            <p className="text-muted-foreground">
              Where practicable, we will provide notice and an opportunity to cure. We may act immediately without prior notice where we reasonably determine immediate action is necessary to protect the Service, ourselves, recipients, other customers, or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">16. Disclaimers and Limitations</h2>
            <p className="font-semibold text-foreground mb-3">THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground mb-3">
              <li>We do not guarantee specific results, lead quality, or response rates</li>
              <li>AI-generated content may contain errors or inaccuracies</li>
              <li>Email deliverability depends on many factors outside our control</li>
              <li>Third-party service outages may affect platform functionality</li>
              <li>We do not guarantee legal or regulatory compliance of any campaign, message, or AI Output</li>
              <li>We are not liable for damages resulting from use of the Service</li>
            </ul>
            <p className="text-muted-foreground mb-3">
              IN NO EVENT WILL MERIDIAN BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES; LOST PROFITS OR REVENUE; LOSS OF GOODWILL; LOSS OF DATA; BUSINESS INTERRUPTION; OR EMAIL DELIVERABILITY OR DOMAIN REPUTATION HARM.
            </p>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR AGGREGATE LIABILITY WILL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM. THIS LIMIT DOES NOT APPLY TO YOUR PAYMENT OBLIGATIONS, YOUR INDEMNIFICATION OBLIGATIONS, OR YOUR MISUSE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">17. Indemnification</h2>
            <p className="text-muted-foreground mb-3">
              You agree to indemnify, defend, and hold harmless Meridian from any claims, damages, losses, or expenses (including reasonable legal fees) arising from: your use of the Service; your Customer Data or Lead Data; your campaigns and messages; alleged violations of spam, privacy, or consumer-protection law; your use of AI Output without review; your violation of these Terms; unauthorized or unlawful targeting; your breach of a Third-Party Service's terms; use of your own API keys or credentials; or your infringement of any third-party rights.
            </p>
            <p className="text-muted-foreground">
              We will provide you with prompt notice of any such claim and reasonable cooperation, and you may control the defense, provided you may not settle any claim that requires us to admit liability, pay money, or change our business practices without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">18. Termination</h2>
            <p className="text-muted-foreground mb-3">
              We may suspend or terminate your account at any time for violations of these Terms, suspected fraud, or at our discretion. Upon termination:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground mb-3">
              <li>Your access to the Service will cease immediately</li>
              <li>No refunds will be provided for partial billing periods</li>
              <li>You remain liable for any outstanding fees</li>
            </ul>
            <p className="text-muted-foreground">
              For a limited period after termination, we may make your Customer Data available for export upon request, unless your account was terminated for abuse, security risk, legal violation, or nonpayment. After that period, we may delete your data from active systems, subject to backups, legal retention obligations, dispute preservation, and De-identified or aggregated data that has already been incorporated into pooled learning under Section 12.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">19. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email or platform notification. For paid subscriptions, material changes take effect at your next renewal unless a shorter timeline is required for legal, security, or operational reasons. Continued use of the Service after changes take effect indicates acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">20. Governing Law; Dispute Resolution</h2>
            <div className="space-y-4 text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">20.1 Governing Law</h3>
                <p>These Terms are governed by the laws of New York, without regard to conflict of law principles.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">20.2 Arbitration Agreement</h3>
                <p>Except for disputes eligible for small claims court or claims for injunctive relief to protect intellectual property or Confidential Information, any dispute arising out of or relating to these Terms or the Service will be resolved by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules, conducted by a single arbitrator in New York, New York, unless the parties agree otherwise. Judgment on the arbitration award may be entered in any court of competent jurisdiction.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">20.3 Class Action Waiver</h3>
                <p>You and Meridian agree that any arbitration or proceeding will be conducted only on an individual basis and not as a class, consolidated, or representative action. If this waiver is found unenforceable as to a given dispute, the arbitration agreement in Section 20.2 will not apply to that dispute, and it will instead proceed in the courts identified in Section 20.5.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">20.4 Jury Trial Waiver</h3>
                <p>To the maximum extent permitted by law, you and Meridian each waive any right to a jury trial in any proceeding arising out of or relating to these Terms.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">20.5 Opt-Out and Court Venue</h3>
                <p>You may opt out of the arbitration agreement, class action waiver, and jury trial waiver in this Section 20 by sending written notice to legal@getmeridian.ai within 30 days of first accepting these Terms. If you opt out, or in any case where arbitration does not apply, the state and federal courts located in New York County, New York will have exclusive jurisdiction, and each party consents to personal jurisdiction and venue there.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">21. Contact Information</h2>
            <p className="text-muted-foreground mb-3">For questions about these Terms, please contact us at:</p>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium text-foreground">Meridian Legal Team</p>
              <p className="text-muted-foreground">Email: legal@getmeridian.ai</p>
              <p className="text-muted-foreground">Address: 35 S Village Dr, Cazenovia, NY 13035</p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/" className="hover:text-foreground transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
