package com.myjourney.dto;

import java.util.List;

// JSON body for PUT /api/documents/{id}. All fields optional;
// null means "leave unchanged". `tags`, when present, replaces the
// entire list (no partial add/remove).
public record UpdateDocumentRequest(
        String title,
        String content,
        List<String> tags
) {}
