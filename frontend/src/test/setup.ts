// Vitest setup file. Loaded before every test via `setupFiles` in
// vite.config.ts. Adds @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveTextContent, etc.) so tests can assert against rendered DOM.

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees and clear localStorage between tests so state doesn't
// leak across cases (jsdom keeps the document and localStorage alive for the
// whole test run by default).
afterEach(() => {
  cleanup()
  localStorage.clear()
})
