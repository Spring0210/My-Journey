package com.myjourney.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.ToolDispatcher;
import com.myjourney.exception.AppException;
import com.myjourney.model.McpApiToken;
import com.myjourney.repository.McpApiTokenRepository;
import com.myjourney.service.McpTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

// Single per-call hop between the JSON-RPC controller and our existing
// ToolDispatcher. Responsibilities:
//   1. Look up the McpApiToken (we have its id from the auth filter).
//   2. Call ToolDispatcher with the raw args JsonNode (same shape the
//      internal agent already feeds it).
//   3. Capture success/failure for the audit log; bump last_used_at on success.
//   4. Serialize the dispatcher's return value to a JSON string. The
//      controller wraps that string in MCP's
//      {content: [{type:"text", text: <jsonString>}], isError} envelope.
@Component
public class McpToolBridge {

    private final ToolDispatcher dispatcher;
    private final McpTokenService tokenService;
    private final McpApiTokenRepository tokenRepo;
    private final ObjectMapper mapper;

    public McpToolBridge(ToolDispatcher dispatcher,
                         McpTokenService tokenService,
                         McpApiTokenRepository tokenRepo,
                         ObjectMapper mapper) {
        this.dispatcher   = dispatcher;
        this.tokenService = tokenService;
        this.tokenRepo    = tokenRepo;
        this.mapper       = mapper;
    }

    public record Result(String payloadJson, boolean isError) {}

    public Result invoke(Long tokenId, String toolName, JsonNode args) {
        McpApiToken token = tokenRepo.findById(tokenId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "Token revoked"));
        Integer userId = token.getUser().getId();
        JsonNode argsNode = args == null ? mapper.createObjectNode() : args;
        try {
            Object out = dispatcher.dispatch(userId, toolName, argsNode);
            String json = mapper.writeValueAsString(out);
            tokenService.recordAccess(token, toolName, true);
            tokenService.touchLastUsed(tokenId);
            return new Result(json, false);
        } catch (Exception e) {
            tokenService.recordAccess(token, toolName, false);
            String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            String json = "{\"error\":\"" + msg.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}";
            return new Result(json, true);
        }
    }
}
