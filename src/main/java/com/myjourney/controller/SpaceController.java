package com.myjourney.controller;

import com.myjourney.dto.SpaceDetailResponse;
import com.myjourney.dto.SpaceResponse;
import com.myjourney.dto.SpaceSummaryResponse;
import com.myjourney.service.SpaceService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        try {
            return jwtUtil.extractUserId(authHeader.substring(7));
        } catch (Exception e) {
            return null;
        }
    }

    // POST /api/spaces — create a new space
    @PostMapping
    public ResponseEntity<SpaceResponse> createSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        String name = body.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // AppException thrown by service is caught by GlobalExceptionHandler
        return ResponseEntity.ok(spaceService.createSpace(userId, name, body.get("description")));
    }

    // POST /api/spaces/join — join via invite code
    @PostMapping("/join")
    public ResponseEntity<SpaceResponse> joinSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        String inviteCode = body.get("inviteCode");
        if (inviteCode == null || inviteCode.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(spaceService.joinSpace(userId, inviteCode));
    }

    // GET /api/spaces — get all spaces the current user belongs to
    @GetMapping
    public ResponseEntity<List<SpaceSummaryResponse>> getMySpaces(
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(spaceService.getMySpaces(userId));
    }

    // GET /api/spaces/{spaceId} — get space detail (members only)
    @GetMapping("/{spaceId}")
    public ResponseEntity<SpaceDetailResponse> getSpaceDetail(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(spaceService.getSpaceDetail(spaceId, userId));
    }

    // PUT /api/spaces/{spaceId} — update space info (owner only)
    @PutMapping("/{spaceId}")
    public ResponseEntity<SpaceResponse> updateSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @RequestBody Map<String, String> body
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(spaceService.updateSpace(spaceId, userId, body.get("name"), body.get("description")));
    }

    // PUT /api/spaces/{spaceId}/cover — upload cover image (owner only)
    @PutMapping("/{spaceId}/cover")
    public ResponseEntity<SpaceResponse> updateCoverImage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @RequestParam("file") MultipartFile file
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(spaceService.updateCoverImage(spaceId, userId, file));
    }

    // DELETE /api/spaces/{spaceId}/members/{memberId} — kick a member (owner only)
    @DeleteMapping("/{spaceId}/members/{memberId}")
    public ResponseEntity<Void> kickMember(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @PathVariable Integer memberId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        spaceService.kickMember(spaceId, userId, memberId);
        return ResponseEntity.ok().build();
    }

    // POST /api/spaces/{spaceId}/leave — leave a space
    @PostMapping("/{spaceId}/leave")
    public ResponseEntity<Void> leaveSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        spaceService.leaveSpace(spaceId, userId);
        return ResponseEntity.ok().build();
    }

    // POST /api/spaces/{spaceId}/ai-summary — generate AI recap of recent activity (all members)
    @PostMapping("/{spaceId}/ai-summary")
    public ResponseEntity<Map<String, String>> generateAiSummary(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        String summary = spaceService.generateAiSummary(spaceId, userId);
        return ResponseEntity.ok(Map.of("summary", summary));
    }

    // DELETE /api/spaces/{spaceId} — delete a space (owner only)
    @DeleteMapping("/{spaceId}")
    public ResponseEntity<Void> deleteSpace(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        spaceService.deleteSpace(spaceId, userId);
        return ResponseEntity.ok().build();
    }
}
