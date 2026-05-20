package com.myjourney.agent.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record ToolDocumentDetail(
        Long id,
        String title,
        String content,
        String docType,
        LocalDate entryDate,
        List<String> tags,
        Integer spaceId,
        String spaceName,
        String authorUsername,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<Attachment> attachments,
        List<ToolComment> recentComments
) {
    public record Attachment(String url, String originalName, String mimeType, Long sizeBytes) {}
}
