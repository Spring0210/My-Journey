package com.myjourney.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.ToolDispatcher;
import com.myjourney.exception.AppException;
import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.repository.McpApiTokenRepository;
import com.myjourney.service.McpTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Unit test — no Spring context. Verifies that McpToolBridge delegates to
// ToolDispatcher with the resolved user id, captures audit log rows for both
// success and failure paths, and only bumps last_used_at on success.
class McpToolBridgeTest {

    private ToolDispatcher dispatcher;
    private McpTokenService tokenService;
    private McpApiTokenRepository tokenRepo;
    private McpToolBridge bridge;

    @BeforeEach
    void setup() {
        dispatcher   = mock(ToolDispatcher.class);
        tokenService = mock(McpTokenService.class);
        tokenRepo    = mock(McpApiTokenRepository.class);
        bridge       = new McpToolBridge(dispatcher, tokenService, tokenRepo, new ObjectMapper());
    }

    @Test
    void invoke_dispatchesAndLogsSuccess() throws Exception {
        McpApiToken token = new McpApiToken();
        token.setId(42L);
        User u = new User();
        u.setId(7);
        token.setUser(u);
        when(tokenRepo.findById(42L)).thenReturn(Optional.of(token));
        when(dispatcher.dispatch(eq(7), eq("list_spaces"), any(JsonNode.class)))
                .thenReturn(Map.of("ok", true));

        JsonNode args = new ObjectMapper().readTree("{}");
        McpToolBridge.Result r = bridge.invoke(42L, "list_spaces", args);

        assertThat(r.isError()).isFalse();
        assertThat(r.payloadJson()).contains("\"ok\":true");
        verify(tokenService).recordAccess(token, "list_spaces", true);
        verify(tokenService).touchLastUsed(42L);
    }

    @Test
    void invoke_logsFailureWhenDispatcherThrows() throws Exception {
        McpApiToken token = new McpApiToken();
        token.setId(42L);
        User u = new User();
        u.setId(7);
        token.setUser(u);
        when(tokenRepo.findById(42L)).thenReturn(Optional.of(token));
        when(dispatcher.dispatch(eq(7), eq("get_document"), any(JsonNode.class)))
                .thenThrow(new AppException(HttpStatus.NOT_FOUND, "doc 99 not found"));

        JsonNode args = new ObjectMapper().readTree("{\"document_id\":99}");
        McpToolBridge.Result r = bridge.invoke(42L, "get_document", args);

        assertThat(r.isError()).isTrue();
        assertThat(r.payloadJson()).contains("doc 99 not found");
        verify(tokenService).recordAccess(token, "get_document", false);
        // last_used_at is only bumped on success to avoid lighting up the
        // dashboard with rows for malformed calls.
        verify(tokenService, never()).touchLastUsed(anyLong());
    }
}
