package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Unit-level coverage of AnthropicChatClient: verifies request body shape and
// the Authorization headers without hitting the real Anthropic endpoint.
class AnthropicChatClientTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private AnthropicChatClient client;
    private RestTemplate restTemplate;

    @BeforeEach
    void setup() {
        client = new AnthropicChatClient();
        restTemplate = mock(RestTemplate.class);
        client.setRestTemplateForTesting(restTemplate);
        client.setApiKeyForTesting("sk-test");
    }

    @Test
    void buildBody_includesSystemMessagesTools() throws Exception {
        JsonNode msg = mapper.readTree("""
                {"role":"user","content":[{"type":"text","text":"hi"}]}
                """);
        JsonNode tools = mapper.readTree("""
                [{"name":"t1","input_schema":{"type":"object","properties":{}}}]
                """);

        ObjectNode body = client.buildBody("be helpful", List.of(msg), tools);

        assertThat(body.get("model").asText()).startsWith("claude-haiku-");
        assertThat(body.get("max_tokens").asInt()).isPositive();
        assertThat(body.get("system").asText()).isEqualTo("be helpful");
        ArrayNode messages = (ArrayNode) body.get("messages");
        assertThat(messages.size()).isEqualTo(1);
        assertThat(messages.get(0).get("role").asText()).isEqualTo("user");
        assertThat(body.get("tools")).isNotNull();
        assertThat(body.get("tools").size()).isEqualTo(1);
    }

    @Test
    void buildBody_omitsToolsKeyWhenEmpty() throws Exception {
        ObjectNode body = client.buildBody("hi", List.of(), null);
        assertThat(body.has("tools")).isFalse();

        JsonNode emptyArr = mapper.createArrayNode();
        ObjectNode body2 = client.buildBody("hi", List.of(), emptyArr);
        assertThat(body2.has("tools")).isFalse();
    }

    @Test
    void complete_surfacesAnthropicErrorBody_inExceptionMessage() {
        // Anthropic returns a useful JSON error body on 4xx responses. The
        // client must include that body in the thrown RuntimeException so the
        // SSE 'error' frame and server log both name the actual cause instead
        // of the generic "Anthropic API call failed".
        when(restTemplate.postForEntity(any(String.class), any(HttpEntity.class), eq(String.class)))
                .thenThrow(HttpClientErrorException.create(
                        HttpStatus.BAD_REQUEST, "Bad Request",
                        org.springframework.http.HttpHeaders.EMPTY,
                        "{\"error\":{\"message\":\"tool_result content must be a string\"}}".getBytes(),
                        null));

        assertThatThrownBy(() -> client.complete("sys", List.of(), null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("400")
                .hasMessageContaining("tool_result content must be a string");
    }

    @Test
    void complete_postsToAnthropicEndpoint_withApiKeyHeader() throws Exception {
        ResponseEntity<String> resp = ResponseEntity.ok("""
                {"stop_reason":"end_turn","content":[{"type":"text","text":"ok"}]}
                """);
        when(restTemplate.postForEntity(eq("https://api.anthropic.com/v1/messages"),
                any(HttpEntity.class), eq(String.class)))
                .thenReturn(resp);

        JsonNode out = client.complete("sys", List.of(), null);

        assertThat(out.get("stop_reason").asText()).isEqualTo("end_turn");
        assertThat(out.get("content").get(0).get("text").asText()).isEqualTo("ok");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<HttpEntity<String>> captor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).postForEntity(eq("https://api.anthropic.com/v1/messages"),
                captor.capture(), eq(String.class));
        HttpEntity<String> req = captor.getValue();
        assertThat(req.getHeaders().getFirst("x-api-key")).isEqualTo("sk-test");
        assertThat(req.getHeaders().getFirst("anthropic-version")).isEqualTo("2023-06-01");
        assertThat(req.getHeaders().getContentType().toString()).contains("application/json");
    }
}
