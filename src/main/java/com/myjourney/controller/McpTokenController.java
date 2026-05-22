package com.myjourney.controller;

import com.myjourney.dto.mcp.CreateMcpTokenRequest;
import com.myjourney.dto.mcp.McpAccessLogResponse;
import com.myjourney.dto.mcp.McpTokenCreatedResponse;
import com.myjourney.dto.mcp.McpTokenResponse;
import com.myjourney.exception.AppException;
import com.myjourney.repository.McpAccessLogRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.McpTokenService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/profile/mcp")
@CrossOrigin
public class McpTokenController {

    private static final int ACTIVITY_PAGE_SIZE = 50;

    @Autowired private McpTokenService tokenService;
    @Autowired private McpAccessLogRepository logRepo;
    @Autowired private UserRepository userRepo;
    @Autowired private JwtUtil jwtUtil;

    @PostMapping("/tokens")
    public ResponseEntity<McpTokenCreatedResponse> create(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody CreateMcpTokenRequest req) {
        Integer userId = requireUser(auth);
        int days = req.expiryDays() == null ? 30 : req.expiryDays();
        McpTokenService.CreatedToken created = tokenService.createToken(userId, req.name(), days);
        return ResponseEntity.ok(new McpTokenCreatedResponse(
                McpTokenResponse.from(created.token()), created.rawToken()));
    }

    @GetMapping("/tokens")
    public ResponseEntity<List<McpTokenResponse>> list(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        Integer userId = requireUser(auth);
        return ResponseEntity.ok(tokenService.listTokens(userId).stream()
                .map(McpTokenResponse::from).toList());
    }

    @DeleteMapping("/tokens/{id}")
    public ResponseEntity<Void> revoke(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable Long id) {
        Integer userId = requireUser(auth);
        tokenService.revokeToken(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/activity")
    public ResponseEntity<List<McpAccessLogResponse>> activity(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        Integer userId = requireUser(auth);
        var user = userRepo.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        var rows = logRepo.findRecentByUser(user, PageRequest.of(0, ACTIVITY_PAGE_SIZE));
        return ResponseEntity.ok(rows.stream().map(McpAccessLogResponse::from).toList());
    }

    private Integer requireUser(String authHeader) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) throw new AppException(HttpStatus.UNAUTHORIZED, "Auth required");
        return userId;
    }
}
