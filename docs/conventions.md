# Conventions

## Backend (Java)

### Naming
- Classes: `PascalCase` — `UserService`, `JournalEntry`
- Methods / variables: `camelCase` — `getEntriesByUser`, `userId`
- Constants: `UPPER_SNAKE_CASE` — `EMAIL_PATTERN`
- Database tables / columns: `snake_case` — `journal_entry`, `user_id`
- REST endpoints: `kebab-case` — `/api/forgot-password`, `/api/reset-password`

### Package Structure
```
com.myjourney
├── config/       # Spring configuration beans
├── controller/   # @RestController — HTTP layer only, no business logic
├── service/      # Business logic, validation, orchestration
├── model/        # @Entity JPA classes
├── repository/   # @Repository interfaces (Spring Data JPA)
├── filter/       # Servlet filters (JWT auth)
└── util/         # Stateless helper classes
```

### Controller Rules
- Controllers only handle HTTP concerns: parse request, call service, return response
- No database queries or business logic in controllers
- Return plain strings for simple outcomes, `Map<String, Object>` for structured responses

### Service Rules
- All business logic lives in services
- Validate inputs at the service layer (not just frontend)
- Use `@Transactional` on methods that write to the database

### Error Handling
- Return descriptive plain-text error strings from services (e.g. `"User not found"`)
- Frontend checks response text to determine success/failure

### Security
- Never log passwords or tokens
- Always use `passwordEncoder.encode()` before saving passwords
- Check space membership / ownership in service layer before any write operation

---

## Frontend (JavaScript)

### Naming
- Files: `kebab-case` — `space-utils.js` (or descriptive noun: `api.js`, `layout.js`)
- Functions / variables: `camelCase` — `loadPosts`, `currentPage`
- CSS classes: `kebab-case` — `.post-card`, `.space-header`

### Auth
- JWT token stored as `localStorage.getItem('token')`
- User info: `localStorage.getItem('username')`, `localStorage.getItem('userId')`
- All API calls go through `apiRequest()` or `apiRequestWithFile()` in `api.js` — never use raw `fetch` directly

### State Management
- No global state library — keep state local to each page script
- Images in posts stored in a JS `Map` (not DOM data attributes) to avoid browser performance issues

### Page Script Pattern
Each HTML page has one corresponding JS file. Structure:
```js
// 1. Init (runs on DOMContentLoaded)
// 2. Load data from API
// 3. Render to DOM
// 4. Attach event listeners
```

### UX Principles
- Follow mainstream industry patterns — use established UI conventions users already know
- Match the interaction pattern to the weight of the action:
  - **Card view switch** — secondary actions within the same page (e.g. change password)
  - **Modal** — focused tasks that need isolation from the current context (e.g. create/edit/confirm)
  - **Inline** — only for trivial, non-disruptive interactions
- Think from the user's perspective before choosing an implementation; if it feels awkward to use, redesign it

### Third-party Libraries
- Always use actively maintained, currently mainstream libraries — do not default to popular-but-outdated options
- Before choosing a library, evaluate: Is it still widely adopted? Is it actively maintained? Does it fit the project style?
- Preferred libraries for this project:
  - Rich text editor: **Trix** (used by Basecamp/HEY — minimal, modern, CDN-ready)
  - Calendar: **FullCalendar 6** (already in use)
  - HTTP: native `fetch` via `api.js` wrapper (no axios needed at this scale)
- If a better option exists, recommend it proactively — do not wait to be questioned

### Mobile Responsiveness
All frontend features must work comfortably on mobile (phone-sized screens).

**Breakpoints (defined in `ui.css`):**
- `≤ 1024px` — sidebar collapses to off-canvas drawer, toggle button appears
- `≤ 768px` — single-column layout, stacked form fields
- `≤ 480px` — sidebar goes full-width, tighter padding

**Rules for new features:**
- Every new CSS component must include a `@media (max-width: 768px)` block if it uses fixed widths, multi-column layout, or absolute positioning
- Tap targets must be at least 44×44px on mobile
- Floating/popup elements (e.g. reaction picker) must not overflow the screen edge — use `left: 0` or clamp position on small screens
- Test new UI at 390px width (iPhone 14 viewport) before considering it done

---

## Frontend (Phase 6 — React + TypeScript)

### Design

Follow Apple Human Interface Guidelines (HIG). No emoji in any UI text or code.

#### Typography
- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`
- Renders as SF Pro on Apple devices; falls back to Helvetica Neue elsewhere — do not load a web font
- Type scale (desktop → scales down at ≤1068px and ≤735px):

| Style | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|
| Display / Hero | `64px` | `700` | `1.05` | `-0.025em` |
| Large Title | `48px` | `600` | `1.08` | `-0.020em` |
| Title 1 | `40px` | `600` | `1.10` | `0em` |
| Title 2 | `32px` | `600` | `1.13` | `0em` |
| Title 3 | `24px` | `600` | `1.20` | `0em` |
| Headline | `17px` | `600` | `1.29` | `0em` |
| Body | `17px` | `400` | `1.47` | `0em` |
| Callout | `15px` | `400` | `1.40` | `0em` |
| Subhead | `15px` | `600` | `1.33` | `0em` |
| Footnote / Caption | `12–13px` | `400` | `1.23` | `0em` |
| Eyebrow label | `12px` | `600` | — | `+0.08em` uppercase |

- Eyebrow labels (small section labels above headings): `12px`, `600`, `letter-spacing: 0.08em`, `text-transform: uppercase`, color `var(--label-tertiary)`
- No pure black text — use `#1d1d1f` (light) / `#f5f5f7` (dark) for primary labels

#### Color Tokens

| Token | Light | Dark |
|---|---|---|
| `--surface-primary` | `#ffffff` | `#000000` |
| `--surface-secondary` | `#f5f5f7` | `#1c1c1e` |
| `--surface-tertiary` | `#e8e8ed` | `#2c2c2e` |
| `--surface-card` | `#ffffff` | `#1c1c1e` |
| `--label-primary` | `#1d1d1f` | `#f5f5f7` |
| `--label-secondary` | `rgba(0,0,0,0.56)` | `rgba(255,255,255,0.56)` |
| `--label-tertiary` | `rgba(0,0,0,0.36)` | `rgba(255,255,255,0.36)` |
| `--accent` (blue) | `#0071e3` | `#2997ff` |
| `--accent-hover` | `#0077ed` | `#0a84ff` |
| `--separator` | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.12)` |
| `--nav-bg` | `rgba(255,255,255,0.82)` | `rgba(28,28,30,0.82)` |

System accent palette (use sparingly for status/mood indicators):

| Name | Light | Dark |
|---|---|---|
| Green | `#34c759` | `#30d158` |
| Red | `#ff3b30` | `#ff453a` |
| Orange | `#ff9500` | `#ff9f0a` |
| Purple | `#af52de` | `#bf5af2` |
| Indigo | `#5856d6` | `#5e5ce6` |

#### Spacing & Layout
- 8pt grid — all spacing values are multiples of 4px; Tailwind's default scale satisfies this
- Max content width: `980px` standard, `1100px` wide, `692px` text-only sections
- Section vertical padding: `100px` desktop, `60px` tablet, `40px` mobile
- Page horizontal gutter: `24px` desktop, `20px` mobile (`padding-inline`)

#### Border Radius

| Context | Value |
|---|---|
| Input fields | `8px` |
| Small cards, tags | `10–12px` |
| Standard cards | `18px` |
| Large / hero cards | `22–30px` |
| Buttons (pill) | `980px` |
| Avatar | `50%` |

#### Shadows
- Flat cards on secondary background (`#f5f5f7`) use no shadow — color contrast is enough
- Elevated cards (white on white): `0 2px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)`
- Dark mode elevated: `0 2px 16px rgba(0,0,0,0.40), 0 1px 3px rgba(0,0,0,0.20)`
- Floating elements (FAB, modal): `0 4px 24px rgba(0,0,0,0.12)`

#### Navigation Bar
- Height: `52px`; `position: sticky; top: 0; z-index: 100`
- Background: `var(--nav-bg)` + `backdrop-filter: saturate(180%) blur(20px)`
- Bottom border: `1px solid var(--separator)`
- Font: `14px`, weight `400`; hover state is `opacity: 0.8` (no underline)
- Mobile: collapses to hamburger + full-screen slide-in drawer

#### Buttons

| Variant | Style |
|---|---|
| Primary CTA | `background: var(--accent)`, white text, `border-radius: 980px`, `padding: 12–14px 22–28px` |
| Secondary / ghost | `background: var(--surface-secondary)`, border `1px solid var(--separator)`, pill shape |
| Text link | Plain colored text `var(--accent)`, no border/background — used for "Learn more" style CTAs |
| Destructive | `background: var(--red)` |

- Active state: `transform: scale(0.97)` on press
- Never use two filled buttons side-by-side — pair a filled primary with a text/ghost secondary

#### Motion
- Micro-interactions (hover, toggle): `200ms ease`
- Modals / drawers: spring-style enter (`cubic-bezier(0.34, 1.56, 0.64, 1)`), `250ms`
- Exit / dismiss: `180ms ease-in`
- Never animate `color` or `background-color` on the entire `body` — only on specific elements

#### Glassmorphism (nav, overlays)
```css
background: var(--nav-bg); /* rgba with alpha */
backdrop-filter: saturate(180%) blur(20px);
-webkit-backdrop-filter: saturate(180%) blur(20px);
```

#### Dark / Light Mode
- Light and dark mode both required from day one
- Use Tailwind `dark:` variants for all color-sensitive classes
- Theme follows `prefers-color-scheme` by default; user can override via a toggle, preference stored in `localStorage` as `"theme": "light" | "dark"`
- Never use hard-coded hex colors in components — always reference a CSS custom property or Tailwind token

#### Legal & Branding
- Product name: **MyJourney**
- Domain: `myjourneycloud.com`
- Copyright: `Copyright © 2026 Ben X. All rights reserved.`
- Footer must appear on every page with links to Privacy Policy (`/privacy`) and Terms of Service (`/terms`)

### Naming
- Components: `PascalCase` — `JournalCard`, `SpaceHeader`
- Hooks: `camelCase` prefixed with `use` — `useAuth`, `useEntries`
- Types / interfaces: `PascalCase` — `JournalEntry`, `SpacePost`
- Files: `PascalCase` for components (`JournalCard.tsx`), `camelCase` for hooks/utils (`useAuth.ts`)
- CSS classes: `kebab-case` via Tailwind utilities; custom classes stay `kebab-case`

### TypeScript
- Define types for all API responses in `src/types/api.ts`
- Prefer `interface` for object shapes, `type` for unions and aliases
- Avoid `any`; use `unknown` when the type is genuinely unknown, then narrow it
- Mark optional fields with `?`, nullable fields with `T | null`

### State Management
- React Context for global auth state (`userId`, `username`, `avatar`, `token`)
- Local `useState` / `useReducer` for component-level state
- Zustand if Context + prop drilling becomes unwieldy across many components

### API Layer
- All API calls go through a typed wrapper in `src/api/` — never call `fetch` directly in components
- Mirror the existing `apiRequest` / `apiRequestWithFile` pattern with TypeScript generics

### Component Structure
```
src/
  components/   # shared UI components
  pages/        # one component per route (Journal, Spaces, SpaceDetail, Profile, Login)
  hooks/        # custom React hooks
  api/          # typed fetch wrappers
  types/        # shared TypeScript interfaces
  context/      # React Context providers
```

---

## Git

### Commit Messages
- Imperative mood, concise: `Add email validation on registration`
- No trailing period
- No `Co-Authored-By` lines

### Branch Strategy
- `main` is the production branch
- Feature work done directly on `main` for now (small team)

---

## Environment & Secrets

- All secrets in `application.properties` (gitignored)
- Use `${ENV_VAR:default}` pattern in properties — environment variable takes precedence, default used locally
- Never hardcode secrets in Java source files

### Adding a new environment variable (3 files required)

When introducing a new external service key or config value, **all three files must be updated together**:

1. `src/main/resources/application-docker.properties` — `key=${ENV_VAR_NAME:}`
2. `docker-compose.yml` — add `ENV_VAR_NAME: ${ENV_VAR_NAME}` under `app.environment`
3. Server `.env` file — `ENV_VAR_NAME=actual_value`

> docker-compose does **not** automatically pass all `.env` variables into containers — each one must be explicitly declared in `docker-compose.yml`.

### Required environment variables for production
  - `JWT_SECRET`
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `RESEND_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `MYSQL_ROOT_PASSWORD`
