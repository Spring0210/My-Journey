package com.myjourney.filter;

import com.myjourney.model.McpApiToken;
import com.myjourney.service.McpTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Optional;

// Authenticates requests to /mcp using long-lived API tokens (mj_<...>).
// Mirrors JwtAuthenticationFilter in shape but lives on a separate path so
// the JWT filter doesn't have to know about token formats. On success,
// populates SecurityContext with the user id (matches the convention the
// rest of the app already uses) and stashes the token id on the request as
// an attribute so the McpToolBridge can use it for audit logging without a
// second DB hit.
@Component
public class McpAuthenticationFilter extends OncePerRequestFilter {

    public static final String ATTR_TOKEN_ID = "com.myjourney.mcp.tokenId";

    private final McpTokenService tokenService;

    public McpAuthenticationFilter(McpTokenService tokenService) {
        this.tokenService = tokenService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.equals("/mcp") && !path.startsWith("/mcp/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            unauthorized(response, "Missing bearer token");
            return;
        }
        String raw = header.substring(7).trim();
        Optional<McpApiToken> maybe = tokenService.verifyToken(raw);
        if (maybe.isEmpty()) {
            unauthorized(response, "Invalid or expired token");
            return;
        }
        McpApiToken token = maybe.get();
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                String.valueOf(token.getUser().getId()), null, new ArrayList<>());
        SecurityContextHolder.getContext().setAuthentication(auth);
        request.setAttribute(ATTR_TOKEN_ID, token.getId());
        chain.doFilter(request, response);
    }

    private static void unauthorized(HttpServletResponse res, String msg) throws IOException {
        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"" + msg.replace("\"","\\\"") + "\"}");
    }
}
