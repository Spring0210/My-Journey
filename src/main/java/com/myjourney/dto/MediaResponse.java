package com.myjourney.dto;

import java.time.LocalDate;

// A single media item shown on the Media library page. sourceTitle is a
// friendly label for the bottom strip of the lightbox; for Space posts
// (which have no title), the service truncates content to ~60 chars.
public record MediaResponse(
        Long id,
        String type,            // "IMAGE" | "VIDEO"
        String url,
        String sourceType,      // "JOURNAL" | "SPACE_POST"
        Long sourceId,
        LocalDate sourceDate,
        String sourceTitle      // entry title for JOURNAL, content-snippet for SPACE_POST
) {}
