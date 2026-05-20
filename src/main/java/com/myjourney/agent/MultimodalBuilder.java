package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

// Builds Anthropic content blocks for a user message that includes
// previously-uploaded Cloudinary attachments. Stub for now -- image and PDF
// handling land in Section E (tasks E1, E2). Returning List.of() means the
// SSE controller falls back to a plain text block built from the message
// string, which matches today's plain-text-only behaviour.
public final class MultimodalBuilder {
    private MultimodalBuilder() {}

    public static List<JsonNode> fromAttachmentUrls(List<String> urls, String userText) {
        return List.of();
    }
}
