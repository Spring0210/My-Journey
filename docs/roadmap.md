# Roadmap

## Phase 1 — Shared Spaces MVP ✅ Complete

### Backend
- [x] Space entity and database table
- [x] SpaceMember entity (membership + roles: OWNER / MEMBER)
- [x] Invite code generation (8-char alphanumeric, SecureRandom)
- [x] Space CRUD API (create / read / update / delete)
- [x] Member management API (join via invite code, leave, delete space)
- [x] SpacePost entity with text + multi-image support
- [x] SpacePost CRUD API (create, paginated read, delete)
- [x] Role-based access control (owner-only operations)

### Frontend
- [x] Spaces list page (spaces.html)
- [x] Create space modal
- [x] Join space via invite code modal
- [x] Space detail page with post timeline (space.html)
- [x] Post composer (text + image upload)
- [x] Invite code display
- [x] Edit space info (owner only)
- [x] Leave / delete space actions
- [x] Image lightbox with navigation
- [x] Post image stored in JS Map (prevents browser freeze)

### Auth & Account
- [x] JWT authentication (24h expiration, subject = userId)
- [x] Login via username or email
- [x] Email uniqueness enforced on registration
- [x] Email format validation on registration (frontend + backend)
- [x] Password reset via email verification code (Resend + myjourneycloud.com)
- [x] User avatar support (Cloudinary, `my-journey/avatars/`)
- [x] Profile page — change username and avatar
- [x] Sidebar extracted to layout.js (single source of truth for all pages)

---

## Phase 2 — Experience Polish

### Social Features
- [ ] Member avatar / display name support
- [x] Post reactions (like / emoji)
- [x] Comments on space posts
- [ ] In-app notifications for new posts in joined spaces

### Spaces Improvements
- [ ] Space cover image upload
- [ ] Space permission tiers (read-only member vs posting member)
- [ ] Kick member from space (owner only)
- [ ] Space search / discovery (public spaces)

### Journal Improvements
- [ ] Rich text editor for journal entries (bold, italic, lists)
- [ ] Tag / mood system for entries
- [ ] Export entries as PDF

### Account
- [x] User profile page (avatar, username)
- [ ] Change password from settings
- [ ] Bio / display name field

---

## Phase 3 — Video Support

- [ ] Cloudinary video upload integration
- [ ] Video player component in space posts and journal entries
- [ ] Upload progress bar for large files
- [ ] Video thumbnail generation

---

## Phase 4 — AI Features

- [ ] Integrate Claude API (`claude-sonnet-4-6`)
- [ ] Auto-generate text summary of a space (trip recap, monthly recap)
- [ ] AI-generated journal prompts based on entry history
- [ ] Auto-generate short video from images + text (slideshow with captions)
- [ ] Smart search: natural language query over journal entries
