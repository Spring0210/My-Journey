package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.dto.ToolDocumentDetail;
import com.myjourney.agent.dto.ToolSearchResult;
import com.myjourney.model.AgentConversation;
import com.myjourney.model.AgentMessage;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import com.myjourney.repository.AgentConversationRepository;
import com.myjourney.repository.AgentMessageRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.testsupport.AgentTestFixture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// End-to-end test of the tool-use loop. AnthropicChatClient and DocumentToolset
// are mocked so the test never hits the network or the underlying services --
// every behavioural assertion is about how AgentService orchestrates the loop.
@SpringBootTest
@Transactional
class AgentServiceLoopTest {

    @Autowired AgentService service;
    @Autowired UserRepository userRepository;
    @Autowired SpaceRepository spaceRepository;
    @Autowired SpaceMemberRepository memberRepository;
    @Autowired AgentConversationRepository convRepo;
    @Autowired AgentMessageRepository msgRepo;

    @MockitoBean AnthropicChatClient anthropic;
    @MockitoBean DocumentToolset toolset;

    private final ObjectMapper mapper = new ObjectMapper();
    private AgentConversation conv;

    @BeforeEach
    void setup() {
        reset(anthropic, toolset);

        User u = AgentTestFixture.saveUser(userRepository, "alice");
        Space s = AgentTestFixture.savePersonalSpace(spaceRepository, u);
        AgentTestFixture.saveOwnerMember(memberRepository, s, u);
        conv = AgentTestFixture.saveConversation(convRepo, u, s, "Untitled");
    }

    @Test
    void runTurn_callsTool_thenReturnsTextAnswer() throws Exception {
        JsonNode toolUseResp = mapper.readTree("""
                {
                  "stop_reason": "tool_use",
                  "content": [
                    {"type":"tool_use","id":"t1","name":"search_documents",
                     "input":{"query":"onboarding","limit":5}}
                  ]
                }
                """);
        JsonNode finalResp = mapper.readTree("""
                {
                  "stop_reason": "end_turn",
                  "content": [
                    {"type":"text","text":"Here is what I found: ..."}
                  ]
                }
                """);
        when(anthropic.complete(anyString(), anyList(), any()))
                .thenReturn(toolUseResp, finalResp);
        when(toolset.searchDocuments(any(), eq("onboarding"), any(), any(), any(), any(), eq(5)))
                .thenReturn(new ToolSearchResult(List.of()));

        StringBuilder out = new StringBuilder();
        service.runTurn(conv, "what about onboarding?", List.of(), false, out::append);

        assertThat(out.toString()).contains("Here is what I found");
        verify(anthropic, times(2)).complete(anyString(), anyList(), any());
        verify(toolset).searchDocuments(any(), eq("onboarding"), any(), any(), any(), any(), eq(5));

        // Persistence: USER + ASSISTANT(tool_use) + TOOL(result) + ASSISTANT(text) = 4 turns.
        List<AgentMessage> turns = msgRepo.findByConversationOrderByCreatedAtAsc(conv);
        assertThat(turns).hasSize(4);
        assertThat(turns.get(0).getRole()).isEqualTo(AgentMessage.Role.USER);
        assertThat(turns.get(1).getRole()).isEqualTo(AgentMessage.Role.ASSISTANT);
        assertThat(turns.get(2).getRole()).isEqualTo(AgentMessage.Role.TOOL);
        assertThat(turns.get(3).getRole()).isEqualTo(AgentMessage.Role.ASSISTANT);
    }

    @Test
    void runTurn_crossSpace_systemPromptInstructsModelToSearchAllSpaces() throws Exception {
        // Cross-space mode swaps in a different system prompt so the model
        // knows to call search_documents without a space_id. Verify by
        // capturing the first positional arg to anthropic.complete().
        JsonNode finalResp = mapper.readTree("""
                {
                  "stop_reason": "end_turn",
                  "content": [
                    {"type":"text","text":"ok"}
                  ]
                }
                """);
        when(anthropic.complete(anyString(), anyList(), any())).thenReturn(finalResp);

        StringBuilder out = new StringBuilder();
        service.runTurn(conv, "what did I write last week?", List.of(), true, out::append);

        org.mockito.ArgumentCaptor<String> promptCaptor =
                org.mockito.ArgumentCaptor.forClass(String.class);
        verify(anthropic).complete(promptCaptor.capture(), anyList(), any());
        String prompt = promptCaptor.getValue();
        assertThat(prompt).contains("cross-space");
        assertThat(prompt).contains("space_id null");
        // The single-space prompt's space-name interpolation must NOT appear.
        assertThat(prompt).doesNotContain("The user's current scope is the space");
    }

    @Test
    void runTurn_singleSpace_systemPromptNamesTheSpace() throws Exception {
        JsonNode finalResp = mapper.readTree("""
                {
                  "stop_reason": "end_turn",
                  "content": [{"type":"text","text":"ok"}]
                }
                """);
        when(anthropic.complete(anyString(), anyList(), any())).thenReturn(finalResp);

        service.runTurn(conv, "hi", List.of(), false, s -> {});

        org.mockito.ArgumentCaptor<String> promptCaptor =
                org.mockito.ArgumentCaptor.forClass(String.class);
        verify(anthropic).complete(promptCaptor.capture(), anyList(), any());
        String prompt = promptCaptor.getValue();
        assertThat(prompt).contains("The user's current scope is the space");
        assertThat(prompt).contains(conv.getSpace().getName());
    }

    @Test
    void runTurn_returnsImmediately_whenAnthropicEndsWithoutTools() throws Exception {
        JsonNode finalResp = mapper.readTree("""
                {
                  "stop_reason": "end_turn",
                  "content": [
                    {"type":"text","text":"hi back"}
                  ]
                }
                """);
        when(anthropic.complete(anyString(), anyList(), any())).thenReturn(finalResp);

        StringBuilder out = new StringBuilder();
        service.runTurn(conv, "hi", List.of(), false, out::append);

        assertThat(out.toString()).isEqualTo("hi back");
        verify(anthropic, times(1)).complete(anyString(), anyList(), any());
        // USER + ASSISTANT only.
        assertThat(msgRepo.findByConversationOrderByCreatedAtAsc(conv)).hasSize(2);
    }

    @Test
    void runTurn_capsAtMaxToolIterations_andEmitsGracefulMessage() throws Exception {
        // Always responds with tool_use so the loop never reaches stop_reason=end_turn.
        JsonNode toolUseResp = mapper.readTree("""
                {
                  "stop_reason": "tool_use",
                  "content": [
                    {"type":"tool_use","id":"t","name":"list_spaces","input":{}}
                  ]
                }
                """);
        when(anthropic.complete(anyString(), anyList(), any())).thenReturn(toolUseResp);
        when(toolset.listSpaces(any())).thenReturn(List.of());

        StringBuilder out = new StringBuilder();
        service.runTurn(conv, "loop forever", List.of(), false, out::append);

        assertThat(out.toString()).contains("had to stop");
        // Exactly MAX_TOOL_ITERATIONS Anthropic calls before the cap kicked in.
        verify(anthropic, times(AgentService.MAX_TOOL_ITERATIONS))
                .complete(anyString(), anyList(), any());
    }

    @Test
    void runTurn_serializesToolResultsContainingJsr310Dates() throws Exception {
        // Regression: a fresh `new ObjectMapper()` cannot serialize
        // LocalDate / LocalDateTime, so before AgentService started injecting
        // Spring's autoconfigured mapper, ANY tool returning a record with a
        // date field (get_document, create_document, ...) failed serialization
        // and surfaced to the model as `Tool error: Java 8 date/time type ...`.
        // This test fails on the old code path and passes on the fix.

        JsonNode toolUseResp = mapper.readTree("""
                {
                  "stop_reason": "tool_use",
                  "content": [
                    {"type":"tool_use","id":"t1","name":"create_document",
                     "input":{"title":"x","content":"y"}}
                  ]
                }
                """);
        JsonNode finalResp = mapper.readTree("""
                {
                  "stop_reason": "end_turn",
                  "content": [
                    {"type":"text","text":"Done -- see [doc:7]."}
                  ]
                }
                """);
        when(anthropic.complete(anyString(), anyList(), any()))
                .thenReturn(toolUseResp, finalResp);

        ToolDocumentDetail detail = new ToolDocumentDetail(
                7L, "x", "y", "NOTE",
                LocalDate.of(2026, 5, 20),           // entryDate
                List.of("tag1"),
                conv.getSpace().getId(), conv.getSpace().getName(), "alice",
                LocalDateTime.of(2026, 5, 20, 10, 0),  // createdAt
                LocalDateTime.of(2026, 5, 20, 10, 0),  // updatedAt
                List.of(), List.of());
        when(toolset.createDocument(any(), eq("x"), eq("y"), any(), any(), any()))
                .thenReturn(detail);

        StringBuilder out = new StringBuilder();
        service.runTurn(conv, "make a doc", List.of(), false, out::append);

        // The tool turn must record is_error=false. Per Anthropic's API
        // contract, tool_result.content must be a string (not a raw JSON
        // object), so the impl stringifies the DTO -- assert that, and that
        // the stringified payload still round-trips back to the DTO shape.
        List<AgentMessage> turns = msgRepo.findByConversationOrderByCreatedAtAsc(conv);
        AgentMessage toolTurn = turns.stream()
                .filter(m -> m.getRole() == AgentMessage.Role.TOOL)
                .findFirst().orElseThrow();
        JsonNode result = toolTurn.getContent().get(0);
        assertThat(result.get("is_error").asBoolean()).isFalse();
        assertThat(result.get("content").isTextual()).isTrue();
        JsonNode parsed = mapper.readTree(result.get("content").asText());
        assertThat(parsed.get("title").asText()).isEqualTo("x");
        assertThat(parsed.get("createdAt").asText()).startsWith("2026-05-20");

        // And the final assistant text streams through to the sink.
        assertThat(out.toString()).contains("Done");
    }

    @Test
    void runTurn_propagatesToolError_intoToolResultBlock() throws Exception {
        JsonNode toolUseResp = mapper.readTree("""
                {
                  "stop_reason": "tool_use",
                  "content": [
                    {"type":"tool_use","id":"t1","name":"get_document",
                     "input":{"document_id":42}}
                  ]
                }
                """);
        JsonNode finalResp = mapper.readTree("""
                {
                  "stop_reason": "end_turn",
                  "content": [
                    {"type":"text","text":"sorry, that doc is unavailable"}
                  ]
                }
                """);
        when(anthropic.complete(anyString(), anyList(), any()))
                .thenReturn(toolUseResp, finalResp);
        when(toolset.getDocument(any(), eq(42L)))
                .thenThrow(new RuntimeException("doc missing"));

        StringBuilder out = new StringBuilder();
        service.runTurn(conv, "show me doc 42", List.of(), false, out::append);

        // The loop swallows the toolset exception into an is_error tool_result;
        // the test verifies persistence captured the error block.
        List<AgentMessage> turns = msgRepo.findByConversationOrderByCreatedAtAsc(conv);
        AgentMessage toolTurn = turns.stream()
                .filter(m -> m.getRole() == AgentMessage.Role.TOOL)
                .findFirst()
                .orElseThrow();
        JsonNode result = toolTurn.getContent().get(0);
        assertThat(result.get("is_error").asBoolean()).isTrue();
        assertThat(result.get("content").asText()).contains("doc missing");
        verify(anthropic, atLeastOnce()).complete(anyString(), anyList(), any());
    }
}
