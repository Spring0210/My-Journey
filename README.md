```markdown
# Journey — Personal Digital Journal

[![Java](https://img.shields.io/badge/Java-17%2B-ED8B00.svg?logo=openjdk&logoColor=white)](#)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F.svg?logo=springboot&logoColor=white)](#)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1.svg?logo=mysql&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](#)

A clean, minimal **digital journal** built with **Spring Boot + MySQL + Vanilla HTML/CSS/JS**.  
Write entries, upload images, search, browse by **calendar**, and open a **unified detail page** for editing.

> Goal: ship a **modern**, **polished**, and **deployable** personal journaling site.

---

## ✨ Features

- **Auth**
  - Login (simple session-like flow via API response)  
  - Register  
  - Forgot password (reset form, token flow WIP)
- **Journals**
  - Create / Edit / Delete entries
  - Image upload (local storage; cloud-ready)
  - Search by **keyword** and/or **date**
  - Pagination-ready service layer (planned)
- **Calendar**
  - Month view via **FullCalendar**
  - Click a day → navigate to **day list page**
  - Click an event/title → **detail page**
- **Detail Page**
  - View & edit title/content/date
  - Replace image
  - Delete entry

---

## 🧱 Tech Stack

**Backend**
- Java 17+  
- Spring Boot 3.x (Web, Data JPA)  
- MySQL 8.x  
- HikariCP, Hibernate

**Frontend**
- Vanilla HTML / CSS / JavaScript  
- FullCalendar (CDN)  
- Progressive refactors planned (Tailwind/Componentization)

---

## 📦 Project Structure

```

my-journey/
├─ backend/
│  ├─ src/main/java/com/myjourney/
│  │  ├─ controller/           # REST controllers
│  │  ├─ model/                # JPA entities (User, JournalEntry)
│  │  ├─ repository/           # Spring Data JPA repositories
│  │  ├─ service/              # Business logic
│  │  └─ MyJourneyApplication.java
│  └─ src/main/resources/
│     ├─ static/               # Deployed frontend (HTML/CSS/JS/images)
│     └─ application.properties (or application.yml)
│
├─ frontend/                   # During development (served by VSCode Live Server or similar)
│  ├─ login.html
│  ├─ journals.html
│  ├─ calendar.html
│  ├─ day.html                 # day view list (clicked from calendar)
│  ├─ detail.html
│  ├─ css/
│  │  ├─ journals.css
│  │  ├─ calendar.css
│  │  ├─ day.css
│  │  └─ detail.css
│  └─ js/
│     ├─ login.js
│     ├─ journals.js
│     ├─ calendar.js
│     ├─ day.js
│     └─ detail.js
│
└─ README.md

````

> For production you can copy `frontend` files into `backend/src/main/resources/static/` and serve everything from Spring Boot.

---

## 🚀 Getting Started (Local)

### 1) Clone
```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
````

### 2) MySQL

Create a database:

```sql
CREATE DATABASE journey_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3) Configuration

**application.properties**

```properties
spring.application.name=my-journey

spring.datasource.url=jdbc:mysql://localhost:3306/journey_db?useSSL=false&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=YOUR_PASSWORD
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true

# Serve local uploads (ensure this folder exists at runtime)
spring.web.resources.static-locations=classpath:/static/,file:uploads/
```

> If you use VSCode Live Server (e.g. [http://127.0.0.1:5500](http://127.0.0.1:5500)) for the frontend, backend images must be referenced with `http://localhost:8080/uploads/...`.

### 4) Run Backend

```bash
cd backend
./mvnw spring-boot:run
```

Backend runs at `http://localhost:8080`.

### 5) Run Frontend

* **Option A (simple)**: open `frontend/journals.html` directly in your browser.
* **Option B (recommended during dev)**: use VSCode **Live Server** (or any static server) to serve `frontend/`.

    * Example: `http://127.0.0.1:5500/frontend/journals.html`

> CORS is opened via `@CrossOrigin` on controllers for local dev. Lock it down for production.

---

## 🔌 API Quick Reference

> **Auth**

* `POST /api/register`
  **body**: `{ "username": "alice", "password": "secret" }`
  **resp**: `"Registration successful"` or `"Username already exists"`

* `POST /api/login`
  **body**: `{ "username": "alice", "password": "secret" }`
  **resp**: `{ "message": "Login successful", "userId": 1, "username": "alice" }`

> **Entries**

* `GET /api/entries/{userId}` — list entries by user
* `POST /api/entries/{userId}` — **create** entry (multipart form: `title`, `content`, `entryDate`, `image?`)
* `POST /api/entries/edit/{entryId}` — **update** entry (multipart form)
* `DELETE /api/entries/{entryId}` — delete entry
* `GET /api/entries/entry/{entryId}` — get single entry by ID (avoid path conflicts)
* `GET /api/entries/search?userId=1&keyword=foo&date=2025-08-10` — search
* `GET /api/entries/user/{userId}/entries/date/{date}` — list entries on a specific day

> **Typical flow**

* Journals list → `GET /api/entries/{userId}`
* Calendar view → render events from above; on date click go to `day.html?date=YYYY-MM-DD`
* Day list → `GET /api/entries/user/{userId}/entries/date/{date}`
* Detail page → `GET /api/entries/entry/{entryId}`; edit via `POST /api/entries/edit/{entryId}`

---

## 🖼 Screenshots (Optional)

> Add a few images/GIFs in `/frontend/assets/` and reference them here.

* Journals list
  `![Journals](frontend/assets/journals.png)`
* Calendar view
  `![Calendar](frontend/assets/calendar.png)`
* Entry detail
  `![Detail](frontend/assets/detail.png)`

---

## 🧪 Testing with Postman (Dev Workflow)

1. **Auth**: call `/api/register` then `/api/login`, capture `userId`.
2. **Create**: `POST /api/entries/{userId}` (form-data: title, content, entryDate, image?).
3. **List**: `GET /api/entries/{userId}`.
4. **Search**: `GET /api/entries/search?userId=...&keyword=...&date=...`.
5. **Detail**: `GET /api/entries/entry/{entryId}`.
6. **Edit**: `POST /api/entries/edit/{entryId}` (form-data).
7. **Delete**: `DELETE /api/entries/{entryId}`.

> Tip: Save a Postman **Collection** and **Environment** (`{{baseUrl}}`) for quick iteration.

---

## 🛠 Troubleshooting

* **`Failed to determine a suitable driver class`**
  Ensure MySQL driver dep is present and `spring.datasource.*` is correct.

* **Tables not created**
  Check `spring.jpa.hibernate.ddl-auto=update`, database name, and permissions.

* **Image not showing from frontend dev server (5500)**
  Use absolute URLs: `http://localhost:8080/uploads/...` and ensure
  `spring.web.resources.static-locations=classpath:/static/,file:uploads/`.

* **404/405 on detail fetch**
  Use `GET /api/entries/entry/{entryId}` to avoid `{userId}` vs `{entryId}` path collision.

* **CORS errors**
  Add `@CrossOrigin` on controllers for local dev; restrict origins for production.

---

## 🗺 Roadmap

* Auth hardening: **JWT** + refresh tokens
* Forgot password: **email-based token** flow
* Image storage: **Cloudinary / S3** with CDN
* Rich text / Markdown editor
* Tags, filters, pagination, analytics
* UI polish with Tailwind + components
* CI/CD (GitHub Actions) + deployment (Render/Railway + Netlify/Vercel)
* PWA: offline & “Add to Home Screen”

---

## 🤝 Contributing

PRs and issues are welcome. Please open an issue to discuss major changes.

---

## 📝 License

Licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

