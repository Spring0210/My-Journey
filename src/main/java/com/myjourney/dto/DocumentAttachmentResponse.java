package com.myjourney.dto;

import java.time.LocalDateTime;

// A single file attached to a Document (image, PDF, etc).
public record DocumentAttachmentResponse(
        Long id,
        String fileUrl,
        String originalName,
        String mimeType,
        Long sizeBytes,
        Integer position,
        LocalDateTime uploadedAt
) {}
