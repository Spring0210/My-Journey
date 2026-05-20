package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MultimodalBuilderTest {

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
}
