package com.myjourney.websocket;

import com.myjourney.util.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotificationWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(NotificationWebSocketHandler.class);

    // Map of userId → active WebSocket session
    private final ConcurrentHashMap<Integer, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Integer userId = extractUserId(session);
        if (userId == null) {
            log.warn("WebSocket connection rejected: invalid or missing token");
            try { session.close(CloseStatus.NOT_ACCEPTABLE); } catch (IOException ignored) {}
            return;
        }
        // If the same user connects from another tab, replace the old session
        sessions.put(userId, session);
        log.debug("WebSocket connected: userId={}", userId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Integer userId = extractUserId(session);
        if (userId != null) {
            // Only remove if this is still the current session for that user
            sessions.remove(userId, session);
            log.debug("WebSocket disconnected: userId={}", userId);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Client-to-server messages are not used; ignore silently
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("WebSocket transport error: {}", exception.getMessage());
    }

    // Push the current unread count to a specific user — called by NotificationService
    public void sendUnreadCount(Integer userId, long unreadCount) {
        WebSocketSession session = sessions.get(userId);
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new TextMessage("{\"unreadCount\":" + unreadCount + "}"));
            } catch (IOException e) {
                log.warn("Failed to send WebSocket message to userId={}", userId, e);
                sessions.remove(userId, session);
            }
        }
    }

    // Extract userId from the JWT passed as ?token=<jwt> in the WebSocket URL
    private Integer extractUserId(WebSocketSession session) {
        if (session.getUri() == null) return null;
        String query = session.getUri().getQuery();
        if (query == null) return null;
        for (String part : query.split("&")) {
            if (part.startsWith("token=")) {
                String token = part.substring(6);
                try {
                    return jwtUtil.extractUserId(token);
                } catch (Exception e) {
                    return null;
                }
            }
        }
        return null;
    }
}
