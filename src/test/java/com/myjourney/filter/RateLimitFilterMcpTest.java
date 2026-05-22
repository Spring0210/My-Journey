package com.myjourney.filter;

import com.myjourney.model.McpApiToken;
import com.myjourney.model.User;
import com.myjourney.service.McpTokenService;
import com.myjourney.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Verifies the /mcp branch of RateLimitFilter — that requests under the
// per-token cap pass through, that missing/invalid bearers fall through to
// the auth filter unmetered, and that the first request over the cap
// produces 429 with a Retry-After header.
class RateLimitFilterMcpTest {

    private RateLimitFilter filter;
    private McpTokenService tokenService;

    @BeforeEach
    void setup() {
        filter = new RateLimitFilter();
        tokenService = mock(McpTokenService.class);
        ReflectionTestUtils.setField(filter, "mcpTokenService", tokenService);
        ReflectionTestUtils.setField(filter, "jwtUtil", mock(JwtUtil.class));
    }

    @Test
    void requestUnderLimit_passesThrough() throws Exception {
        McpApiToken token = mintToken();
        when(tokenService.verifyToken("mj_good")).thenReturn(Optional.of(token));

        FilterChain chain = mock(FilterChain.class);
        MockHttpServletRequest req = mcpRequest("Bearer mj_good");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain, times(1)).doFilter(req, res);
        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void missingBearer_fallsThroughUnmetered() throws Exception {
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletRequest req = mcpRequest(null);
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        // Filter should not even attempt token verification on a missing bearer
        // — that's the auth filter's job.
        verify(tokenService, never()).verifyToken(any());
    }

    @Test
    void invalidBearer_fallsThroughUnmetered() throws Exception {
        when(tokenService.verifyToken(any())).thenReturn(Optional.empty());
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletRequest req = mcpRequest("Bearer mj_expired");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
        // 401 is the auth filter's responsibility.
        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void exceedingPerTokenLimit_returns429WithRetryAfter() throws Exception {
        McpApiToken token = mintToken();
        when(tokenService.verifyToken("mj_good")).thenReturn(Optional.of(token));

        // Per-token cap is 60/min. Consume all 60 to deplete the bucket, then
        // assert the 61st request fails with 429.
        for (int i = 0; i < 60; i++) {
            MockHttpServletRequest req = mcpRequest("Bearer mj_good");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, mock(FilterChain.class));
            assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
        }

        FilterChain blocked = mock(FilterChain.class);
        MockHttpServletRequest req = mcpRequest("Bearer mj_good");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, blocked);

        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(res.getHeader("Retry-After")).isNotNull();
        assertThat(Integer.parseInt(res.getHeader("Retry-After"))).isGreaterThanOrEqualTo(1);
        verify(blocked, never()).doFilter(any(), any());
    }

    // -- helpers -----------------------------------------------------------

    private static McpApiToken mintToken() {
        User u = new User();
        u.setId(7);
        McpApiToken t = new McpApiToken();
        t.setId(42L);
        t.setUser(u);
        return t;
    }

    private static MockHttpServletRequest mcpRequest(String authHeader) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/mcp");
        req.setRequestURI("/mcp");
        if (authHeader != null) req.addHeader("Authorization", authHeader);
        return req;
    }
}
