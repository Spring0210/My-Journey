package com.myjourney.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.myjourney.agent.ToolSchemas;
import com.myjourney.filter.McpAuthenticationFilter;
import com.myjourney.mcp.McpProtocol;
import com.myjourney.mcp.McpToolBridge;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Hand-rolled JSON-RPC 2.0 endpoint that speaks the slice of MCP Streamable
// HTTP we actually need. POST /mcp accepts a single request envelope and
// returns a single response envelope (or 202 + empty body for notifications).
// GET /mcp returns 405 — we don't push server-initiated messages, and the
// spec explicitly permits servers to opt out of that half of the transport.
//
// No @CrossOrigin: MCP is not browser-facing (spec §6.5).
@RestController
@RequestMapping("/mcp")
public class McpJsonRpcController {

    @Autowired private McpToolBridge bridge;
    @Autowired private ObjectMapper mapper;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<JsonNode> handle(@RequestBody(required = false) String rawBody,
                                            HttpServletRequest request) {
        JsonNode req;
        try {
            if (rawBody == null || rawBody.isBlank()) {
                return ResponseEntity.ok(
                        McpProtocol.error(mapper, null, McpProtocol.ERROR_PARSE, "Parse error"));
            }
            req = mapper.readTree(rawBody);
        } catch (JsonProcessingException e) {
            // Parse error: no id available — per JSON-RPC 2.0 the id is null.
            return ResponseEntity.ok(
                    McpProtocol.error(mapper, null, McpProtocol.ERROR_PARSE, "Parse error"));
        }

        JsonNode idNode = req.get("id");
        boolean isNotification = (idNode == null || idNode.isNull());

        String method = req.has("method") ? req.get("method").asText() : "";
        JsonNode params = req.has("params") ? req.get("params") : mapper.createObjectNode();

        // Notifications: process side effects (if any) and return 202 with no body.
        if (isNotification) {
            // We only honour notifications/initialized today; any other
            // notification is silently accepted.
            return ResponseEntity.accepted().build();
        }

        try {
            ObjectNode result = switch (method) {
                case McpProtocol.METHOD_INITIALIZE -> McpProtocol.initializeResult(mapper);
                case McpProtocol.METHOD_TOOLS_LIST -> McpProtocol.toolsListResult(mapper,
                                                            ToolSchemas.allSchemas());
                case McpProtocol.METHOD_TOOLS_CALL -> handleToolsCall(params, request);
                case McpProtocol.METHOD_PING       -> mapper.createObjectNode();
                default -> null;
            };
            if (result == null) {
                return ResponseEntity.ok(McpProtocol.error(mapper, idNode,
                        McpProtocol.ERROR_METHOD_NOT_FOUND,
                        "Method not found: " + method));
            }
            return ResponseEntity.ok(McpProtocol.success(mapper, idNode, result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(McpProtocol.error(mapper, idNode,
                    McpProtocol.ERROR_INVALID_PARAMS, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.ok(McpProtocol.error(mapper, idNode,
                    McpProtocol.ERROR_INTERNAL,
                    "Internal error: " + (e.getMessage() == null
                            ? e.getClass().getSimpleName() : e.getMessage())));
        }
    }

    // The tools/call body is {name, arguments}. We pull the token id off the
    // request attribute that McpAuthenticationFilter set, then delegate to
    // McpToolBridge which owns the audit log + last-used bump.
    private ObjectNode handleToolsCall(JsonNode params, HttpServletRequest request) {
        if (params == null || !params.has("name")) {
            throw new IllegalArgumentException("tools/call requires `name`");
        }
        String toolName = params.get("name").asText();
        JsonNode args = params.has("arguments")
                ? params.get("arguments")
                : mapper.createObjectNode();

        Object attr = request.getAttribute(McpAuthenticationFilter.ATTR_TOKEN_ID);
        if (!(attr instanceof Long tokenId)) {
            // Should not happen — the filter must have run before this controller.
            // Fall through to tools/call with a synthetic error result.
            return McpProtocol.toolCallResult(mapper, "{\"error\":\"unauthenticated\"}", true);
        }
        McpToolBridge.Result r = bridge.invoke(tokenId, toolName, args);
        return McpProtocol.toolCallResult(mapper, r.payloadJson(), r.isError());
    }

    @GetMapping
    public ResponseEntity<Void> noServerStream() {
        // The MCP Streamable HTTP spec allows servers to opt out of the SSE
        // half of the transport by returning 405 on GET. We do; we don't
        // push server-initiated messages.
        return ResponseEntity.status(405).build();
    }
}
