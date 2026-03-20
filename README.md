# My Journey - Personal Journal Application

A full-stack journaling application with collaborative spaces, built with Java Spring Boot and vanilla JavaScript.

## Features

### Authentication & Security
- JWT-based stateless authentication (24-hour token expiration)
- BCrypt password hashing
- Password reset via email verification code (6-digit code, 10-minute expiration)
- Role-based access control for spaces (Owner / Member)

### Journal Management
- Create, edit, and delete dated journal entries
- Multiple image uploads per entry (stored on Cloudinary)
- Add or remove individual images from existing entries
- Search entries by keyword or date
- Paginated entry list (10 per page)

### Calendar & Navigation
- Monthly calendar view with FullCalendar — dates with entries are highlighted
- Click a date to view all entries for that day
- Dashboard with stats: total entries, this month, total images, day streak

### Shared Spaces
- Create a shared space and invite others via an 8-character invite code
- Join any space with an invite code
- Post content with multiple images to a shared timeline (newest first, 20 per page)
- Space owners can edit space info, delete the space, or remove posts
- Members can leave spaces; authors can delete their own posts
- Image lightbox viewer with navigation

### UI / UX
- Responsive design for all screen sizes
- Light / dark theme toggle, persisted in localStorage
- Sidebar navigation with active page highlighting

## Technology Stack

### Backend
- **Java 21** + **Spring Boot 3.4.5**
- **Spring Security** — JWT authentication filter
- **Spring Data JPA** + **Hibernate** — ORM with MySQL
- **JJWT 0.11.5** — JWT token generation and validation
- **Cloudinary** — Cloud image storage
- **Spring Mail** — Gmail SMTP for password reset emails
- **Lombok** — Boilerplate reduction
- **Maven** — Build and dependency management

### Frontend
- Vanilla **HTML5 / CSS3 / JavaScript** (no frameworks)
- **FullCalendar 6.1.8** — Calendar component
- **Fetch API** — HTTP requests with JWT header injection
- **localStorage** — Token, theme, and user info persistence

### Infrastructure
- **MySQL 8.0** — Relational database
- **Docker + Docker Compose** — Containerized deployment

## Project Structure

```
my-journey/
├── src/main/java/com/myjourney/
│   ├── config/          # Security, Cloudinary, Web MVC config
│   ├── controller/      # UserController, JournalController, SpaceController, SpacePostController
│   ├── model/           # User, JournalEntry, Space, SpaceMember, SpacePost, PasswordResetToken
│   ├── repository/      # JPA repositories for each entity
│   ├── service/         # UserService, JournalService, SpaceService, SpacePostService, CloudStorageService
│   ├── filter/          # JwtAuthenticationFilter
│   └── util/            # JwtUtil
├── src/main/resources/
│   ├── static/
│   │   ├── css/         # ui.css, auth.css, journals.css, spaces.css, detail.css ...
│   │   ├── js/          # api.js, layout.js, dashboard.js, journals.js, detail.js, space.js ...
│   │   └── *.html       # login, register, forgot-password, dashboard, journals, calendar, day, detail, spaces, space
│   ├── application.properties
│   └── application-docker.properties
├── database/
│   └── schema.sql
├── Dockerfile
└── docker-compose.yml
```

## API Endpoints

### Authentication (Public)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/register` | Register new user |
| POST | `/api/login` | Login, returns JWT token |
| POST | `/api/forgot-password` | Send 6-digit reset code to email |
| POST | `/api/reset-password` | Verify code and set new password |

### Journal Entries (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/entries/{userId}` | Create entry with optional images |
| GET | `/api/entries/{userId}` | Get paginated entries (10/page) |
| POST | `/api/entries/edit/{entryId}` | Update entry |
| DELETE | `/api/entries/{entryId}` | Delete entry and its images |
| GET | `/api/entries/search` | Search by keyword or date |
| GET | `/api/entries/entry/{entryId}` | Get single entry |
| GET | `/api/entries/calendar/{userId}` | Get all entries for calendar |
| GET | `/api/entries/user/{userId}/entries/date/{entryDate}` | Get entries for a specific date |
| POST | `/api/entries/add-images/{entryId}` | Add images to existing entry |
| POST | `/api/entries/delete-image` | Remove a single image from entry |

### Spaces (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/spaces` | Create space |
| POST | `/api/spaces/join` | Join space via invite code |
| GET | `/api/spaces` | List user's spaces |
| GET | `/api/spaces/{spaceId}` | Get space detail with members |
| PUT | `/api/spaces/{spaceId}` | Update space info (owner only) |
| POST | `/api/spaces/{spaceId}/leave` | Leave space |
| DELETE | `/api/spaces/{spaceId}` | Delete space (owner only) |
| POST | `/api/spaces/{spaceId}/posts` | Create post with optional images |
| GET | `/api/spaces/{spaceId}/posts` | Get paginated posts (20/page) |
| DELETE | `/api/spaces/{spaceId}/posts/{postId}` | Delete post (author or owner) |

## Getting Started

### Prerequisites
- Java 21+
- Maven 3.6+
- MySQL 8.0+

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Spring0210/My-Journey.git
   cd My-Journey
   ```

2. **Create the database**
   ```bash
   mysql -u root -p < database/schema.sql
   ```

3. **Set environment variables**
   ```bash
   export JWT_SECRET=your_jwt_secret
   export CLOUDINARY_CLOUD_NAME=your_cloud_name
   export CLOUDINARY_API_KEY=your_api_key
   export CLOUDINARY_API_SECRET=your_api_secret
   export GMAIL_USERNAME=your_gmail_address
   export GMAIL_APP_PASSWORD=your_gmail_app_password
   export SPRING_DATASOURCE_PASSWORD=your_db_password
   ```

4. **Run the application**
   ```bash
   mvn spring-boot:run
   ```

5. **Open** `http://localhost:8080`

### Docker Deployment

1. **Create `.env` file**
   ```env
   MYSQL_ROOT_PASSWORD=yourpassword
   JWT_SECRET=your_jwt_secret
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   GMAIL_USERNAME=your_gmail_address
   GMAIL_APP_PASSWORD=your_gmail_app_password
   ```

2. **Build and start**
   ```bash
   docker-compose up -d --build
   ```

3. **Open** `http://your-server-ip:8080`

**Useful commands:**
```bash
docker-compose logs -f app   # View app logs
docker-compose down          # Stop all services
docker-compose up -d         # Restart without rebuilding
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `user` | User accounts (id, username, password, email) |
| `journal_entry` | Journal entries with comma-separated image URLs |
| `space` | Shared spaces with unique invite codes |
| `space_member` | User-space membership with OWNER / MEMBER roles |
| `space_post` | Posts in spaces with comma-separated image URLs |
| `password_reset_token` | Temporary codes for password reset |

## License

MIT License
