package com.myjourney.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.myjourney.agent.AgentService;
import com.myjourney.agent.MultimodalBuilder;
import com.myjourney.dto.agent.AgentChatRequest;
import com.myjourney.dto.agent.AgentConversationResponse;
import com.myjourney.dto.agent.AgentMessageResponse;
import com.myjourney.exception.AppException;
import com.myjourney.model.AgentConversation;
import com.myjourney.repository.AgentConversationRepository;
import com.myjourney.repository.AgentMessageRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/agent")
@CrossOrigin
public class AgentChatController {

    // Max number of conversations the list endpoint returns. The agent_conversation
    // table is already capped at 100 per (user, space) by AgentService, so this
    // ceiling is mostly a safety belt against accidental fan-out.
    private static final int CONVERSATION_PAGE_SIZE = 100;

    // SSE emitter timeout. Anthropic responses arrive in a few seconds for a
    // single turn but a full tool-use loop can run ~30s in the worst case.
    private static final long SSE_TIMEOUT_MS = 60_000L;

    @Autowired private AgentService agentService;
    @Autowired private AgentConversationRepository convRepo;
    @Autowired private AgentMessageRepository msgRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private SpaceRepository spaceRepo;
    @Autowired private JwtUtil jwtUtil;

    // GET /api/agent/conversations?spaceId=42 -- list the caller's chat
    // sessions for that space, newest first.
    @GetMapping("/conversations")
    public ResponseEntity<List<AgentConversationResponse>> listConversations(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam Integer spaceId) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        var user = userRepo.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        var space = spaceRepo.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        var page = convRepo.findByUserAndSpaceOrderByUpdatedAtDesc(
                user, space, PageRequest.of(0, CONVERSATION_PAGE_SIZE));
        return ResponseEntity.ok(page.getContent().stream()
                .map(c -> new AgentConversationResponse(
                        c.getId(), space.getId(), c.getTitle(),
                        c.getCreatedAt(), c.getUpdatedAt()))
                .toList());
    }

    // GET /api/agent/conversations/{id}/messages -- replay every persisted
    // turn of a conversation. Only the conversation owner can read it.
    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<AgentMessageResponse>> listMessages(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        AgentConversation c = convRepo.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Conversation not found"));
        if (!c.getUser().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Conversation not yours");
        }
        return ResponseEntity.ok(
                msgRepo.findByConversationOrderByCreatedAtAsc(c).stream()
                        .map(m -> new AgentMessageResponse(
                                m.getId(), m.getRole().name(),
                                m.getContent(), m.getCreatedAt()))
                        .toList());
    }

    // POST /api/agent/chat -- opens an SSE stream for one assistant turn.
    //
    // Event sequence:
    //   event: meta   data: {"conversationId": 42}
    //   event: delta  data: {"text": "..."}        (one or more)
    //   event: done   data: {}
    //
    // If something goes wrong the server sends event:error then closes.
    // Today the assistant text arrives as a single delta because AgentService
    // emits via Consumer<String>; switching to a streaming Anthropic client
    // later will turn this into many small deltas without changing the wire
    // shape.
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody AgentChatRequest req) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) throw new AppException(HttpStatus.UNAUTHORIZED, "Auth required");
        if (req.message() == null || req.message().isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "message is required");
        }
        if (req.spaceId() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "spaceId is required");
        }

        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);

        // Off-load the LLM call to a virtual thread so the request thread
        // returns the emitter immediately. The emitter is completed when the
        // assistant text arrives (or on error). Virtual threads are cheap
        // enough that we don't need a shared executor.
        Thread.startVirtualThread(() -> {
            try {
                AgentConversation conv = agentService.startOrLoadConversation(
                        userId, req.spaceId(), req.conversationId());

                emitter.send(SseEmitter.event()
                        .name("meta")
                        .data("{\"conversationId\":" + conv.getId() + "}"));

                List<JsonNode> userBlocks = MultimodalBuilder.fromAttachmentUrls(
                        req.attachmentUrls(), req.message());

                agentService.runTurn(conv, req.message(), userBlocks, chunk -> {
                    try {
                        emitter.send(SseEmitter.event()
                                .name("delta")
                                .data("{\"text\":" + jsonStringLiteral(chunk) + "}"));
                    } catch (IOException e) {
                        emitter.completeWithError(e);
                    }
                });

                emitter.send(SseEmitter.event().name("done").data("{}"));
                emitter.complete();
            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data("{\"message\":" + jsonStringLiteral(e.getMessage()) + "}"));
                } catch (Exception ignored) {
                    // emitter is dead; nothing useful to do
                }
                emitter.completeWithError(e);
            }
        });
        return emitter;
    }

    // Minimal JSON-string escape so the SSE data payload stays well-formed
    // without pulling Jackson into a hot inner loop.
    private static String jsonStringLiteral(String s) {
        if (s == null) return "\"\"";
        StringBuilder sb = new StringBuilder(s.length() + 2).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"'  -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default   -> sb.append(c);
            }
        }
        return sb.append('"').toString();
    }
}
