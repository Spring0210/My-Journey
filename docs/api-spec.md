# API Specification

Base URL: `http://localhost:8080`

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

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

---

### POST /api/login
Login and receive a JWT token.

**Request**
```json
{
  "username": "ben",
  "password": "secret123"
}
```

**Response** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGci...",
  "username": "ben",
  "userId": 1
}
```

**Error**
```json
{ "error": "Invalid credentials" }
```

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

### DELETE /api/spaces/{spaceId}
Delete a space and all its posts. Owner only.

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

### DELETE /api/spaces/{spaceId}/posts/{postId}
Delete a post. Allowed for the post author or the space owner.
