package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import com.myjourney.testsupport.AgentTestFixture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Integration tests for the AgentService persistence skeleton (task C3):
// startOrLoadConversation membership rules, persistMessage round-trip, title
// auto-rename behaviour, and the Anthropic message-shape mapping.
@SpringBootTest
@Transactional
class AgentServiceTest {

    @Autowired AgentService agentService;
    @Autowired UserRepository userRepo;
    @Autowired SpaceRepository spaceRepo;
    @Autowired SpaceMemberRepository memberRepo;
    @Autowired AgentConversationRepository convRepo;
    @Autowired AgentMessageRepository msgRepo;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void startOrLoadConversation_createsNewWhenIdIsNull() {
        User u = AgentTestFixture.saveUser(userRepo, "alice");
        Space s = AgentTestFixture.saveSpace(spaceRepo, u, "shared");
        AgentTestFixture.saveOwnerMember(memberRepo, s, u);

        AgentConversation c = agentService.startOrLoadConversation(u.getId(), s.getId(), null);

        assertThat(c.getId()).isNotNull();
        assertThat(c.getUser().getId()).isEqualTo(u.getId());
        assertThat(c.getSpace().getId()).isEqualTo(s.getId());
        assertThat(c.getTitle()).isEqualTo("Untitled");
    }

    @Test
    void startOrLoadConversation_rejectsNonMember() {
        User member  = AgentTestFixture.saveUser(userRepo, "owner");
        User outsider = AgentTestFixture.saveUser(userRepo, "outsider");
        Space s = AgentTestFixture.saveSpace(spaceRepo, member, "shared");
        AgentTestFixture.saveOwnerMember(memberRepo, s, member);

        assertThatThrownBy(() ->
                agentService.startOrLoadConversation(outsider.getId(), s.getId(), null))
                .isInstanceOf(AppException.class);
    }

    @Test
    void startOrLoadConversation_loadsExistingById() {
        User u = AgentTestFixture.saveUser(userRepo, "alice");
        Space s = AgentTestFixture.saveSpace(spaceRepo, u, "shared");
        AgentTestFixture.saveOwnerMember(memberRepo, s, u);
        AgentConversation seeded = AgentTestFixture.saveConversation(convRepo, u, s, "hello");

        AgentConversation loaded = agentService.startOrLoadConversation(
                u.getId(), s.getId(), seeded.getId());

        assertThat(loaded.getId()).isEqualTo(seeded.getId());
        assertThat(loaded.getTitle()).isEqualTo("hello");
    }

    @Test
    void startOrLoadConversation_rejectsConversationOwnedByAnotherUser() {
        User owner = AgentTestFixture.saveUser(userRepo, "owner");
        User other = AgentTestFixture.saveUser(userRepo, "other");
        Space s = AgentTestFixture.saveSpace(spaceRepo, owner, "shared");
        AgentTestFixture.saveOwnerMember(memberRepo, s, owner);
        AgentTestFixture.saveOwnerMember(memberRepo, s, other);
        AgentConversation seeded = AgentTestFixture.saveConversation(convRepo, owner, s, "private");

        assertThatThrownBy(() ->
                agentService.startOrLoadConversation(other.getId(), s.getId(), seeded.getId()))
                .isInstanceOf(AppException.class);
    }

    @Test
    void persistMessage_roundTripsContent() throws Exception {
        User u = AgentTestFixture.saveUser(userRepo, "alice");
        Space s = AgentTestFixture.saveSpace(spaceRepo, u, "shared");
        AgentTestFixture.saveOwnerMember(memberRepo, s, u);
        AgentConversation c = AgentTestFixture.saveConversation(convRepo, u, s, "Untitled");
        JsonNode payload = mapper.readTree("[{\"type\":\"text\",\"text\":\"hi\"}]");

        AgentMessage m = agentService.persistMessage(c, AgentMessage.Role.USER, payload);

        assertThat(m.getId()).isNotNull();
        assertThat(m.getRole()).isEqualTo(AgentMessage.Role.USER);

        AgentMessage reloaded = msgRepo.findById(m.getId()).orElseThrow();
        assertThat(reloaded.getContent().get(0).get("text").asText()).isEqualTo("hi");
    }

    @Test
    void renameConversationFromFirstMessage_setsTitle_onlyWhenStillUntitled() {
        User u = AgentTestFixture.saveUser(userRepo, "alice");
        Space s = AgentTestFixture.saveSpace(spaceRepo, u, "shared");
        AgentTestFixture.saveOwnerMember(memberRepo, s, u);
        AgentConversation c = AgentTestFixture.saveConversation(convRepo, u, s, "Untitled");

        agentService.renameConversationFromFirstMessage(c, "what about onboarding?");

        assertThat(convRepo.findById(c.getId()).orElseThrow().getTitle())
                .isEqualTo("what about onboarding?");
    }

    @Test
    void renameConversationFromFirstMessage_truncatesAtEighty() {
        User u = AgentTestFixture.saveUser(userRepo, "alice");
        Space s = AgentTestFixture.saveSpace(spaceRepo, u, "shared");
        AgentTestFixture.saveOwnerMember(memberRepo, s, u);
        AgentConversation c = AgentTestFixture.saveConversation(convRepo, u, s, "Untitled");
        String long_ = "x".repeat(200);

        agentService.renameConversationFromFirstMessage(c, long_);

        assertThat(convRepo.findById(c.getId()).orElseThrow().getTitle()).hasSize(80);
    }

    @Test
    void renameConversationFromFirstMessage_skipsIfAlreadyTitled() {
        User u = AgentTestFixture.saveUser(userRepo, "alice");
        Space s = AgentTestFixture.saveSpace(spaceRepo, u, "shared");
        AgentTestFixture.saveOwnerMember(memberRepo, s, u);
        AgentConversation c = AgentTestFixture.saveConversation(convRepo, u, s, "existing");

        agentService.renameConversationFromFirstMessage(c, "ignored new text");

        assertThat(convRepo.findById(c.getId()).orElseThrow().getTitle()).isEqualTo("existing");
    }

    @Test
    void toAnthropicMessage_stringifiesLegacyObjectToolResults() throws Exception {
        // Rows persisted before the tool_result.content fix stored the tool
        // output as an object, which Anthropic rejects with 400 on replay.
        // toAnthropicMessage must rewrite those legacy blocks to string
        // content on the way out.
        AgentMessage legacy = new AgentMessage();
        legacy.setRole(AgentMessage.Role.TOOL);
        legacy.setContent(mapper.readTree("""
                [
                  {"type":"tool_result","tool_use_id":"t1",
                   "content":{"id":7,"title":"hello"},
                   "is_error":false}
                ]
                """));

        JsonNode out = agentService.toAnthropicMessage(legacy);

        JsonNode result = out.get("content").get(0);
        assertThat(result.get("content").isTextual()).isTrue();
        JsonNode parsed = mapper.readTree(result.get("content").asText());
        assertThat(parsed.get("title").asText()).isEqualTo("hello");
    }

    @Test
    void toAnthropicMessage_leavesStringToolResultsUntouched() throws Exception {
        AgentMessage modern = new AgentMessage();
        modern.setRole(AgentMessage.Role.TOOL);
        modern.setContent(mapper.readTree("""
                [
                  {"type":"tool_result","tool_use_id":"t1",
                   "content":"{\\\"id\\\":7,\\\"title\\\":\\\"hello\\\"}",
                   "is_error":false}
                ]
                """));

        JsonNode out = agentService.toAnthropicMessage(modern);

        // Content is already a string -- pass-through unchanged.
        JsonNode result = out.get("content").get(0);
        assertThat(result.get("content").isTextual()).isTrue();
        assertThat(result.get("content").asText()).contains("\"title\":\"hello\"");
    }

    @Test
    void toAnthropicMessage_mapsRoles_andEmbedsContentVerbatim() throws Exception {
        JsonNode content = mapper.readTree("[{\"type\":\"text\",\"text\":\"hi\"}]");
        AgentMessage user = new AgentMessage();
        user.setRole(AgentMessage.Role.USER);
        user.setContent(content);
        AgentMessage asst = new AgentMessage();
        asst.setRole(AgentMessage.Role.ASSISTANT);
        asst.setContent(content);
        AgentMessage tool = new AgentMessage();
        tool.setRole(AgentMessage.Role.TOOL);
        tool.setContent(content);

        assertThat(agentService.toAnthropicMessage(user).get("role").asText()).isEqualTo("user");
        assertThat(agentService.toAnthropicMessage(asst).get("role").asText()).isEqualTo("assistant");
        // TOOL turns serialize as role=user with tool_result blocks per Anthropic spec.
        assertThat(agentService.toAnthropicMessage(tool).get("role").asText()).isEqualTo("user");
        assertThat(agentService.toAnthropicMessage(user).get("content")).isEqualTo(content);
    }
}
