# JOURNEY · Personal Digital Journal

![Java](https://img.shields.io/badge/Java-17%2B-ED8B00?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.x-6DB33F?logo=springboot&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)
![Status](https://img.shields.io/badge/status-alpha-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

A clean, minimal **digital journaling** web app built with **Spring Boot + MySQL + Vanilla HTML/CSS/JS**.  
Create entries, upload images, search, browse by **calendar**, and open a **unified detail page**.

---

## ✨ Highlights

- **Auth**: Register · Login · (Reset Password – basic version)
- **Journals**: Create · Edit · Delete · Image upload (local) · Keyword/Date search
- **Views**: List view · Calendar (FullCalendar) · Day view · Entry detail page
- **DX**: Simple API, Postman-friendly, zero magic

---

## 🗂 Project Layout

```

my-journey
├─ database/
│  └─ schema.sql
├─ src/
│  └─ main/
│     ├─ java/com/myjourney/
│     │  ├─ config/
│     │  │  ├─ SecurityConfig.java
│     │  │  └─ WebConfig.java
│     │  ├─ controller/
│     │  │  ├─ JournalController.java
│     │  │  └─ UserController.java
│     │  ├─ model/
│     │  │  ├─ JournalEntry.java
│     │  │  └─ User.java
│     │  ├─ repository/
│     │  │  ├─ JournalRepository.java
│     │  │  └─ UserRepository.java
│     │  ├─ service/
│     │  │  ├─ JournalService.java
│     │  │  └─ UserService.java
│     │  └─ MyJourneyApplication.java
│     └─ resources/
│        ├─ static/              # HTML/CSS/JS (journals.html, calendar.html, detail.html, etc.)
│        └─ application.properties
├─ uploads/                      # image files saved at runtime
├─ pom.xml
└─ README.md

````

> Frontend pages (HTML/CSS/JS) live under `src/main/resources/static/` and are served directly by Spring Boot.

---

## ⚡ Quick Start

```bash
# 1) clone
git clone https://github.com/<your-username>/my-journey.git
cd my-journey

# 2) create database
# MySQL
CREATE DATABASE journey_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3) configure src/main/resources/application.properties
# -----------------------------------------------
# spring.datasource.url=jdbc:mysql://localhost:3306/journey_db?useSSL=false&serverTimezone=UTC
# spring.datasource.username=root
# spring.datasource.password=YOUR_PASSWORD
# spring.jpa.hibernate.ddl-auto=update
# spring.web.resources.static-locations=classpath:/static/,file:uploads/
# -----------------------------------------------

# 4) run
./mvnw spring-boot:run
# App: http://localhost:8080
# Static pages: http://localhost:8080/journals.html (etc.)
````

---

## 🔌 API (Core)

| Method | Endpoint                                               | Notes                                                       |
| :----: | ------------------------------------------------------ | ----------------------------------------------------------- |
|  POST  | `/api/register`                                        | `{username, password}` → `"Registration successful"`        |
|  POST  | `/api/login`                                           | `{username, password}` → `{message, userId, username}`      |
|   GET  | `/api/entries/{userId}`                                | List entries for user                                       |
|  POST  | `/api/entries/{userId}`                                | **Create** (form-data: `title, content, entryDate, image?`) |
|  POST  | `/api/entries/edit/{entryId}`                          | **Update** (form-data)                                      |
| DELETE | `/api/entries/{entryId}`                               | Delete entry                                                |
|   GET  | `/api/entries/entry/{entryId}`                         | Get single entry (detail page)                              |
|   GET  | `/api/entries/user/{userId}/entries/date/{YYYY-MM-DD}` | Entries on a specific day                                   |
|   GET  | `/api/entries/search?userId=&keyword=&date=`           | Keyword / date search                                       |

> Images are served from `/uploads/...`. When developing with another port (e.g., VSCode Live Server), prepend `http://localhost:8080`.

---

## 🖥 UI Entry Points

* **List**: `/journals.html` – create/search/edit/delete, link to detail
* **Calendar**: `/calendar.html` – monthly view (FullCalendar)
* **Day**: `/day.html?date=YYYY-MM-DD` – entries for a day
* **Detail**: `/detail.html?id={entryId}` – full entry view & edit

---

## 🧪 Dev Tips

* Use **Network** tab (Chrome DevTools) to watch API calls (`200/201/204`, payload, CORS).
* For quick API checks, use **Postman**:

    1. `/api/register` → `/api/login` (store `userId`)
    2. `/api/entries/{userId}` (GET)
    3. `/api/entries/{userId}` (POST form-data to create)
    4. `/api/entries/edit/{entryId}` (POST form-data to update)
    5. `/api/entries/{entryId}` (DELETE)

---

## 🧭 Roadmap

* JWT-based authentication (access/refresh)
* Forgot password with email token flow
* Cloud image storage (S3/Cloudinary) + CDN
* Tags & advanced search; pagination
* Rich text / Markdown editor
* Modern responsive design polish (e.g., Tailwind)
* CI/CD and one-click deploy (Render/Railway + Netlify)
* PWA (offline + installable)

---

## 📝 License

**MIT** — do whatever you want, just include the license.



