package com.myjourney.exception;

import org.springframework.http.HttpStatus;

/**
 * Application-level exception that carries an HTTP status code.
 * Services throw this instead of returning error maps;
 * GlobalExceptionHandler converts it to a JSON error response.
 */
public class AppException extends RuntimeException {

    private final HttpStatus status;

    public AppException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
