package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.model.AgentConversation;
import com.myjourney.model.AgentMessage;
import com.myjourney.model.Document;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import com.myjourney.repository.AgentConversationRepository;
import com.myjourney.repository.AgentMessageRepository;
import com.myjourney.repository.DocumentRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.testsupport.AgentTestFixture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

// Guards the transaction boundaries of the agent loop.
//
// Unlike AgentServiceLoopTest this class is intentionally NOT @Transactional:
// in production runTurn executes on a virtual thread with no surrounding
// transaction and no open-in-view session, and the conversation it receives is
// detached. Running the test inside a test transaction would hide exactly the
// failures we want to catch (LazyInitializationException, or a DB connection
// held across the LLM wait). Only AnthropicChatClient is mocked; the real
// ToolDispatcher -> DocumentToolset -> DocumentService path runs against the
// dev MySQL, and @AfterEach deletes every row the test created.
@SpringBootTest
class AgentServiceTransactionBoundaryTest {

    @Autowired AgentService service;
    @Autowired UserRepository userRepo;
    @Autowired SpaceRepository spaceRepo;
    @Autowired SpaceMemberRepository memberRepo;
    @Autowired DocumentRepository docRepo;
    @Autowired AgentConversationRepository convRepo;
    @Autowired AgentMessageRepository msgRepo;

    @MockitoBean AnthropicChatClient anthropic;

    private final ObjectMapper mapper = new ObjectMapper();

    private User user;
    private Space space;
    private Document doc;
    private Long conversationId;

    @BeforeEach
    void setup() {
        user = AgentTestFixture.saveUser(userRepo, "txn");
        space = AgentTestFixture.saveSpace(spaceRepo, user, "txn-space");
        AgentTestFixture.saveOwnerMember(memberRepo, space, user);
        doc = AgentTestFixture.saveDoc(docRepo, space, user, "quarterly plan");
        conversationId = AgentTestFixture
                .saveConversation(convRepo, user, space, "Untitled").getId();
    }

    @AfterEach
    void cleanup() {
        // Delete children before parents to satisfy foreign keys.
        convRepo.findById(conversationId).ifPresent(c -> {
            msgRepo.deleteAll(msgRepo.findByConversationOrderByCreatedAtAsc(c));
            convRepo.delete(c);
        });
        docRepo.findById(doc.getId()).ifPresent(docRepo::delete);
        memberRepo.deleteAll(memberRepo.findBySpace(space));
        spaceRepo.findById(space.getId()).ifPresent(spaceRepo::delete);
        userRepo.findById(user.getId()).ifPresent(userRepo::delete);
    }

    @Test
    void runTurn_holdsNoTransactionWhileWaitingOnTheLlm_andToolsStillLoadLazyFields()
            throws Exception {
        JsonNode toolUse = mapper.readTree("""
                {"stop_reason":"tool_use","content":[
                  {"type":"tool_use","id":"t1","name":"get_document",
                   "input":{"document_id":%d}}]}
                """.formatted(doc.getId()));
        JsonNode finalText = mapper.readTree("""
                {"stop_reason":"end_turn","content":[{"type":"text","text":"done"}]}
                """);

        // Record whether a transaction is open at the moment the LLM is called.
        List<Boolean> txActiveDuringLlmCall = new ArrayList<>();
        when(anthropic.complete(anyString(), anyList(), any())).thenAnswer(inv -> {
            txActiveDuringLlmCall.add(
                    TransactionSynchronizationManager.isActualTransactionActive());
            return txActiveDuringLlmCall.size() == 1 ? toolUse : finalText;
        });

        // Load the conversation the same way the controller does: through
        // startOrLoadConversation, so its space/user are detached lazy proxies.
        AgentConversation conv = service.startOrLoadConversation(
                user.getId(), space.getId(), conversationId);

        StringBuilder out = new StringBuilder();
        service.runTurn(conv, "summarize the plan", List.of(), false, out::append);

        assertThat(out.toString()).isEqualTo("done");
        assertThat(txActiveDuringLlmCall).containsExactly(false, false);

        // The real get_document tool mapped document.space and document.author
        // (both LAZY). It must have succeeded inside dispatch's own transaction.
        List<AgentMessage> turns = msgRepo.findByConversationOrderByCreatedAtAsc(conv);
        assertThat(turns).hasSize(4);
        JsonNode toolResult = turns.get(2).getContent().get(0);
        assertThat(toolResult.path("is_error").asBoolean()).isFalse();
        assertThat(toolResult.path("content").asText())
                .contains("quarterly plan")
                .contains(space.getName())
                .contains(user.getUsername());
    }
}
