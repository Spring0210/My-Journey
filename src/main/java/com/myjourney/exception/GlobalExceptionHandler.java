package com.myjourney.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Catches AppException thrown anywhere in the service layer and returns
 * a consistent JSON error body: {"error": "message"} with the appropriate HTTP status.
 *
 * The Exception fallback returns the exception class + message in the body so
 * client-side diagnostics can show the real failure instead of a bare 500. The
 * stack trace is also logged so it surfaces in the Spring Boot console.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
    public ResponseEntity<Map<String, String>> handleAppException(AppException ex) {
        return ResponseEntity
                .status(ex.getStatus())
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        log.error("Unhandled exception in request handling", ex);
        Map<String, String> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
        body.put("exception", ex.getClass().getName());
        Throwable cause = ex.getCause();
        if (cause != null && cause != ex) {
            body.put("cause", cause.getClass().getName() + ": "
                    + (cause.getMessage() == null ? "" : cause.getMessage()));
        }
        return ResponseEntity.status(500).body(body);
    }
}
