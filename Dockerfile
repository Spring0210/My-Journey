# Stage 1: Build frontend (React + Vite)
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
# Output goes to src/main/resources/static/ relative to project root
RUN npm run build

# Stage 2: Build backend (Spring Boot)
FROM maven:3.9-eclipse-temurin-21 AS backend-builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
# Copy built frontend assets into the Spring Boot static directory
COPY --from=frontend-builder /app/src/main/resources/static ./src/main/resources/static
RUN mvn clean package -DskipTests -q

# Stage 3: Run
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend-builder /app/target/my-journey-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
