package com.myjourney.controller;

import com.myjourney.dto.PageResponse;
import com.myjourney.dto.PostResponse;
import com.myjourney.dto.ReactionSummary;
import com.myjourney.service.CloudStorageService;
import com.myjourney.service.SpacePostReactionService;
import com.myjourney.service.SpacePostService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/spaces/{spaceId}/posts")
@CrossOrigin
public class SpacePostController {

    @Autowired
    private SpacePostService spacePostService;

    @Autowired
    private CloudStorageService cloudStorageService;

    @Autowired
    private SpacePostReactionService reactionService;

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

    // POST /api/spaces/{spaceId}/posts — create a post
    @PostMapping
    public ResponseEntity<PostResponse> createPost(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @RequestParam(required = false) String content,
            @RequestParam(required = false) MultipartFile[] images
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        List<String> imageUrls = new ArrayList<>();
        if (images != null && images.length > 0) {
            imageUrls = cloudStorageService.uploadFiles(images, "my-journey/spaces/" + spaceId);
        }

        // AppException thrown by service is caught by GlobalExceptionHandler
        return ResponseEntity.ok(spacePostService.createPost(spaceId, userId, content, imageUrls));
    }

    // GET /api/spaces/{spaceId}/posts — get posts (paginated)
    @GetMapping
    public ResponseEntity<PageResponse<PostResponse>> getPosts(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(spacePostService.getPosts(spaceId, userId, page, size));
    }

    // DELETE /api/spaces/{spaceId}/posts/{postId} — delete a post
    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> deletePost(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @PathVariable Integer postId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        // Cloudinary cleanup is now handled inside the service
        spacePostService.deletePost(postId, userId);
        return ResponseEntity.ok().build();
    }

    // POST /api/spaces/{spaceId}/posts/{postId}/reaction — add or switch emoji reaction
    @PostMapping("/{postId}/reaction")
    public ResponseEntity<ReactionSummary> addReaction(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @PathVariable Integer postId,
            @RequestBody Map<String, String> body
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        String emoji = body.get("emoji");
        if (emoji == null || emoji.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(reactionService.addOrUpdateReaction(postId, userId, emoji));
    }

    // DELETE /api/spaces/{spaceId}/posts/{postId}/reaction — remove the user's reaction
    @DeleteMapping("/{postId}/reaction")
    public ResponseEntity<ReactionSummary> removeReaction(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @PathVariable Integer postId
    ) {
        Integer userId = getJwtUserId(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        return ResponseEntity.ok(reactionService.removeReaction(postId, userId));
    }
}
