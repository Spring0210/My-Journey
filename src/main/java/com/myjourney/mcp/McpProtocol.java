package com.myjourney.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

// MCP / JSON-RPC 2.0 wire format constants and tiny envelope builders.
// Pure static — no Spring beans, no state. Keeps the controller code in
// McpJsonRpcController focused on dispatch rather than JSON shape.
//
// References:
//   - JSON-RPC 2.0 spec (jsonrpc, id, method, params / result / error)
//   - MCP spec (initialize / tools/list / tools/call shapes, error codes)
public final class McpProtocol {

    private McpProtocol() {}

    // Protocol version we advertise to clients. MCP clients (Claude Desktop,
    // Cursor) accept this and adapt; if a client sends a newer version in
    // its initialize call we still respond with ours, and the client falls
    // back to the intersection of supported features (just tools, for us).
    public static final String PROTOCOL_VERSION = "2025-03-26";

    public static final String SERVER_NAME    = "my-journey";
    public static final String SERVER_VERSION = "1.0.0";

    // -- JSON-RPC method names ---------------------------------------
    public static final String METHOD_INITIALIZE             = "initialize";
    public static final String METHOD_TOOLS_LIST             = "tools/list";
    public static final String METHOD_TOOLS_CALL             = "tools/call";
    public static final String METHOD_PING                   = "ping";
    public static final String METHOD_NOTIFICATIONS_INITED   = "notifications/initialized";

    // -- JSON-RPC 2.0 error codes ------------------------------------
    public static final int ERROR_PARSE             = -32700;
    public static final int ERROR_INVALID_REQUEST   = -32600;
    public static final int ERROR_METHOD_NOT_FOUND  = -32601;
    public static final int ERROR_INVALID_PARAMS    = -32602;
    public static final int ERROR_INTERNAL          = -32603;

    // -- Envelope builders -------------------------------------------

    public static ObjectNode success(ObjectMapper m, JsonNode id, JsonNode result) {
        ObjectNode env = m.createObjectNode();
        env.put("jsonrpc", "2.0");
        env.set("id", id == null ? m.nullNode() : id);
        env.set("result", result);
        return env;
    }

    public static ObjectNode error(ObjectMapper m, JsonNode id, int code, String message) {
        ObjectNode env = m.createObjectNode();
        env.put("jsonrpc", "2.0");
        env.set("id", id == null ? m.nullNode() : id);
        ObjectNode err = m.createObjectNode();
        err.put("code", code);
        err.put("message", message);
        env.set("error", err);
        return env;
    }

    // Body of the `initialize` response.
    public static ObjectNode initializeResult(ObjectMapper m) {
        ObjectNode result = m.createObjectNode();
        result.put("protocolVersion", PROTOCOL_VERSION);
        ObjectNode caps = m.createObjectNode();
        // Empty {} per spec — we declare tools support and nothing else.
        caps.set("tools", m.createObjectNode());
        result.set("capabilities", caps);
        ObjectNode info = m.createObjectNode();
        info.put("name", SERVER_NAME);
        info.put("version", SERVER_VERSION);
        result.set("serverInfo", info);
        return result;
    }

    // Body of the `tools/list` response. Wraps the 9-tool array from
    // ToolSchemas.allSchemas() in a {tools: [...]} object so the wire shape
    // matches the MCP spec.
    public static ObjectNode toolsListResult(ObjectMapper m, JsonNode allSchemas) {
        ObjectNode result = m.createObjectNode();
        ArrayNode arr = m.createArrayNode();
        for (JsonNode t : allSchemas) arr.add(t);
        result.set("tools", arr);
        return result;
    }

    // Body of the `tools/call` response.
    // Spec shape: {content: [{type:"text", text:"..."}], isError: bool}
    public static ObjectNode toolCallResult(ObjectMapper m, String text, boolean isError) {
        ObjectNode result = m.createObjectNode();
        ArrayNode content = m.createArrayNode();
        ObjectNode block = m.createObjectNode();
        block.put("type", "text");
        block.put("text", text);
        content.add(block);
        result.set("content", content);
        result.put("isError", isError);
        return result;
    }
}
