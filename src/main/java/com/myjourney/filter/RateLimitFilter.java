package com.myjourney.filter;

import com.myjourney.util.JwtUtil;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(1) // Run before JwtAuthenticationFilter
public class RateLimitFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    // Separate bucket maps for each limit tier
    private final ConcurrentHashMap<String, Bucket> loginBuckets      = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Bucket> registerBuckets   = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Bucket> aiBuckets         = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Bucket> agentChatBuckets  = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Only apply to rate-limited endpoints
        return !path.equals("/api/login")
            && !path.equals("/api/register")
            && !path.equals("/api/forgot-password")
            && !path.startsWith("/api/entries/ai-")
            && !path.equals("/api/agent/chat");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        Bucket bucket;

        if (path.startsWith("/api/entries/ai-")) {
            // AI endpoints — limit per userId (extracted from JWT)
            String userId = extractUserId(request);
            if (userId == null) {
                // No valid token — let JwtAuthenticationFilter handle the 401
                filterChain.doFilter(request, response);
                return;
            }
            bucket = aiBuckets.computeIfAbsent(userId, k -> newBucket(5, Duration.ofMinutes(1)));
        } else if (path.equals("/api/agent/chat")) {
            // Agent chat: 20 messages / hour / user (spec section 5.5). Each
            // bucket consumption covers a full LLM turn including any tool
            // calls the agent makes internally.
            String userId = extractUserId(request);
            if (userId == null) {
                filterChain.doFilter(request, response);
                return;
            }
            bucket = agentChatBuckets.computeIfAbsent(userId, k -> newBucket(20, Duration.ofHours(1)));
        } else if (path.equals("/api/login")) {
            // Login — 10 attempts per minute per IP
            bucket = loginBuckets.computeIfAbsent(getClientIp(request), k -> newBucket(10, Duration.ofMinutes(1)));
        } else {
            // Register / forgot-password — 5 attempts per minute per IP
            bucket = registerBuckets.computeIfAbsent(getClientIp(request), k -> newBucket(5, Duration.ofMinutes(1)));
        }

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many requests. Please try again later.\"}");
        }
    }

    // Create a simple token-bucket: `limit` tokens refilled every `period`
    private Bucket newBucket(int limit, Duration period) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(limit)
                        .refillGreedy(limit, period)
                        .build())
                .build();
    }

    // Extract real client IP, respecting the X-Forwarded-For header from Nginx
    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    // Extract userId from Bearer token without failing if token is absent/invalid
    private String extractUserId(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return null;
        try {
            return String.valueOf(jwtUtil.extractUserId(header.substring(7)));
        } catch (Exception e) {
            return null;
        }
    }
}
