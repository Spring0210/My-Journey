package com.myjourney.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.myjourney.filter.McpAuthenticationFilter;
import com.myjourney.mcp.McpToolBridge;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// addFilters = false: the McpAuthenticationFilter has its own unit test;
// here we drive the controller directly and stub the token id via a request
// attribute (matching what the filter sets in production).
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
class McpJsonRpcControllerTest {

    @Autowired private MockMvc mvc;
    @MockitoBean private McpToolBridge bridge;

    @Test
    void initialize_returnsProtocolVersionAndServerInfo() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"jsonrpc":"2.0","id":1,"method":"initialize",
                             "params":{"protocolVersion":"2025-03-26"}}
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jsonrpc").value("2.0"))
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.result.protocolVersion").value("2025-03-26"))
                .andExpect(jsonPath("$.result.serverInfo.name").value("my-journey"))
                .andExpect(jsonPath("$.result.capabilities.tools").exists());
    }

    @Test
    void toolsList_returnsAllNineRegisteredTools() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.tools.length()").value(9))
                .andExpect(jsonPath("$.result.tools[0].name").exists())
                .andExpect(jsonPath("$.result.tools[0].input_schema").exists());
    }

    @Test
    void toolsCall_delegatesToBridgeAndWrapsResult() throws Exception {
        when(bridge.invoke(eq(99L), eq("list_spaces"), any(JsonNode.class)))
                .thenReturn(new McpToolBridge.Result("[{\"id\":1}]", false));

        mvc.perform(post("/mcp")
                        .requestAttr(McpAuthenticationFilter.ATTR_TOKEN_ID, 99L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"jsonrpc":"2.0","id":3,"method":"tools/call",
                             "params":{"name":"list_spaces","arguments":{}}}
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.content[0].type").value("text"))
                .andExpect(jsonPath("$.result.content[0].text").value("[{\"id\":1}]"))
                .andExpect(jsonPath("$.result.isError").value(false));

        verify(bridge).invoke(eq(99L), eq("list_spaces"), any(JsonNode.class));
    }

    @Test
    void toolsCall_returnsIsErrorTrueWhenBridgeReportsError() throws Exception {
        when(bridge.invoke(eq(99L), eq("get_document"), any(JsonNode.class)))
                .thenReturn(new McpToolBridge.Result("{\"error\":\"not found\"}", true));

        mvc.perform(post("/mcp")
                        .requestAttr(McpAuthenticationFilter.ATTR_TOKEN_ID, 99L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"jsonrpc":"2.0","id":4,"method":"tools/call",
                             "params":{"name":"get_document","arguments":{"document_id":99}}}
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(true));
    }

    @Test
    void ping_returnsEmptyResult() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"ping\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").isMap())
                .andExpect(jsonPath("$.id").value(5));
    }

    @Test
    void notificationsInitialized_returns202WithNoBody() throws Exception {
        // Notifications have no `id` — per JSON-RPC, server MUST NOT respond.
        // We acknowledge with 202 Accepted and an empty body.
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}"))
                .andExpect(status().isAccepted())
                .andExpect(content().string(""));
    }

    @Test
    void unknownMethod_returnsMethodNotFoundError() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"bogus\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32601))
                .andExpect(jsonPath("$.error.message")
                        .value(org.hamcrest.Matchers.containsString("bogus")));
    }

    @Test
    void getMcp_returns405() throws Exception {
        mvc.perform(get("/mcp"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void malformedJson_returnsParseError() throws Exception {
        mvc.perform(post("/mcp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.error.code").value(-32700));
    }
}
