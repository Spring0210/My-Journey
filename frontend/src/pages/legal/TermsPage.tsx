import { NavLink } from 'react-router-dom'
import './Legal.css'

export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="legal-inner">
        <NavLink to="/" className="legal-back">&#8592; Back to home</NavLink>

        <p className="legal-eyebrow">Legal</p>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: May 7, 2026</p>
        <hr className="legal-divider" />

        <div className="legal-body">
          <h2>Agreement</h2>
          <p>
            By accessing or using MyJourney at myjourneycloud.com ("Service"), you agree to be bound
            by these Terms of Service. If you do not agree to these terms, do not use the Service.
          </p>

          <h2>Your Account</h2>
          <ul>
            <li>You must be at least 13 years old to create an account.</li>
            <li>You are responsible for maintaining the security of your account and password.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must provide a valid email address and keep it up to date.</li>
            <li>One person may not maintain more than one free account.</li>
          </ul>

          <h2>Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Post or share content that is illegal, harmful, threatening, abusive, or harassing.</li>
            <li>Impersonate any person or entity.</li>
            <li>Upload malware, viruses, or any other malicious code.</li>
            <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure.</li>
            <li>Use automated tools to scrape, crawl, or extract data from the Service.</li>
            <li>Violate any applicable laws or regulations.</li>
          </ul>

          <h2>Your Content</h2>
          <p>
            You retain ownership of the content you create on MyJourney — your journal entries,
            posts, and uploaded media. By posting content, you grant us a limited license to store,
            display, and process it solely to provide the Service to you.
          </p>
          <p>
            You are solely responsible for your content. We do not review private journal entries.
            Content in shared spaces is visible to other space members.
          </p>

          <h2>AI Features</h2>
          <p>
            MyJourney uses AI (powered by Anthropic Claude) for features including writing prompts,
            monthly recaps, and smart search. By using these features, you acknowledge that relevant
            portions of your journal content will be sent to Anthropic's API for processing.
            AI-generated content is provided for personal use and may not always be accurate.
          </p>

          <h2>Shared Spaces</h2>
          <p>
            Shared spaces allow multiple users to post and interact. As a space owner, you are
            responsible for the activity within your space. Space owners may remove members and
            delete content at their discretion.
          </p>

          <h2>Service Availability</h2>
          <p>
            We strive to maintain high availability but do not guarantee uninterrupted access.
            We reserve the right to modify, suspend, or discontinue the Service at any time with
            reasonable notice where possible.
          </p>

          <h2>Termination</h2>
          <p>
            You may delete your account at any time. We reserve the right to suspend or terminate
            accounts that violate these Terms. Upon termination, your right to use the Service
            ceases immediately.
          </p>

          <h2>Disclaimer of Warranties</h2>
          <p>
            The Service is provided "as is" without warranties of any kind, either express or
            implied. We do not warrant that the Service will be error-free or uninterrupted.
          </p>

          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, MyJourney shall not be liable for any indirect,
            incidental, or consequential damages arising out of your use of the Service.
          </p>

          <h2>Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes
            are posted constitutes your acceptance of the revised Terms.
          </p>

          <h2>Contact</h2>
          <p>
            If you have questions about these Terms, please contact us at{' '}
            <a href="mailto:support@myjourneycloud.com">support@myjourneycloud.com</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
