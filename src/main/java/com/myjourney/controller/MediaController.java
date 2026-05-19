package com.myjourney.controller;

import com.myjourney.dto.MediaPageResponse;
import com.myjourney.service.MediaService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/media — paginated feed of the current user's uploaded media,
 * unioned across their journal entries and their own Space posts.
 *
 * Query params:
 *   - type   : ALL | IMAGE | VIDEO   (default ALL)
 *   - cursor : opaque "YYYY-MM-DD_id" from a previous page's nextCursor
 *   - limit  : 1–200 (default 60)
 */
@RestController
@RequestMapping("/api/media")
@CrossOrigin
public class MediaController {

    @Autowired
    private MediaService mediaService;

    @Autowired
    private JwtUtil jwtUtil;

    @GetMapping
    public ResponseEntity<?> list(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "type",   required = false) String type,
            @RequestParam(value = "cursor", required = false) String cursor,
            @RequestParam(value = "limit",  required = false) Integer limit
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        try {
            MediaPageResponse page = mediaService.fetchPage(userId, type, cursor, limit);
            return ResponseEntity.ok(page);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
