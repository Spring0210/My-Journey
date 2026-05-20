package com.myjourney.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// Compact form used in list / search results. `snippet` is the first ~200
// chars of the markdown body — enough for a card preview without shipping
// MEDIUMTEXT bodies for every entry on the page.
public record DocumentSummaryResponse(
        Long id,
        String title,
        String snippet,
        String docType,
        LocalDate entryDate,
        List<String> tags,
        Integer spaceId,
        Integer authorId,
        String authorUsername,
        String authorAvatar,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
