package com.myjourney.dto;

import java.time.LocalDate;
import java.util.List;

// JSON body for POST /api/spaces/{spaceId}/documents.
// `docType` defaults to NOTE on the server when null/blank.
// `entryDate` is required by the service when docType=JOURNAL.
public record CreateDocumentRequest(
        String title,
        String content,
        String docType,
        LocalDate entryDate,
        List<String> tags
) {}
