package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ToolSchemasTest {

    @Test
    void allSchemas_parsesAndContainsAllEightTools() {
        JsonNode arr = ToolSchemas.allSchemas();
        assertThat(arr.isArray()).isTrue();
        assertThat(arr.size()).isEqualTo(8);
        for (int i = 0; i < arr.size(); i++) {
            assertThat(arr.get(i).get("name").asText()).isIn(ToolSchemas.names());
            assertThat(arr.get(i).get("input_schema")).isNotNull();
        }
    }
}
