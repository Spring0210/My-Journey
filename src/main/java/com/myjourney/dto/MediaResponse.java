package com.myjourney.dto;

import java.time.LocalDate;

// A single media item shown on the Media library page. sourceTitle is a
// friendly label for the bottom strip of the lightbox; for Space posts
// (which have no title), the service truncates content to ~60 chars.
// sourceHref is the canonical client-side route back to the originating
// entry — built server-side because routing depends on docType + space
// personal-flag for the unified Document model.
public record MediaResponse(
        Long id,
        String type,            // "IMAGE" | "VIDEO"
        String url,
        String sourceType,      // "JOURNAL" | "SPACE_POST" | "DOCUMENT"
        Long sourceId,
        LocalDate sourceDate,
        String sourceTitle,     // entry title for JOURNAL/DOCUMENT, content-snippet for SPACE_POST
        String sourceHref       // e.g. "/journal/123" or "/spaces/4/documents/123"
) {}
