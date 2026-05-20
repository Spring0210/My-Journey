package com.myjourney.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.agent.AgentService;
import com.myjourney.model.AgentConversation;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import com.myjourney.repository.AgentConversationRepository;
import com.myjourney.repository.AgentMessageRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.testsupport.AgentTestFixture;
import com.myjourney.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

// Verifies the non-streaming endpoints of AgentChatController: list-conversations
// and get-messages. Auth runs through the real JwtAuthenticationFilter chain
// so a missing or wrong-user token must surface as 401 / 403.
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AgentChatControllerTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository userRepo;
    @Autowired SpaceRepository spaceRepo;
    @Autowired SpaceMemberRepository memberRepo;
    @Autowired AgentConversationRepository convRepo;
    @Autowired AgentMessageRepository msgRepo;
    @Autowired JwtUtil jwtUtil;

    // The SSE endpoint hands off to AgentService on a virtual thread, which
    // can't see the test's @Transactional-uncommitted fixtures (different
    // thread, no propagation). Mocking AgentService keeps the controller
    // path under test while sidestepping the DB visibility issue.
    @MockitoBean AgentService agentService;

    private final ObjectMapper mapper = new ObjectMapper();

    private User user;
    private Space space;
    private String bearer;

    @BeforeEach
    void setup() {
        user = AgentTestFixture.saveUser(userRepo, "alice");
        space = AgentTestFixture.saveSpace(spaceRepo, user, "team");
        AgentTestFixture.saveOwnerMember(memberRepo, space, user);
        bearer = "Bearer " + jwtUtil.generateToken(user.getId(), user.getUsername());
    }

    @Test
    void listConversations_returnsEmptyArrayWhenNoneExist() throws Exception {
        mvc.perform(get("/api/agent/conversations")
                        .param("spaceId", String.valueOf(space.getId()))
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void listConversations_returnsSeededRowsNewestFirst() throws Exception {
        AgentTestFixture.saveConversation(convRepo, user, space, "older");
        AgentTestFixture.saveConversation(convRepo, user, space, "newer");

        mvc.perform(get("/api/agent/conversations")
                        .param("spaceId", String.valueOf(space.getId()))
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void listConversations_rejectsMissingAuth() throws Exception {
        mvc.perform(get("/api/agent/conversations")
                        .param("spaceId", String.valueOf(space.getId())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listMessages_returnsTurnsInChronologicalOrder() throws Exception {
        AgentConversation c = AgentTestFixture.saveConversation(convRepo, user, space, "Untitled");
        // Persist one USER turn so the response isn't empty.
        com.myjourney.model.AgentMessage m = new com.myjourney.model.AgentMessage();
        m.setConversation(c);
        m.setRole(com.myjourney.model.AgentMessage.Role.USER);
        m.setContent(mapper.readTree("[{\"type\":\"text\",\"text\":\"hi\"}]"));
        msgRepo.save(m);

        mvc.perform(get("/api/agent/conversations/" + c.getId() + "/messages")
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].role").value("USER"));
    }

    @Test
    void listMessages_rejectsAccessFromADifferentUser() throws Exception {
        AgentConversation c = AgentTestFixture.saveConversation(convRepo, user, space, "Untitled");
        User outsider = AgentTestFixture.saveUser(userRepo, "outsider");
        String outsiderToken = "Bearer " + jwtUtil.generateToken(outsider.getId(), outsider.getUsername());

        mvc.perform(get("/api/agent/conversations/" + c.getId() + "/messages")
                        .header("Authorization", outsiderToken))
                .andExpect(status().isForbidden());
    }

    // -- POST /api/agent/chat (SSE) ----------------------------------

    @Test
    void chat_rejectsMissingAuth() throws Exception {
        String body = "{\"spaceId\":" + space.getId() + ",\"message\":\"hi\"}";
        mvc.perform(post("/api/agent/chat")
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void chat_rejectsBlankMessage() throws Exception {
        String body = "{\"spaceId\":" + space.getId() + ",\"message\":\"\"}";
        mvc.perform(post("/api/agent/chat")
                        .header("Authorization", bearer)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void chat_rejectsMissingSpaceId() throws Exception {
        String body = "{\"message\":\"hi\"}";
        mvc.perform(post("/api/agent/chat")
                        .header("Authorization", bearer)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void chat_returns429_afterTwentyRequestsInWindow() throws Exception {
        // Body is intentionally malformed (no message field) so each request
        // returns 400 BadRequest from the controller. The point of the test
        // is the rate-limit filter, which runs *before* the controller and
        // consumes a bucket token whether or not the body is valid. After 20
        // accepted requests the 21st must surface as 429.
        String body = "{\"spaceId\":" + space.getId() + "}";

        int rejectedAt = -1;
        for (int i = 1; i <= 21; i++) {
            int status = mvc.perform(post("/api/agent/chat")
                            .header("Authorization", bearer)
                            .contentType("application/json")
                            .content(body))
                    .andReturn()
                    .getResponse()
                    .getStatus();
            if (status == 429) { rejectedAt = i; break; }
        }
        assertThat(rejectedAt).isEqualTo(21);
    }

    @Test
    void chat_streamsMetaDeltaDoneEvents_whenAgentSucceeds() throws Exception {
        // Pre-seed a conversation row the mocked agentService can return.
        AgentConversation seeded = AgentTestFixture.saveConversation(convRepo, user, space, "Untitled");
        when(agentService.startOrLoadConversation(eq(user.getId()), eq(space.getId()), any()))
                .thenReturn(seeded);

        // runTurn is mocked to immediately invoke the sink (Consumer<String>)
        // with the final assistant text, mirroring AgentService's actual
        // single-call streaming behaviour today.
        doAnswer(inv -> {
            java.util.function.Consumer<String> sink = inv.getArgument(3);
            sink.accept("hi back");
            return null;
        }).when(agentService).runTurn(any(), anyString(), anyList(), any());

        String body = "{\"spaceId\":" + space.getId() + ",\"message\":\"hi\"}";

        MvcResult start = mvc.perform(post("/api/agent/chat")
                        .header("Authorization", bearer)
                        .contentType("application/json")
                        .content(body))
                .andExpect(request().asyncStarted())
                .andReturn();

        // Wait up to ~5s for the virtual thread to finish driving the loop and
        // close the emitter. asyncDispatch then renders the buffered SSE body.
        start.getAsyncResult(5_000);

        String stream = mvc.perform(asyncDispatch(start))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(stream).contains("event:meta").contains("conversationId");
        assertThat(stream).contains("event:delta").contains("hi back");
        assertThat(stream).contains("event:done");
    }
}
