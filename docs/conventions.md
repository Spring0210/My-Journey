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
