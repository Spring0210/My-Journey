package com.myjourney.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.service.McpTokenService;
import com.myjourney.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = McpTokenController.class)
@WithMockUser
class McpTokenControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;

    @MockBean private McpTokenService tokenService;
    @MockBean private McpAccessLogRepository logRepo;
    @MockBean private com.myjourney.repository.UserRepository userRepo;
    @MockBean private JwtUtil jwtUtil;

    @BeforeEach
    void stubAuth() {
        when(jwtUtil.extractUserIdFromHeader(any())).thenReturn(7);
    }

    @Test
    void createToken_returnsRawTokenOnce() throws Exception {
        User u = new User(); u.setId(7);
        McpApiToken saved = new McpApiToken();
        saved.setId(42L); saved.setUser(u); saved.setName("Claude Desktop");
        saved.setPrefix("mj_abcde"); saved.setCreatedAt(LocalDateTime.now());
        saved.setExpiredAt(LocalDateTime.now().plusDays(30));
        when(tokenService.createToken(7, "Claude Desktop", 30))
                .thenReturn(new McpTokenService.CreatedToken(saved, "mj_rawvalue123"));

        mvc.perform(post("/api/profile/mcp/tokens")
                        .header("Authorization", "Bearer jwt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Claude Desktop\",\"expiryDays\":30}")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rawToken").value("mj_rawvalue123"))
                .andExpect(jsonPath("$.token.id").value(42));
    }

    @Test
    void listTokens_neverIncludesRawValue() throws Exception {
        User u = new User(); u.setId(7);
        McpApiToken t = new McpApiToken();
        t.setId(42L); t.setUser(u); t.setName("Claude Desktop");
        t.setPrefix("mj_abcde"); t.setCreatedAt(LocalDateTime.now());
        t.setExpiredAt(LocalDateTime.now().plusDays(30));
        when(tokenService.listTokens(7)).thenReturn(List.of(t));

        mvc.perform(get("/api/profile/mcp/tokens").header("Authorization", "Bearer jwt"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].prefix").value("mj_abcde"))
                .andExpect(jsonPath("$[0].rawToken").doesNotExist())
                .andExpect(jsonPath("$[0].tokenHash").doesNotExist());
    }

    @Test
    void revokeToken_delegatesAndReturns204() throws Exception {
        mvc.perform(delete("/api/profile/mcp/tokens/42")
                        .header("Authorization", "Bearer jwt")
                        .with(csrf()))
                .andExpect(status().isNoContent());
        verify(tokenService).revokeToken(7, 42L);
    }

    @Test
    void activity_returnsLast50() throws Exception {
        User u = new User(); u.setId(7);
        when(userRepo.findById(eq(7))).thenReturn(java.util.Optional.of(u));
        when(logRepo.findRecentByUser(eq(u), any())).thenReturn(List.of());

        mvc.perform(get("/api/profile/mcp/activity").header("Authorization", "Bearer jwt"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
