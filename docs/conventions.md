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

## Frontend (React + TypeScript)

> The legacy vanilla-JS pages under `src/main/resources/static/` are deprecated and being phased out. All new frontend work is in `frontend/` (React + TypeScript + Tailwind v4).

### UX Principles
- Follow mainstream industry patterns — use established UI conventions users already know
- Match the interaction pattern to the weight of the action:
  - **Card view switch** — secondary actions within the same page (e.g. change password)
  - **Modal** — focused tasks on desktop; becomes a **bottom sheet on mobile** (see below)
  - **Bottom sheet** — standard mobile pattern per iOS HIG and Material Design; slide up from bottom, full width, rounded top corners, drag handle via `::before`
  - **Inline** — only for trivial, non-disruptive interactions
- **Mobile modals must always be bottom sheets** — centered modals on small screens are cramped and off-target. Use CSS media query to convert the same element: `align-items: flex-end; padding: 0` on the overlay, full-width + rounded top on the modal.
- Think from the user's perspective before choosing an implementation; if it feels awkward to use, redesign it

### Third-party Libraries
- Always use actively maintained, currently mainstream libraries — do not default to popular-but-outdated options
- Before choosing a library, evaluate: Is it still widely adopted? Is it actively maintained? Does it fit the project style?
- If a better option exists, recommend it proactively — do not wait to be questioned

### Mobile Responsiveness
All frontend features must work comfortably on mobile (phone-sized screens).

**Rules for new features:**
- Tap targets must be at least 44×44px on mobile
- Floating/popup elements must not overflow the screen edge — clamp position on small screens
- Test new UI at 390px width (iPhone 14 viewport) before considering it done

### Design

> All visual design decisions (colors, typography, spacing, shadows, motion,
> components, marketing patterns) are specified in **`docs/design-system.md`**.
> All CSS variables are defined in **`frontend/src/styles/tokens.css`**.
>
> **Rules:**
> - Never hardcode a hex color, shadow, or spacing value in component CSS — always use a `var(--*)` token
> - If a needed color is not in `tokens.css`, define it there first, then reference it
> - All cards must have `border: 1px solid var(--separator)` for dark mode visibility
> - App page CTA / highlighted cards: use `--tint-accent-subtle` (not gradients). Gradients are for marketing/landing pages only
> - Dark mode colors: `--system-*` and `--accent` are intentionally brighter in dark mode — do not darken them. See `design-system.md §14`
> - Animations: use `ease-out` + `translateY` only — no spring (`cubic-bezier(0.34,1.56,0.64,1)`), no `scale()`, no `opacity` changes on enter
> - Refer to `design-system.md` before implementing any new component
> - No emoji in any UI text or code
> - Languages: English and Chinese only

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
