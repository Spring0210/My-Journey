# 📖 My Journey - Personal Journal Application

A modern, full-stack journal application built with Java Spring Boot and vanilla JavaScript, featuring JWT authentication, multiple image uploads, and a beautiful Instagram-style interface.

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** - Secure token-based authentication
- **Password Encryption** - BCrypt password hashing
- **Session Management** - Stateless authentication
- **Protected Routes** - Secure API endpoints

### 📝 Journal Management
- **Create & Edit Entries** - Rich text journal entries
- **Multiple Image Upload** - Upload multiple photos per entry
- **Image Management** - Add, delete, and view images
- **Search & Filter** - Search by keyword or date
- **Calendar View** - Visual calendar with entry indicators

### 🎨 Modern UI/UX
- **Responsive Design** - Works on all devices
- **Instagram-style Layout** - Beautiful image galleries
- **Dark/Light Theme** - Automatic theme detection
- **Sidebar Navigation** - Easy navigation between pages
- **Dashboard** - Statistics and recent entries overview

### 📱 Pages
- **Dashboard** - Overview with statistics and recent entries
- **My Journals** - List view with search and filtering
- **Calendar View** - Monthly calendar with entry indicators
- **Day View** - Entries for a specific day
- **Detail Page** - Full entry details with image management

## 🛠 Technology Stack

### Backend
- **Java 17** - Programming language
- **Spring Boot 3.x** - Application framework
- **Spring Security** - Authentication and authorization
- **Spring Data JPA** - Database abstraction
- **MySQL** - Database
- **JWT** - Token-based authentication
- **Maven** - Dependency management

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5 & CSS3** - Modern web standards
- **Fetch API** - HTTP requests
- **Local Storage** - Client-side data persistence
- **FullCalendar** - Calendar component

### Database
- **MySQL** - Relational database
- **JPA Entities** - Object-relational mapping
- **Foreign Keys** - Data integrity

## 🚀 Getting Started

### Prerequisites
- Java 17 or higher
- Maven 3.6+
- MySQL 8.0+
- Node.js (for development tools)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/my-journey.git
   cd my-journey
   ```

2. **Set up the database**
   ```bash
   # Create MySQL database
   mysql -u root -p < database/schema.sql
   ```

3. **Configure application properties**
   ```properties
   # src/main/resources/application.properties
   spring.datasource.url=jdbc:mysql://localhost:3306/my_journey
   spring.datasource.username=your_username
   spring.datasource.password=your_password
   spring.jpa.hibernate.ddl-auto=update
   ```

4. **Build and run the application**
   ```bash
   mvn clean install
   mvn spring-boot:run
   ```

5. **Access the application**
   - Open your browser and go to `http://localhost:8080`
   - Register a new account or login

## 📁 Project Structure

```
my-journey/
├── src/main/java/com/myjourney/
│   ├── config/          # Configuration classes
│   ├── controller/      # REST controllers
│   ├── model/          # JPA entities
│   ├── repository/     # Data access layer
│   ├── service/        # Business logic
│   ├── util/           # Utility classes
│   └── filter/         # Security filters
├── src/main/resources/
│   ├── static/         # Frontend files
│   │   ├── css/        # Stylesheets
│   │   ├── js/         # JavaScript files
│   │   └── *.html      # HTML pages
│   └── application.properties
├── database/
│   └── schema.sql      # Database schema
└── uploads/            # Image upload directory
```

## 🔧 Configuration

### Environment Variables
```bash
# Database
DB_URL=jdbc:mysql://localhost:3306/my_journey
DB_USERNAME=your_username
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=86400000

# File Upload
UPLOAD_DIR=uploads/
MAX_FILE_SIZE=10MB
```

### CORS Configuration
The application is configured to allow requests from:
- `http://localhost:8080` (development)
- Your production domain (when deployed)

## 📱 API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/reset-password` - Password reset

### Journal Entries
- `GET /api/entries/{userId}` - Get user's entries
- `POST /api/entries/{userId}` - Create new entry
- `PUT /api/entries/edit/{entryId}` - Update entry
- `DELETE /api/entries/{entryId}` - Delete entry
- `GET /api/entries/search` - Search entries
- `GET /api/entries/entry/{entryId}` - Get single entry

### Image Management
- `POST /api/entries/add-images/{entryId}` - Add images to entry
- `POST /api/entries/delete-image` - Delete single image

## 🎨 Customization

### Themes
The application supports automatic theme detection based on system preferences. You can customize colors in `src/main/resources/static/css/ui.css`:

```css
:root {
  --primary: #3b82f6;
  --primary-2: #1d4ed8;
  --secondary: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --text: #1e293b;
  --text-muted: #64748b;
  --background: #ffffff;
  --card: #ffffff;
  --border: #e2e8f0;
}
```

### Image Storage
By default, images are stored locally in the `uploads/` directory. For production, consider using cloud storage services like AWS S3 or Cloudinary.

## 🚀 Deployment

### Local Development
1. Start MySQL service
2. Run `mvn spring-boot:run`
3. Access `http://localhost:8080`

### Production Deployment
1. **Backend**: Deploy to Heroku, Railway, or AWS
2. **Database**: Use managed MySQL service
3. **Images**: Use cloud storage (AWS S3, Cloudinary)
4. **Frontend**: Deploy to Vercel, Netlify, or GitHub Pages

### Docker Support
```dockerfile
FROM openjdk:17-jdk-slim
COPY target/my-journey-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Spring Boot team for the excellent framework
- FullCalendar for the calendar component
- All contributors and testers

---

**Happy Journaling! 📖✨**
