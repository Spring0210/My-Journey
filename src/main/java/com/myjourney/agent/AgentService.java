package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.myjourney.exception.AppException;
import com.myjourney.model.AgentConversation;
import com.myjourney.model.AgentMessage;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import com.myjourney.repository.AgentConversationRepository;
import com.myjourney.repository.AgentMessageRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

// Orchestrates an internal agent chat turn: persists messages, drives the
// Anthropic tool-use loop, and streams the final assistant text via a sink.
//
// This class only holds the persistence helpers; the actual loop lands in
// runTurn (task C4) and reuses these helpers.
@Service
public class AgentService {

    private static final Logger log = LoggerFactory.getLogger(AgentService.class);

    // Hard cap from spec section 5.2: max 10 tool calls per turn.
    static final int MAX_TOOL_ITERATIONS = 10;

    // Conversation cap from spec section 5.4: 100 per (user, space); oldest pruned.
    static final int MAX_CONVERSATIONS_PER_SPACE = 100;

    // Sliding window of prior turns sent back to Anthropic (spec section 5.2).
    static final int HISTORY_WINDOW = 20;

    private static final String SYSTEM_PROMPT_TEMPLATE = """
            You are an assistant for the My Journey knowledge base.
            The user's current scope is the space "%s".
            Use the provided tools to find relevant documents before answering.
            Always cite documents by id like [doc:123] when you reference them.
            Be concise. Reply in plain text only -- no markdown formatting of
            any kind (no headers, no **bold**, no *italic*, no bullet lists,
            no numbered lists). The UI does not render markdown, so any
            markdown markers will appear as literal characters to the user.
            """;

    @Autowired private AnthropicChatClient anthropic;
    @Autowired private ToolDispatcher dispatcher;
    @Autowired private AgentConversationRepository convRepo;
    @Autowired private AgentMessageRepository msgRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private SpaceRepository spaceRepo;
    @Autowired private SpaceMemberRepository memberRepo;

    // Inject Spring's autoconfigured ObjectMapper. A fresh `new ObjectMapper()`
    // does NOT have the JSR-310 module registered, so `valueToTree` on a DTO
    // with LocalDate / LocalDateTime fields throws InvalidDefinitionException.
    // That exception was getting swallowed by the tool-call try/catch and
    // re-emitted to the LLM as "Tool error: Java 8 date/time type not
    // supported", which the model paraphrased to the user as a "configuration
    // issue with date/time handling". Spring's mapper has the module wired in.
    @Autowired private ObjectMapper mapper;

    @Transactional
    public AgentConversation startOrLoadConversation(Integer userId, Integer spaceId, Long conversationId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        Space space = spaceRepo.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));
        if (!memberRepo.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Not a member of this space");
        }

        if (conversationId != null) {
            AgentConversation c = convRepo.findById(conversationId)
                    .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Conversation not found"));
            if (!c.getUser().getId().equals(userId) || !c.getSpace().getId().equals(spaceId)) {
                throw new AppException(HttpStatus.FORBIDDEN, "Conversation not yours");
            }
            return c;
        }

        // Soft cap: prune oldest entries before creating a new conversation so
        // an unbounded backlog can't blow the agent_conversation table.
        long count = convRepo.countByUserAndSpace(user, space);
        if (count >= MAX_CONVERSATIONS_PER_SPACE) {
            Page<AgentConversation> all = convRepo.findByUserAndSpaceOrderByUpdatedAtDesc(
                    user, space, PageRequest.of(0, (int) (count + 1)));
            var rows = all.getContent();
            for (int i = MAX_CONVERSATIONS_PER_SPACE - 1; i < rows.size(); i++) {
                convRepo.delete(rows.get(i));
            }
        }

        AgentConversation c = new AgentConversation();
        c.setUser(user);
        c.setSpace(space);
        c.setTitle("Untitled");
        return convRepo.save(c);
    }

    @Transactional
    public AgentMessage persistMessage(AgentConversation conv, AgentMessage.Role role, JsonNode content) {
        AgentMessage m = new AgentMessage();
        m.setConversation(conv);
        m.setRole(role);
        m.setContent(content);
        return msgRepo.save(m);
    }

    @Transactional
    public void renameConversationFromFirstMessage(AgentConversation conv, String userText) {
        if (conv.getTitle() != null && !conv.getTitle().equals("Untitled")) return;
        if (userText == null || userText.isBlank()) return;
        String title = userText.length() > 80 ? userText.substring(0, 80) : userText;
        conv.setTitle(title);
        convRepo.save(conv);
    }

    // Build an Anthropic message object from a stored AgentMessage row. The
    // stored `content` JSON already matches Anthropic's content-block shape;
    // role is mapped one-to-one EXCEPT for TOOL turns, which Anthropic
    // represents as user-role messages carrying tool_result blocks.
    //
    // Legacy-row safeguard: rows persisted before the tool_result.content
    // fix carry the tool output as a JSON object instead of a string.
    // Anthropic 400s on object content, so we stringify any non-string
    // content on the way out. New rows already store a string and skip
    // the conversion.
    public JsonNode toAnthropicMessage(AgentMessage m) {
        ObjectNode node = mapper.createObjectNode();
        if (m.getRole() == AgentMessage.Role.ASSISTANT) {
            node.put("role", "assistant");
        } else {
            // USER and TOOL both serialize as role=user per Anthropic's API.
            node.put("role", "user");
        }
        JsonNode content = m.getContent();
        if (m.getRole() == AgentMessage.Role.TOOL) {
            content = sanitizeToolResultContent(content);
        }
        node.set("content", content);
        return node;
    }

    // Walk a TOOL turn's content array and normalize any tool_result block
    // whose `content` field is an object (legacy row) into a JSON-stringified
    // form. Anthropic requires string-or-content-block-array.
    private JsonNode sanitizeToolResultContent(JsonNode content) {
        if (content == null || !content.isArray()) return content;
        ArrayNode out = mapper.createArrayNode();
        for (JsonNode block : content) {
            if (!"tool_result".equals(block.path("type").asText())
                    || !block.has("content")
                    || !block.get("content").isObject()) {
                out.add(block);
                continue;
            }
            ObjectNode rewritten = block.deepCopy();
            try {
                rewritten.put("content", mapper.writeValueAsString(block.get("content")));
            } catch (Exception e) {
                // Fall back to a placeholder string so the turn isn't dropped.
                rewritten.put("content", "(legacy tool result -- could not stringify)");
            }
            out.add(rewritten);
        }
        return out;
    }

    ObjectMapper mapper() { return mapper; }

    /**
     * Run one user turn: persist the USER message, drive the Anthropic tool-use
     * loop (executing tool_use blocks as they appear), persist every
     * ASSISTANT/TOOL turn, and stream the final assistant text via `sink`.
     *
     * `userContentBlocks` lets the controller pass multimodal blocks (image,
     * document) that the user attached. When null/empty, a single text block
     * is built from `userText`.
     */
    @Transactional
    public void runTurn(AgentConversation conv,
                         String userText,
                         List<JsonNode> userContentBlocks,
                         Consumer<String> sink) {
        // 1) Persist the USER turn verbatim. The content column carries the
        //    content-block array Anthropic expects so we can replay it directly.
        ArrayNode userContent = mapper.createArrayNode();
        if (userContentBlocks != null && !userContentBlocks.isEmpty()) {
            for (JsonNode n : userContentBlocks) userContent.add(n);
        } else {
            ObjectNode textBlock = mapper.createObjectNode();
            textBlock.put("type", "text");
            textBlock.put("text", userText == null ? "" : userText);
            userContent.add(textBlock);
        }
        persistMessage(conv, AgentMessage.Role.USER, userContent);
        renameConversationFromFirstMessage(conv, userText);

        String systemPrompt = String.format(SYSTEM_PROMPT_TEMPLATE, conv.getSpace().getName());

        // 2) Load the last HISTORY_WINDOW turns and rebuild them in Anthropic's
        //    message shape. We re-query rather than appending in-memory so
        //    persistMessage's @Transactional flush is reflected.
        List<AgentMessage> prior = msgRepo.findByConversationOrderByCreatedAtAsc(conv);
        int from = Math.max(0, prior.size() - HISTORY_WINDOW);
        List<JsonNode> history = new ArrayList<>();
        for (int i = from; i < prior.size(); i++) {
            history.add(toAnthropicMessage(prior.get(i)));
        }

        JsonNode tools = ToolSchemas.allSchemas();

        // 3) Tool-use loop. Each iteration is one Anthropic round-trip; the
        //    loop ends when stop_reason != tool_use, or after MAX_TOOL_ITERATIONS.
        for (int iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
            JsonNode res = anthropic.complete(systemPrompt, history, tools);
            JsonNode contentArr = res.path("content");
            if (contentArr.isMissingNode() || !contentArr.isArray()) {
                log.warn("Anthropic response missing content array, stopping turn");
                sink.accept("Sorry, the agent returned an empty response.");
                return;
            }

            // Persist the assistant turn verbatim so the loop can replay it.
            persistMessage(conv, AgentMessage.Role.ASSISTANT, contentArr);
            ObjectNode asAsst = mapper.createObjectNode();
            asAsst.put("role", "assistant");
            asAsst.set("content", contentArr);
            history.add(asAsst);

            String stop = res.path("stop_reason").asText("");
            if (!"tool_use".equals(stop)) {
                // Final answer: concatenate every text block and emit.
                StringBuilder finalText = new StringBuilder();
                for (JsonNode block : contentArr) {
                    if ("text".equals(block.path("type").asText())) {
                        finalText.append(block.path("text").asText());
                    }
                }
                sink.accept(finalText.toString());
                return;
            }

            // tool_use: execute each block and persist a single TOOL turn that
            // bundles every tool_result.
            ArrayNode toolResults = mapper.createArrayNode();
            for (JsonNode block : contentArr) {
                if (!"tool_use".equals(block.path("type").asText())) continue;
                String name  = block.path("name").asText();
                String useId = block.path("id").asText();
                JsonNode args = block.path("input");
                ObjectNode result = mapper.createObjectNode();
                result.put("type", "tool_result");
                result.put("tool_use_id", useId);
                try {
                    Object out = dispatcher.dispatch(conv.getUser().getId(), name, args);
                    // Anthropic's tool_result.content must be a string OR an
                    // array of content blocks -- a raw JSON object trips the
                    // API with a 400 ('Anthropic API call failed' on retry).
                    // Stringify; the model parses JSON content fine when it
                    // needs structured fields.
                    result.put("content", mapper.writeValueAsString(out));
                    result.put("is_error", false);
                } catch (Exception e) {
                    log.warn("Tool {} failed: {}", name, e.getMessage());
                    result.put("content", "Tool error: " + e.getMessage());
                    result.put("is_error", true);
                }
                toolResults.add(result);
            }

            // Anthropic represents tool_result blocks inside a user-role message.
            persistMessage(conv, AgentMessage.Role.TOOL, toolResults);
            ObjectNode asTool = mapper.createObjectNode();
            asTool.put("role", "user");
            asTool.set("content", toolResults);
            history.add(asTool);
        }

        // 4) Hit the iteration cap -- surface a partial answer rather than
        //    silently abandoning the user.
        sink.accept("(I had to stop after " + MAX_TOOL_ITERATIONS
                + " tool calls -- let me know if you want me to keep going.)");
    }
}
