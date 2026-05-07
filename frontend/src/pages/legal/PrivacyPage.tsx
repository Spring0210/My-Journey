import { NavLink } from 'react-router-dom'
import './Legal.css'

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-inner">
        <NavLink to="/" className="legal-back">&#8592; Back to home</NavLink>

        <p className="legal-eyebrow">Legal</p>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: May 7, 2026</p>
        <hr className="legal-divider" />

        <div className="legal-body">
          <h2>Overview</h2>
          <p>
            MyJourney ("we", "us", or "our") operates myjourneycloud.com. This Privacy Policy
            explains what information we collect, how we use it, and your rights regarding your
            personal data. We take your privacy seriously and will never sell your data to third parties.
          </p>

          <h2>Information We Collect</h2>
          <p>We collect the following information when you use MyJourney:</p>
          <ul>
            <li><strong>Account information</strong> — username, email address, and hashed password when you register.</li>
            <li><strong>Google account information</strong> — if you sign in with Google, we receive your Google account ID, email address, display name, and profile picture from Google.</li>
            <li><strong>Journal entries</strong> — the text, images, and videos you write and upload.</li>
            <li><strong>Space activity</strong> — posts, comments, and reactions you create in shared spaces.</li>
            <li><strong>Profile information</strong> — avatar image you upload.</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <ul>
            <li>To provide and operate the MyJourney service.</li>
            <li>To send verification and password reset emails to your registered address.</li>
            <li>To power AI features (writing prompts, monthly recaps, smart search) — your journal content is sent to Anthropic's Claude API for processing. Anthropic does not use your content to train models.</li>
            <li>To display your profile avatar and username to members of shared spaces you belong to.</li>
          </ul>

          <h2>Third-Party Services</h2>
          <p>MyJourney uses the following third-party services to operate:</p>
          <ul>
            <li><strong>Cloudinary</strong> — stores images and videos you upload.</li>
            <li><strong>Resend</strong> — sends transactional emails (verification codes, password resets).</li>
            <li><strong>Anthropic Claude API</strong> — powers AI features. Content sent is not retained for training.</li>
            <li><strong>Google OAuth 2.0</strong> — optional sign-in method. Governed by Google's Privacy Policy.</li>
            <li><strong>DigitalOcean</strong> — hosts the application server and database in the United States.</li>
          </ul>

          <h2>Data Retention</h2>
          <p>
            Your data is retained for as long as your account is active. If you delete your account,
            your personal information and content will be removed from our systems within 30 days,
            except where retention is required by law.
          </p>

          <h2>Data Security</h2>
          <p>
            Passwords are stored as bcrypt hashes and never in plain text. All data in transit is
            encrypted via HTTPS. Access tokens expire after 24 hours. We implement rate limiting
            on sensitive endpoints to prevent abuse.
          </p>

          <h2>Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Export your journal entries at any time.</li>
          </ul>

          <h2>Children's Privacy</h2>
          <p>
            MyJourney is not directed at children under 13. We do not knowingly collect personal
            information from children under 13. If you believe a child has provided us with personal
            information, please contact us so we can remove it.
          </p>

          <h2>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes by updating the "Last updated" date at the top of this page.
          </p>

          <h2>Contact</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:support@myjourneycloud.com">support@myjourneycloud.com</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
