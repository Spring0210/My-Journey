package com.myjourney.agent.dto;

import java.time.LocalDate;
import java.util.List;

public record ToolSearchResult(List<Hit> hits) {
    public record Hit(
            Long documentId,
            String title,
            String snippet,
            Integer spaceId,
            String spaceName,
            LocalDate entryDate,
            String docType
    ) {}
}
