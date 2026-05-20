package com.myjourney.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// Full document detail. Used by the doc-detail endpoint; carries the
// markdown body plus everything the editor / reader needs in one round-trip:
// attachments, comments, author + space identity.
public record DocumentResponse(
        Long id,
        String title,
        String content,
        String docType,           // "JOURNAL" | "NOTE"
        LocalDate entryDate,      // only set when docType=JOURNAL
        List<String> tags,
        Integer spaceId,
        String spaceName,
        // True when the doc lives in the author's personal space. Drives the
        // back-button on doc detail / edit pages (-> /journal, not /spaces/<id>).
        boolean spacePersonal,
        Integer authorId,
        String authorUsername,
        String authorAvatar,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<DocumentAttachmentResponse> attachments,
        List<DocumentCommentResponse> comments
) {}
