package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;

// HTTP wrapper for the Anthropic Messages API used by the agent loop.
// Keeps message + tool-schema assembly and the API call in one place so
// AgentService can focus on the tool-use control flow.
//
// Not a thin pass-through: the client owns the JSON request body shape
// (system, messages, tools, max_tokens) so test code can assert against
// that shape without re-implementing it.
@Component
public class AnthropicChatClient {

    private static final Logger log = LoggerFactory.getLogger(AnthropicChatClient.class);
    private static final String URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-haiku-4-5-20251001";
    private static final int MAX_TOKENS = 1024;
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    @Value("${anthropic.api-key}")
    private String apiKey;

    // Default RestTemplate is fine; tests swap in a mock via the package-private
    // setter so we don't need a real network round-trip to validate request shape.
    private RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * One Messages-API call with tools enabled.
     *
     * @param systemPrompt short system instruction
     * @param messages     conversation history in Anthropic message shape
     *                     (each item is an ObjectNode with role + content)
     * @param tools        array of tool schemas (e.g. ToolSchemas.allSchemas())
     * @return parsed top-level response JSON; has "content" array and "stop_reason"
     */
    public JsonNode complete(String systemPrompt, List<JsonNode> messages, JsonNode tools) {
        String bodyJson;
        try {
            bodyJson = mapper.writeValueAsString(buildBody(systemPrompt, messages, tools));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize Anthropic request", e);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", ANTHROPIC_VERSION);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> req = new HttpEntity<>(bodyJson, headers);

        try {
            ResponseEntity<String> res = restTemplate.postForEntity(URL, req, String.class);
            return mapper.readTree(res.getBody());
        } catch (Exception e) {
            log.error("Anthropic API call failed", e);
            throw new RuntimeException("Anthropic API call failed", e);
        }
    }

    // Visible for testing: build the JSON body that gets POSTed. Tools array
    // is omitted entirely when null or empty -- matches Anthropic's expected
    // schema (no empty `tools: []`).
    ObjectNode buildBody(String systemPrompt, List<JsonNode> messages, JsonNode tools) {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", MODEL);
        body.put("max_tokens", MAX_TOKENS);
        body.put("system", systemPrompt);
        ArrayNode arr = body.putArray("messages");
        if (messages != null) {
            for (JsonNode m : messages) arr.add(m);
        }
        if (tools != null && tools.isArray() && tools.size() > 0) {
            body.set("tools", tools);
        }
        return body;
    }

    // Package-private setter so tests can inject a mocked RestTemplate.
    void setRestTemplateForTesting(RestTemplate rt) { this.restTemplate = rt; }

    void setApiKeyForTesting(String key) { this.apiKey = key; }
}
