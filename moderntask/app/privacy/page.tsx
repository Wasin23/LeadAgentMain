import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: November 19, 2025</p>
        </div>

        {/* Content card */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-8 space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p className="text-muted-foreground">
              Meridian ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered lead generation and outreach platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <div className="space-y-4 text-muted-foreground">
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">Account Information</h3>
                <p>When you create an account, we collect your username, email address, and encrypted password.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">Company Profile</h3>
                <p>You provide company information including name, industry, services, website, contact details, and marketing materials.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">Lead Data</h3>
                <p>Our platform processes lead information obtained through third-party services, including names, email addresses, companies, and job titles.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">Email Communications</h3>
                <p>We track email opens, clicks, and replies to provide analytics and improve your outreach campaigns.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">Usage Data</h3>
                <p>We collect information about how you interact with our platform, including API usage, feature engagement, and performance metrics.</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">Payment Information</h3>
                <p>When you subscribe, we collect billing information including your name, billing address, and payment method details. Credit card information is processed and stored securely by Stripe and is not stored on our servers. We retain transaction history, invoice details, and subscription status for accounting and legal compliance.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>Provide and maintain our AI-powered lead research and email automation services</li>
              <li>Generate personalized email content using GPT-4</li>
              <li>Search for and qualify leads based on your targeting criteria</li>
              <li>Track email engagement and provide analytics</li>
              <li>Process payments, manage your subscription, and send billing notifications</li>
              <li>Generate invoices and maintain transaction records for tax and accounting purposes</li>
              <li>Detect and prevent fraudulent transactions or unauthorized access</li>
              <li>Send important service updates, security notifications, and subscription reminders</li>
              <li>Improve our platform through usage analytics</li>
              <li>Comply with legal obligations including tax reporting and financial regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground mb-3">
              Meridian integrates with the following third-party services, each with its own privacy policy:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li><span className="font-medium text-foreground">OpenAI (GPT-4)</span> - AI-powered email generation and lead qualification</li>
              <li><span className="font-medium text-foreground">Apollo.io</span> - Lead search and contact data enrichment</li>
              <li><span className="font-medium text-foreground">Mailgun</span> - Email delivery and tracking infrastructure</li>
              <li><span className="font-medium text-foreground">Serper</span> - Company research and web search</li>
              <li><span className="font-medium text-foreground">Amazon Web Services (AWS)</span> - Cloud hosting and data storage</li>
              <li><span className="font-medium text-foreground">Zilliz</span> - Vector database for tracking and analytics</li>
              <li><span className="font-medium text-foreground">Stripe</span> - Secure payment processing and subscription management (payment card details are not stored on our servers)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Storage and Security</h2>
            <p className="text-muted-foreground">
              Your data is stored securely using AWS DynamoDB and Zilliz cloud databases with encryption at rest and in transit. We implement industry-standard security measures including JWT authentication, HTTPS encryption, and regular security audits. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time through your account settings. Some data may be retained for legal or legitimate business purposes even after deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Opt-out of marketing communications</li>
              <li>Object to automated decision-making</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. CAN-SPAM Compliance</h2>
            <p className="text-muted-foreground mb-3">All emails sent through Meridian include:</p>
            <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground">
              <li>Accurate sender information</li>
              <li>Clear subject lines</li>
              <li>Your physical business address</li>
              <li>An unsubscribe link</li>
              <li>Prompt processing of opt-out requests (within 10 business days)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              We use cookies and similar tracking technologies to maintain your session, remember preferences, and analyze platform usage. Email tracking pixels are embedded in outbound emails to track opens and engagement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or through a prominent notice on our platform. Continued use of Meridian after changes indicates acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground mb-3">
              If you have questions about this Privacy Policy or how we handle your data, please contact us at:
            </p>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium text-foreground">Meridian Privacy Team</p>
              <p className="text-muted-foreground">Email: coltonfidelman@g.ucla.edu</p>
              <p className="text-muted-foreground">Address: 35 S Village Dr, 13035, NY</p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
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
