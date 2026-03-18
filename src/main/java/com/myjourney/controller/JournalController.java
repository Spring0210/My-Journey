package com.myjourney.controller;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.JournalService;
import com.myjourney.service.CloudStorageService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.*;
import java.util.Optional;

@RestController
@RequestMapping("/api/entries")
@CrossOrigin
public class JournalController {

    @Autowired
    private JournalService journalService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CloudStorageService cloudStorageService;

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

    @PostMapping("/{userId}")
    public ResponseEntity<JournalEntry> createEntry(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer userId,
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam String entryDate,
            @RequestParam(required = false) MultipartFile[] images
    ) throws IOException {
        Integer jwtUserId = getJwtUserId(authHeader);
        if (jwtUserId == null || !jwtUserId.equals(userId)) {
            return ResponseEntity.status(403).build();
        }

        User user = userRepository.findById(userId).orElseThrow();
        JournalEntry entry = new JournalEntry();
        entry.setTitle(title);
        entry.setContent(content);
        entry.setEntryDate(LocalDate.parse(entryDate));
        entry.setUser(user);

        if (images != null && images.length > 0) {
            List<String> imageUrls = cloudStorageService.uploadFiles(images, "my-journey/journals");
            if (!imageUrls.isEmpty()) {
                entry.setImagePathList(imageUrls);
            }
        }

        return ResponseEntity.ok(journalService.createEntry(entry));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getUserEntries(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Integer jwtUserId = getJwtUserId(authHeader);
        if (jwtUserId == null || !jwtUserId.equals(userId)) {
            return ResponseEntity.status(403).build();
        }
        User user = userRepository.findById(userId).orElseThrow();
        return ResponseEntity.ok(journalService.getEntriesByUserPaged(user, page, size));
    }

    @PostMapping("/edit/{entryId}")
    public ResponseEntity<JournalEntry> editEntry(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer entryId,
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam String entryDate,
            @RequestParam(required = false) MultipartFile[] images
    ) throws IOException {
        Integer jwtUserId = getJwtUserId(authHeader);
        JournalEntry existing = journalService.getEntryById(entryId).orElseThrow();

        if (jwtUserId == null || !jwtUserId.equals(existing.getUser().getId())) {
            return ResponseEntity.status(403).build();
        }

        existing.setTitle(title);
        existing.setContent(content);
        existing.setEntryDate(LocalDate.parse(entryDate));

        if (images != null && images.length > 0) {
            List<String> existingUrls = existing.getImagePathList();
            if (existingUrls == null) existingUrls = new ArrayList<>();
            List<String> newUrls = cloudStorageService.uploadFiles(images, "my-journey/journals");
            existingUrls.addAll(newUrls);
            existing.setImagePathList(existingUrls);
        }

        return ResponseEntity.ok(journalService.createEntry(existing));
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> deleteEntry(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer entryId
    ) throws IOException {
        Integer jwtUserId = getJwtUserId(authHeader);
        JournalEntry entry = journalService.getEntryById(entryId).orElseThrow();

        if (jwtUserId == null || !jwtUserId.equals(entry.getUser().getId())) {
            return ResponseEntity.status(403).build();
        }

        List<String> imageUrls = entry.getImagePathList();
        if (imageUrls != null && !imageUrls.isEmpty()) {
            cloudStorageService.deleteFiles(imageUrls);
        }
        journalService.deleteEntry(entryId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/search")
    public ResponseEntity<List<JournalEntry>> searchEntries(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam Integer userId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String date
    ) {
        Integer jwtUserId = getJwtUserId(authHeader);
        if (jwtUserId == null || !jwtUserId.equals(userId)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(journalService.searchEntries(userId, keyword, date));
    }

    @GetMapping("/calendar/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getCalendarEntries(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer userId
    ) {
        Integer jwtUserId = getJwtUserId(authHeader);
        if (jwtUserId == null || !jwtUserId.equals(userId)) {
            return ResponseEntity.status(403).build();
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<JournalEntry> entries = journalService.getEntriesByUser(user);

        List<Map<String, Object>> events = new ArrayList<>();
        for (JournalEntry entry : entries) {
            Map<String, Object> event = new HashMap<>();
            event.put("id", entry.getId());
            event.put("title", entry.getTitle());
            event.put("start", entry.getEntryDate().toString());
            events.add(event);
        }
        return ResponseEntity.ok(events);
    }

    @GetMapping("/user/{userId}/entries/date/{entryDate}")
    public ResponseEntity<List<JournalEntry>> getEntriesByDate(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer userId,
            @PathVariable String entryDate
    ) {
        Integer jwtUserId = getJwtUserId(authHeader);
        if (jwtUserId == null || !jwtUserId.equals(userId)) {
            return ResponseEntity.status(403).build();
        }
        User user = userRepository.findById(userId).orElseThrow();
        LocalDate date = LocalDate.parse(entryDate);
        return ResponseEntity.ok(journalService.getEntriesByUser(user).stream()
                .filter(e -> e.getEntryDate().equals(date))
                .toList());
    }

    @GetMapping("/entry/{entryId}")
    public ResponseEntity<JournalEntry> getEntryById(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer entryId
    ) {
        Integer jwtUserId = getJwtUserId(authHeader);
        Optional<JournalEntry> entryOpt = journalService.getEntryById(entryId);
        if (entryOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        JournalEntry entry = entryOpt.get();
        if (jwtUserId == null || !jwtUserId.equals(entry.getUser().getId())) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(entry);
    }

    @PostMapping("/delete-image")
    public ResponseEntity<String> deleteImage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, Object> request
    ) {
        try {
            Integer jwtUserId = getJwtUserId(authHeader);
            Integer entryId = (Integer) request.get("entryId");
            String imageUrl = (String) request.get("imagePath");

            JournalEntry entry = journalService.getEntryById(entryId).orElseThrow();

            if (jwtUserId == null || !jwtUserId.equals(entry.getUser().getId())) {
                return ResponseEntity.status(403).body("Forbidden");
            }

            List<String> imageUrls = entry.getImagePathList();
            if (imageUrls.remove(imageUrl)) {
                entry.setImagePathList(imageUrls);
                journalService.createEntry(entry);
                cloudStorageService.deleteFile(imageUrl);
                return ResponseEntity.ok("Image deleted successfully");
            } else {
                return ResponseEntity.badRequest().body("Image not found");
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error deleting image: " + e.getMessage());
        }
    }

    @PostMapping("/add-images/{entryId}")
    public ResponseEntity<JournalEntry> addImagesToEntry(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer entryId,
            @RequestParam("images") MultipartFile[] images
    ) throws IOException {
        try {
            Integer jwtUserId = getJwtUserId(authHeader);
            JournalEntry entry = journalService.getEntryById(entryId).orElseThrow();

            if (jwtUserId == null || !jwtUserId.equals(entry.getUser().getId())) {
                return ResponseEntity.status(403).build();
            }

            List<String> existingUrls = entry.getImagePathList();
            if (existingUrls == null) existingUrls = new ArrayList<>();

            List<String> newUrls = cloudStorageService.uploadFiles(images, "my-journey/journals");
            existingUrls.addAll(newUrls);
            entry.setImagePathList(existingUrls);

            return ResponseEntity.ok(journalService.createEntry(entry));
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }
}
