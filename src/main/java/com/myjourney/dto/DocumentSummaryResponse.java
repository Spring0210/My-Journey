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
        // Up to 4 thumbnail URLs (image attachments). Cloudinary delivery
        // transforms are inserted server-side so a 4 MB photo doesn't get
        // downloaded for a 48px thumbnail.
        List<String> imageUrls,
        // Total number of image attachments on the doc, including those not
        // surfaced in imageUrls. The card UI shows a "+N" overflow tile when
        // imageCount exceeds the number of thumbnails rendered.
        int imageCount,
        Integer spaceId,
        Integer authorId,
        String authorUsername,
        String authorAvatar,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
