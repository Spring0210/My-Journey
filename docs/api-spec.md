# API Specification

Base URL: `http://localhost:8080`

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

## Rate Limiting

Enforced via Bucket4j (in-memory, per IP):

| Endpoint | Limit |
|----------|-------|
| `POST /api/login` | 10 requests / min |
| `POST /api/register` | 5 requests / min |
| `POST /api/forgot-password` | 5 requests / min |
| AI endpoints (`/ai-recap`, `/ai-search`, `/ai-prompts`, `/ai-summary`) | 5 requests / min per user |

---

## Authentication

### POST /api/register
Register a new user.

**Request**
```json
{
  "username": "ben",
  "email": "ben@example.com",
  "password": "secret123"
}
```

**Response** `200 OK`
```
Registration successful
```

**Errors**
- `Username already exists`
- `Invalid email address`
- `Email already in use`

---

### POST /api/login
Login with username or email, receive a JWT token.

**Request**
```json
{
  "identifier": "ben",
  "password": "secret123"
}
```

> `identifier` can be either a username or an email address.

**Response** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGci...",
  "username": "ben",
  "userId": 1,
  "avatar": "https://res.cloudinary.com/..."
}
```

**Error**
```json
{ "error": "Invalid credentials" }
```

---

### POST /api/auth/refresh
Exchange a valid refresh token for a new access token and a rotated refresh token.

**Request**
```json
{ "refreshToken": "uuid-string" }
```

**Response** `200 OK`
```json
{
  "token": "eyJhbGci...",
  "refreshToken": "new-uuid-string",
  "username": "ben",
  "userId": 1,
  "avatar": "https://res.cloudinary.com/..."
}
```

**Errors**
- `401` — token expired or not found

---

### POST /api/auth/logout
Revoke the refresh token (explicit logout). Access token is not invalidated server-side (stateless JWT), so the client should clear localStorage.

**Request**
```json
{ "refreshToken": "uuid-string" }
```

**Response** `200 OK` (always — even if token was already invalid)

---

### POST /api/auth/google
Exchange a Google ID token for a My Journey JWT. Account is linked by email; a new account is created if none exists.

**Request**
```json
{ "idToken": "google-id-token" }
```

**Response** `200 OK` — same shape as `/api/login`

---

### POST /api/forgot-password
Send a 6-digit reset code to the user's registered email.

**Request**
```json
{
  "username": "ben",
  "email": "ben@example.com"
}
```

**Response** `200 OK`
```
Code sent
```

**Errors**
- `User not found`
- `Email does not match`
- `Failed to send email, please try again later`

---

### POST /api/reset-password
Verify the reset code and update the password. Code expires in 10 minutes.

**Request**
```json
{
  "username": "ben",
  "code": "482910",
  "newPassword": "newSecret123"
}
```

**Response** `200 OK`
```
Password reset successful
```

**Errors**
- `Invalid code`
- `Code has expired`
- `User not found`

---

---

### POST /api/change-password/send-code
Send a verification code to the logged-in user's registered email. Requires JWT.

**Response** `200 OK`

---

### PUT /api/change-password
Verify the code and set a new password. Requires JWT.

**Request**
```json
{
  "code": "482910",
  "newPassword": "newSecret123"
}
```

**Response** `200 OK`

**Errors**
- `Invalid code`
- `Code has expired`

---

## Journal Entries

All endpoints require JWT.

### POST /api/entries/{userId}
Create a new journal entry with optional images.

**Content-Type:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| title | String | Yes |
| content | String | No |
| entryDate | String (yyyy-MM-dd) | Yes |
| images | File[] | No |

---

### GET /api/entries/{userId}?page=0&size=10
Get paginated journal entries for a user, sorted by date descending.

**Response** `200 OK`
```json
{
  "content": [
    {
      "id": 1,
      "title": "Day in the park",
      "content": "...",
      "entryDate": "2026-03-19",
      "imagePaths": "https://res.cloudinary.com/...,https://res.cloudinary.com/...",
      "createdAt": "2026-03-19T10:00:00"
    }
  ],
  "totalPages": 3,
  "totalElements": 25,
  "number": 0
}
```

---

### GET /api/entries/entry/{entryId}
Get a single journal entry by ID.

---

### POST /api/entries/edit/{entryId}
Update a journal entry. New images are appended to existing ones.

**Content-Type:** `multipart/form-data`

| Field | Type |
|-------|------|
| title | String |
| content | String |
| entryDate | String (yyyy-MM-dd) |
| images | File[] (optional) |

---

### DELETE /api/entries/{entryId}
Delete a journal entry and all its images from Cloudinary.

---

### GET /api/entries/search?userId={id}&keyword={kw}&date={yyyy-MM-dd}
Search entries by keyword (title/content) or date.

---

### GET /api/entries/calendar/{userId}
Get all entries formatted for FullCalendar.

**Response** `200 OK`
```json
[
  { "title": "Day in the park", "start": "2026-03-19" }
]
```

---

### GET /api/entries/user/{userId}/entries/date/{entryDate}
Get all entries for a specific date (yyyy-MM-dd).

---

### POST /api/entries/ai-recap
Generate a monthly recap of the current user's journal entries. Requires JWT.

**Request**
```json
{ "year": 2026, "month": 3 }
```

**Response** `200 OK`
```json
{ "recap": "March was a reflective month for you..." }
```

**Error**
```json
{ "error": "No entries found for this month" }
```

---

### POST /api/entries/ai-search
Natural language search over journal entries. Requires JWT.

**Request**
```json
{ "query": "find entries about my mom" }
```

**Response** `200 OK`
```json
{
  "keywords": ["mom", "mother", "family"],
  "entries": [ /* matching JournalEntry objects */ ]
}
```

---

### POST /api/entries/ai-prompts
Generate personalized writing prompts based on the user's recent entries. Requires JWT.

**Response** `200 OK`
```json
{ "prompts": ["What would you tell your past self about...", "..."] }
```

**Error**
```json
{ "error": "Write a few journal entries first to get personalized prompts." }
```

---

### POST /api/entries/add-images/{entryId}
Add images to an existing entry.

**Content-Type:** `multipart/form-data`

| Field | Type |
|-------|------|
| images | File[] |

---

### POST /api/entries/delete-image
Remove a single image from an entry and delete it from Cloudinary.

**Request**
```json
{
  "entryId": 1,
  "imageUrl": "https://res.cloudinary.com/..."
}
```

---

## Spaces

All endpoints require JWT.

### POST /api/spaces
Create a new space. The creator becomes the OWNER.

**Request**
```json
{
  "name": "Europe Trip 2026",
  "description": "Our summer adventure"
}
```

**Response** `200 OK` — Returns the created `Space` object.

---

### POST /api/spaces/join
Join a space via invite code.

**Request**
```json
{ "inviteCode": "A1B2C3D4" }
```

---

### GET /api/spaces
Get all spaces the authenticated user belongs to.

---

### GET /api/spaces/{spaceId}
Get space detail including members list. Requires space membership.

---

### PUT /api/spaces/{spaceId}
Update space name and description. Owner only.

**Request**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

---

### POST /api/spaces/{spaceId}/leave
Leave a space. Owners cannot leave (must delete instead).

---

### PUT /api/spaces/{spaceId}/cover
Upload or replace the space cover image. Owner only.

**Content-Type:** `multipart/form-data`

| Field | Type |
|-------|------|
| file | File |

**Response** `200 OK` — Returns updated `Space` object.

---

### DELETE /api/spaces/{spaceId}/members/{memberId}
Kick a member from the space. Owner only. The owner cannot kick themselves.

**Response** `200 OK`

---

### POST /api/spaces/{spaceId}/ai-summary
Generate an AI recap of recent space activity. Available to all members.

**Response** `200 OK`
```json
{ "summary": "This week, the group visited three cities..." }
```

---

### DELETE /api/spaces/{spaceId}
Delete a space and all its posts. Owner only.

---

## User Profile

### PUT /api/profile/{userId}
Update username and/or avatar. Requires JWT.

**Content-Type:** `multipart/form-data`

| Field | Type | Required |
|-------|------|----------|
| username | String | No |
| avatar | File | No |

At least one field must be provided.

**Response** `200 OK`
```json
{
  "message": "Profile updated",
  "username": "newname",
  "avatar": "https://res.cloudinary.com/..."
}
```

**Errors**
- `Username already taken`
- `User not found`

---

## Space Posts

All endpoints require JWT and space membership.

### POST /api/spaces/{spaceId}/posts
Create a post in a space.

**Content-Type:** `multipart/form-data`

| Field | Type |
|-------|------|
| content | String |
| images | File[] (optional) |

---

### GET /api/spaces/{spaceId}/posts?page=0&size=20
Get paginated posts, newest first.

**Response** `200 OK`
```json
{
  "content": [
    {
      "id": 1,
      "content": "We arrived!",
      "imagePaths": "https://res.cloudinary.com/...",
      "username": "ben",
      "createdAt": "2026-03-19T10:00:00Z"
    }
  ],
  "totalPages": 2,
  "number": 0
}
```

---

### PATCH /api/spaces/{spaceId}/posts/{postId}
Edit a post's text content. Author or space owner only.

**Request**
```json
{ "content": "Updated text" }
```

**Response** `200 OK` — Returns updated `PostResponse`.

---

### DELETE /api/spaces/{spaceId}/posts/{postId}
Delete a post. Allowed for the post author or the space owner.

---

### POST /api/spaces/{spaceId}/posts/{postId}/reaction
Add or switch an emoji reaction on a post.

**Request**
```json
{ "emoji": "heart" }
```

**Response** `200 OK`
```json
{
  "counts": { "heart": 3, "fire": 1 },
  "myReaction": "heart"
}
```

---

### DELETE /api/spaces/{spaceId}/posts/{postId}/reaction
Remove the current user's reaction from a post.

**Response** `200 OK` — Returns updated `ReactionSummary`.

---

### POST /api/spaces/{spaceId}/posts/{postId}/comments
Add a comment to a post.

**Request**
```json
{ "content": "Great photo!" }
```

**Response** `200 OK`
```json
{
  "id": 1,
  "content": "Great photo!",
  "username": "ben",
  "createdAt": "2026-04-02T10:00:00Z"
}
```

---

### DELETE /api/spaces/{spaceId}/posts/{postId}/comments/{commentId}
Delete a comment. Author only.

---

## Notifications

All endpoints require JWT.

### GET /api/notifications
Get all notifications for the current user, newest first.

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "type": "NEW_POST",
    "message": "ben posted in Europe Trip",
    "isRead": false,
    "createdAt": "2026-04-02T10:00:00Z",
    "spaceId": 3
  }
]
```

---

### GET /api/notifications/unread-count
Get the number of unread notifications.

**Response** `200 OK`
```json
{ "count": 4 }
```

---

### POST /api/notifications/mark-read
Mark all notifications as read.

**Response** `200 OK`

---

### DELETE /api/notifications/{id}
Delete a single notification.

**Response** `200 OK`

---

### DELETE /api/notifications
Delete all notifications for the current user.

**Response** `200 OK`
