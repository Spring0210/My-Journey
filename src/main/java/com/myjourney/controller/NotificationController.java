package com.myjourney.controller;

import com.myjourney.dto.NotificationResponse;
import com.myjourney.service.NotificationService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private JwtUtil jwtUtil;

    private Integer getJwtUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        try {
            return jwtUtil.extractUserId(authHeader.substring(7));
        } catch (Exception e) {
            return null;
        }
    }

    // GET /api/notifications — get all notifications for the current user
    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getNotifications(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(notificationService.getNotifications(userId));
    }

    // GET /api/notifications/unread-count — get unread notification count
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(userId)));
    }

    // POST /api/notifications/mark-read — mark all notifications as read
    @PostMapping("/mark-read")
    public ResponseEntity<Void> markAllRead(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        notificationService.markAllRead(userId);
        return ResponseEntity.ok().build();
    }

    // DELETE /api/notifications/{id} — delete a single notification
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOne(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer id
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        notificationService.deleteNotification(id, userId);
        return ResponseEntity.ok().build();
    }

    // DELETE /api/notifications — delete all notifications for the current user
    @DeleteMapping
    public ResponseEntity<Void> deleteAll(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        notificationService.deleteAllNotifications(userId);
        return ResponseEntity.ok().build();
    }
}
