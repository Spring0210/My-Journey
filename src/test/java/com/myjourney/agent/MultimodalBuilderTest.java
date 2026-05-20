package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MultimodalBuilderTest {

    @BeforeEach
    void stubPdfFetcher() {
        // Stub the PDF fetcher with a constant payload so tests never hit the
        // network. The bytes are a valid base64 of "%PDF-1.4\n" but the actual
        // content doesn't matter -- Anthropic isn't called.
        MultimodalBuilder.setPdfFetcherForTesting(url -> "%PDF-1.4\n".getBytes(StandardCharsets.UTF_8));
    }

    @AfterEach
    void unstubPdfFetcher() {
        MultimodalBuilder.resetPdfFetcherForTesting();
    }

    @Test
    void fromAttachmentUrls_buildsImageBlockForEachImage_andOneTextBlock() {
        List<String> urls = List.of(
                "https://res.cloudinary.com/foo/image/upload/v1/x.jpg",
                "https://res.cloudinary.com/foo/image/upload/v1/y.png");

        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(urls, "what are these?");

        assertThat(blocks).hasSize(3);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("image");
        assertThat(blocks.get(0).get("source").get("url").asText()).contains("x.jpg");
        assertThat(blocks.get(1).get("type").asText()).isEqualTo("image");
        assertThat(blocks.get(1).get("source").get("url").asText()).contains("y.png");
        assertThat(blocks.get(2).get("type").asText()).isEqualTo("text");
        assertThat(blocks.get(2).get("text").asText()).isEqualTo("what are these?");
    }

    @Test
    void fromAttachmentUrls_textOnly_returnsSingleTextBlock() {
        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(List.of(), "hello");
        assertThat(blocks).hasSize(1);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("text");
    }

    @Test
    void fromAttachmentUrls_recognizesCloudinaryImageUploadPathWithoutExtension() {
        // Cloudinary URLs are often `/image/upload/<transforms>/<publicId>` with no extension.
        List<String> urls = List.of(
                "https://res.cloudinary.com/x/image/upload/v123/abc123");

        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(urls, "tag");

        assertThat(blocks).hasSize(2);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("image");
    }

    @Test
    void fromAttachmentUrls_ignoresEmptyOrNullEntries() {
        List<String> urls = new java.util.ArrayList<>();
        urls.add(null);
        urls.add("");
        urls.add("https://res.cloudinary.com/x/image/upload/y.png");

        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(urls, "hello");

        assertThat(blocks).hasSize(2);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("image");
        assertThat(blocks.get(1).get("type").asText()).isEqualTo("text");
    }

    @Test
    void fromAttachmentUrls_returnsEmpty_whenNoUrlsAndNoText() {
        assertThat(MultimodalBuilder.fromAttachmentUrls(null, null)).isEmpty();
        assertThat(MultimodalBuilder.fromAttachmentUrls(null, "")).isEmpty();
        assertThat(MultimodalBuilder.fromAttachmentUrls(List.of(), null)).isEmpty();
    }

    @Test
    void fromAttachmentUrls_pdfBecomesBase64DocumentBlock() {
        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(
                List.of("https://example.com/spec.pdf"), "summarize this");

        assertThat(blocks).hasSize(2);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("document");
        assertThat(blocks.get(0).get("source").get("type").asText()).isEqualTo("base64");
        assertThat(blocks.get(0).get("source").get("media_type").asText()).isEqualTo("application/pdf");

        // Verify the base64 round-trips back to our stub payload.
        String data = blocks.get(0).get("source").get("data").asText();
        byte[] decoded = Base64.getDecoder().decode(data);
        assertThat(new String(decoded, StandardCharsets.UTF_8)).isEqualTo("%PDF-1.4\n");

        assertThat(blocks.get(1).get("type").asText()).isEqualTo("text");
    }

    @Test
    void fromAttachmentUrls_dropsOversizedPdf() {
        // 5 MB + 1 byte: just above the cap, must be skipped.
        byte[] huge = new byte[5 * 1024 * 1024 + 1];
        MultimodalBuilder.setPdfFetcherForTesting(url -> huge);

        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(
                List.of("https://example.com/huge.pdf"), "summary?");

        // Only the text block survives.
        assertThat(blocks).hasSize(1);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("text");
    }

    @Test
    void fromAttachmentUrls_dropsPdfWhenFetcherThrows() {
        MultimodalBuilder.setPdfFetcherForTesting(url -> { throw new RuntimeException("404"); });

        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(
                List.of("https://example.com/missing.pdf"), "see attached");

        assertThat(blocks).hasSize(1);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("text");
    }

    @Test
    void fromAttachmentUrls_mixesImageAndPdf() {
        List<String> urls = List.of(
                "https://res.cloudinary.com/x/image/upload/y.png",
                "https://example.com/notes.pdf");

        List<JsonNode> blocks = MultimodalBuilder.fromAttachmentUrls(urls, "compare these");

        assertThat(blocks).hasSize(3);
        assertThat(blocks.get(0).get("type").asText()).isEqualTo("image");
        assertThat(blocks.get(1).get("type").asText()).isEqualTo("document");
        assertThat(blocks.get(2).get("type").asText()).isEqualTo("text");
    }
}
