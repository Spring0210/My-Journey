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
- Required environment variables for production:
  - `JWT_SECRET`
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `RESEND_API_KEY`
  - `SPRING_DATASOURCE_PASSWORD`
