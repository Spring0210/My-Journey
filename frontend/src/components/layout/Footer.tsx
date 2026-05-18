import { NavLink } from 'react-router-dom'
import './Footer.css'

// Footer — shown on all public pages.
// Styles live in Footer.css.

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-copy">
          Copyright &copy; 2026 Ben X. All rights reserved.
        </span>
        <nav aria-label="Legal">
          <ul className="footer-links">
            <li><NavLink to="/privacy" className="footer-link">Privacy Policy</NavLink></li>
            <li><NavLink to="/terms"   className="footer-link">Terms of Service</NavLink></li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
