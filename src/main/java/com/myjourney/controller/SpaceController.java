package com.myjourney.controller;

import com.myjourney.service.SpaceService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/spaces")
@CrossOrigin
public class SpaceController {

    @Autowired
    private SpaceService spaceService;

    @Autowired
    private JwtUtil jwtUtil;

    private Integer getJwtUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        try {
            return jwtUtil.extractUserId(authHeader.substring(7));
        } catch (Exception e) {
            return null;
        }
    }

    // POST /api/spaces — create a new space
    @PostMapping
    public ResponseEntity<Map<String, Object>> createSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Space name is required"));
        }

        Map<String, Object> result = spaceService.createSpace(userId, name, body.get("description"));
        if (result.containsKey("error")) return ResponseEntity.badRequest().body(result);
        return ResponseEntity.ok(result);
    }

    // POST /api/spaces/join — join via invite code
    @PostMapping("/join")
    public ResponseEntity<Map<String, Object>> joinSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        String inviteCode = body.get("inviteCode");
        if (inviteCode == null || inviteCode.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invite code is required"));
        }

        Map<String, Object> result = spaceService.joinSpace(userId, inviteCode);
        if (result.containsKey("error")) return ResponseEntity.badRequest().body(result);
        return ResponseEntity.ok(result);
    }

    // GET /api/spaces — get all spaces the current user belongs to
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getMySpaces(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(spaceService.getMySpaces(userId));
    }

    // GET /api/spaces/{spaceId} — get space detail (members only)
    @GetMapping("/{spaceId}")
    public ResponseEntity<Map<String, Object>> getSpaceDetail(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        Map<String, Object> result = spaceService.getSpaceDetail(spaceId, userId);
        if (result.containsKey("error")) {
            String error = (String) result.get("error");
            if (error.equals("Access denied")) return ResponseEntity.status(403).body(result);
            if (error.equals("Space not found")) return ResponseEntity.status(404).body(result);
        }
        return ResponseEntity.ok(result);
    }

    // POST /api/spaces/{spaceId}/leave — leave a space
    @PostMapping("/{spaceId}/leave")
    public ResponseEntity<Map<String, Object>> leaveSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        Map<String, Object> result = spaceService.leaveSpace(spaceId, userId);
        if (result.containsKey("error")) return ResponseEntity.badRequest().body(result);
        return ResponseEntity.ok(result);
    }

    // DELETE /api/spaces/{spaceId} — delete a space (owner only)
    @DeleteMapping("/{spaceId}")
    public ResponseEntity<Map<String, Object>> deleteSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        Map<String, Object> result = spaceService.deleteSpace(spaceId, userId);
        if (result.containsKey("error")) return ResponseEntity.status(403).body(result);
        return ResponseEntity.ok(result);
    }
}
