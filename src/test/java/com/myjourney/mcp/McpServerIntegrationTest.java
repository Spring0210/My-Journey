package com.myjourney.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.McpApiTokenRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.McpTokenService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

// Boots the full app on a random port and round-trips a real MCP handshake
// (initialize -> tools/list) over HTTP using a freshly minted token. This is
// the only test that exercises the McpAuthenticationFilter + JSON-RPC
// controller + ToolDispatcher end-to-end.
//
// Tests share the developer's MySQL; each test creates its own user +
// token, and @AfterEach deletes everything we made so repeated runs don't
// pollute the schema.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class McpServerIntegrationTest {

    @LocalServerPort private int port;
    @Autowired private McpTokenService tokenService;
    @Autowired private UserRepository userRepo;
    @Autowired private McpApiTokenRepository tokenRepo;
    @Autowired private McpAccessLogRepository logRepo;
    @Autowired private SpaceRepository spaceRepo;
    @Autowired private SpaceMemberRepository memberRepo;
    @Autowired private ObjectMapper mapper;

    private User createdUser;
    private McpApiToken createdToken;

    @AfterEach
    void cleanup() {
        if (createdToken != null) {
            logRepo.deleteAll(logRepo.findByTokenOrderByCalledAtDesc(
                    createdToken, PageRequest.of(0, 1000)).getContent());
            tokenRepo.deleteById(createdToken.getId());
            createdToken = null;
        }
        if (createdUser != null) {
            // Personal space + member row are created lazily on first login;
            // the integration test never logs in so there shouldn't be any.
            // Be defensive in case future code changes that.
            memberRepo.findSpaceIdsByUser(createdUser).forEach(sid ->
                spaceRepo.findById(sid).ifPresent(s -> {
                    memberRepo.deleteAll(memberRepo.findBySpace(s));
                    spaceRepo.delete(s);
                }));
            userRepo.deleteById(createdUser.getId());
            createdUser = null;
        }
    }

    @Test
    void initializeThenToolsList_returnsAllNineTools() throws Exception {
        User u = new User();
        u.setUsername("mcp-itest-" + System.nanoTime());
        u.setEmail(u.getUsername() + "@example.com");
        u.setPassword("x");
        createdUser = userRepo.save(u);
        McpTokenService.CreatedToken ct = tokenService.createToken(
                createdUser.getId(), "itest", 30);
        createdToken = ct.token();

        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.set("Authorization", "Bearer " + ct.rawToken());

        RestTemplate rt = new RestTemplate();
        String initBody = """
                {"jsonrpc":"2.0","id":1,"method":"initialize",
                 "params":{"protocolVersion":"2025-03-26","capabilities":{},
                           "clientInfo":{"name":"itest","version":"0"}}}
                """;
        ResponseEntity<String> initRes = rt.exchange(
                "http://localhost:" + port + "/mcp",
                HttpMethod.POST, new HttpEntity<>(initBody, h), String.class);
        assertThat(initRes.getStatusCode().value()).isEqualTo(200);
        assertThat(mapper.readTree(initRes.getBody()).at("/result/protocolVersion").asText())
                .isEqualTo("2025-03-26");

        String listBody = """
                {"jsonrpc":"2.0","id":2,"method":"tools/list"}
                """;
        ResponseEntity<String> listRes = rt.exchange(
                "http://localhost:" + port + "/mcp",
                HttpMethod.POST, new HttpEntity<>(listBody, h), String.class);
        assertThat(listRes.getStatusCode().value()).isEqualTo(200);
        JsonNode tools = mapper.readTree(listRes.getBody()).at("/result/tools");
        assertThat(tools.size()).isEqualTo(9);
    }

    @Test
    void missingBearer_returns401() {
        RestTemplate rt = new RestTemplate();
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        try {
            rt.exchange("http://localhost:" + port + "/mcp",
                    HttpMethod.POST,
                    new HttpEntity<>("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}", h),
                    String.class);
            fail("expected 401");
        } catch (HttpClientErrorException e) {
            assertThat(e.getStatusCode().value()).isEqualTo(401);
        }
    }
}
