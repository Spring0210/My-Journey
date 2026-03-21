package com.myjourney.dto;

import java.util.List;

/** Generic paginated response wrapper used across all paged endpoints. */
public record PageResponse<T>(
        List<T> content,
        int totalPages,
        long totalElements,
        int currentPage
) {}
