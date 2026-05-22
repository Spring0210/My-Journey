package com.myjourney.filter;

import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.service.McpTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class McpAuthenticationFilterTest {

    @AfterEach
    void clearCtx() { SecurityContextHolder.clearContext(); }

    @Test
    void validToken_setsSecurityContextAndContinues() throws Exception {
        McpTokenService svc = mock(McpTokenService.class);
        User u = new User(); u.setId(7);
        McpApiToken t = new McpApiToken(); t.setId(42L); t.setUser(u);
        when(svc.verifyToken("mj_good")).thenReturn(Optional.of(t));

        McpAuthenticationFilter filter = new McpAuthenticationFilter(svc);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.addHeader("Authorization", "Bearer mj_good");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();

        filter.doFilter(req, res, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
                .isEqualTo("7");
        assertThat(req.getAttribute(McpAuthenticationFilter.ATTR_TOKEN_ID)).isEqualTo(42L);
        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void missingHeader_returns401() throws Exception {
        McpTokenService svc = mock(McpTokenService.class);
        McpAuthenticationFilter filter = new McpAuthenticationFilter(svc);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        verifyNoInteractions(chain);
    }

    @Test
    void expiredOrUnknownToken_returns401() throws Exception {
        McpTokenService svc = mock(McpTokenService.class);
        when(svc.verifyToken(any())).thenReturn(Optional.empty());
        McpAuthenticationFilter filter = new McpAuthenticationFilter(svc);

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.addHeader("Authorization", "Bearer mj_expired");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        verifyNoInteractions(chain);
    }

    @Test
    void nonMcpPath_skipsAuth() throws Exception {
        McpTokenService svc = mock(McpTokenService.class);
        McpAuthenticationFilter filter = new McpAuthenticationFilter(svc);

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/spaces");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        verifyNoInteractions(svc);
    }
}
