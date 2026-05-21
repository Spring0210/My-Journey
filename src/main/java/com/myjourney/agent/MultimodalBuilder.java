package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.function.Function;

// Builds Anthropic content blocks for a user message that includes
// previously-uploaded Cloudinary attachments. Images become URL-source
// image blocks; PDFs are fetched and embedded as base64 document blocks
// (Anthropic's PDF input mode does not currently accept URL-source PDFs).
//
// 5 MB cap per PDF keeps the in-process memory budget manageable on the
// 2 GB VPS; oversized PDFs are dropped with a warning rather than crashing
// the turn.
public final class MultimodalBuilder {

    private static final Logger log = LoggerFactory.getLogger(MultimodalBuilder.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_PDF_BYTES = 5 * 1024 * 1024;

    // Tests inject a stub so they don't hit the network.
    private static Function<String, byte[]> pdfFetcher = MultimodalBuilder::fetchPdfDefault;

    static void setPdfFetcherForTesting(Function<String, byte[]> f) { pdfFetcher = f; }

    static void resetPdfFetcherForTesting() { pdfFetcher = MultimodalBuilder::fetchPdfDefault; }

    private MultimodalBuilder() {}

    public static List<JsonNode> fromAttachmentUrls(List<String> urls, String userText) {
        List<JsonNode> blocks = new ArrayList<>();
        if (urls != null) {
            for (String url : urls) {
                if (url == null || url.isBlank()) continue;
                if (looksLikeImage(url)) {
                    blocks.add(imageBlock(url));
                } else if (looksLikePdf(url)) {
                    JsonNode pdf = pdfBlock(url);
                    if (pdf != null) blocks.add(pdf);
                }
                // Other file types are silently dropped -- the agent will see
                // the attachment URL inside get_document's payload and can
                // tell the user it can't read that type directly.
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

    private static boolean looksLikePdf(String url) {
        return url.toLowerCase().endsWith(".pdf");
    }

    private static JsonNode imageBlock(String url) {
        ObjectNode block = MAPPER.createObjectNode();
        block.put("type", "image");
        ObjectNode source = block.putObject("source");
        source.put("type", "url");
        source.put("url", url);
        return block;
    }

    private static JsonNode pdfBlock(String url) {
        byte[] bytes;
        try {
            bytes = pdfFetcher.apply(url);
        } catch (Exception e) {
            log.warn("PDF fetch failed for {}: {}", url, e.getMessage());
            return null;
        }
        if (bytes == null || bytes.length == 0) return null;
        if (bytes.length > MAX_PDF_BYTES) {
            log.warn("PDF {} too large ({} bytes); skipping", url, bytes.length);
            return null;
        }
        ObjectNode block = MAPPER.createObjectNode();
        block.put("type", "document");
        ObjectNode source = block.putObject("source");
        source.put("type", "base64");
        source.put("media_type", "application/pdf");
        source.put("data", Base64.getEncoder().encodeToString(bytes));
        return block;
    }

    private static byte[] fetchPdfDefault(String url) {
        try {
            HttpResponse<byte[]> res = HttpClient.newHttpClient().send(
                    HttpRequest.newBuilder(URI.create(url)).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            return res.body();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
