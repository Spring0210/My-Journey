package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;

// Builds Anthropic content blocks for a user message that includes
// previously-uploaded Cloudinary attachments. Images become URL-source
// image blocks (Anthropic supports URL-source images). PDF support is
// layered on in task E2.
public final class MultimodalBuilder {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private MultimodalBuilder() {}

    public static List<JsonNode> fromAttachmentUrls(List<String> urls, String userText) {
        List<JsonNode> blocks = new ArrayList<>();
        if (urls != null) {
            for (String url : urls) {
                if (url == null || url.isBlank()) continue;
                if (looksLikeImage(url)) {
                    blocks.add(imageBlock(url));
                }
                // Non-image attachments without an explicit handler are dropped
                // in this iteration; PDF handling lands in E2.
            }
        }
        if (userText != null && !userText.isBlank()) {
            ObjectNode text = MAPPER.createObjectNode();
            text.put("type", "text");
            text.put("text", userText);
            blocks.add(text);
        }
        return blocks;
    }

    private static boolean looksLikeImage(String url) {
        String low = url.toLowerCase();
        return low.endsWith(".jpg") || low.endsWith(".jpeg") || low.endsWith(".png")
                || low.endsWith(".gif") || low.endsWith(".webp")
                || low.contains("/image/upload/");
    }

    private static JsonNode imageBlock(String url) {
        ObjectNode block = MAPPER.createObjectNode();
        block.put("type", "image");
        ObjectNode source = block.putObject("source");
        source.put("type", "url");
        source.put("url", url);
        return block;
    }
}
