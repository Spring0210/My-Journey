package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ToolSchemasTest {

    @Test
    void allSchemas_parsesAndContainsAllRegisteredTools() {
        JsonNode arr = ToolSchemas.allSchemas();
        assertThat(arr.isArray()).isTrue();
        // Schema array length must match the canonical names() list -- the
        // two are kept in lockstep so a new tool that's registered in one
        // place but not the other fails fast.
        assertThat(arr.size()).isEqualTo(ToolSchemas.names().size());
        for (int i = 0; i < arr.size(); i++) {
            assertThat(arr.get(i).get("name").asText()).isIn(ToolSchemas.names());
            assertThat(arr.get(i).get("input_schema")).isNotNull();
        }
    }
}
