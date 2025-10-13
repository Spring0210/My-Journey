package com.myjourney.controller;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.JournalService;
import com.myjourney.service.CloudStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.*;

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

    @PostMapping("/{userId}")
    public JournalEntry createEntry(
            @PathVariable Integer userId,
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam String entryDate,
            @RequestParam(required = false) MultipartFile[] images
    ) throws IOException {
        try {
            User user = userRepository.findById(userId).orElseThrow();
            JournalEntry entry = new JournalEntry();
            entry.setTitle(title);
            entry.setContent(content);
            entry.setEntryDate(LocalDate.parse(entryDate));
            entry.setUser(user);

            if (images != null && images.length > 0) {
                System.out.println("Uploading " + images.length + " images to Cloudinary...");
                List<String> imageUrls = cloudStorageService.uploadFiles(images, "my-journey/journals");
                System.out.println("Uploaded images URLs: " + imageUrls);
                if (!imageUrls.isEmpty()) {
                    entry.setImagePathList(imageUrls);
                }
            }

            JournalEntry savedEntry = journalService.createEntry(entry);
            System.out.println("Entry saved successfully with ID: " + savedEntry.getId());
            return savedEntry;
        } catch (Exception e) {
            System.err.println("Error creating entry: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    //Get all entries of the user
    @GetMapping("/{userId}")
    public List<JournalEntry> getUserEntries(@PathVariable Integer userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return journalService.getEntriesByUser(user);
    }

    //Modify entry
    @PostMapping("/edit/{entryId}")
    public JournalEntry editEntry(
            @PathVariable Integer entryId,
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam String entryDate,
            @RequestParam(required = false) MultipartFile[] images
    ) throws IOException {
        JournalEntry existing = journalService.getEntryById(entryId).orElseThrow();

        existing.setTitle(title);
        existing.setContent(content);
        existing.setEntryDate(LocalDate.parse(entryDate));

        if (images != null && images.length > 0) {
            // Delete old images from cloud storage
            List<String> oldUrls = existing.getImagePathList();
            if (oldUrls != null && !oldUrls.isEmpty()) {
                cloudStorageService.deleteFiles(oldUrls);
            }
            
            // Upload new images to cloud storage
            List<String> imageUrls = cloudStorageService.uploadFiles(images, "my-journey/journals");
            if (!imageUrls.isEmpty()) {
                existing.setImagePathList(imageUrls);
            } else {
                existing.setImagePaths(null);
            }
        }

        return journalService.createEntry(existing); // save
    }

    //Delete entry
    @DeleteMapping("/{entryId}")
    public void deleteEntry(@PathVariable Integer entryId) throws IOException {
        JournalEntry entry = journalService.getEntryById(entryId).orElseThrow();
        
        // Delete all related images from cloud storage
        List<String> imageUrls = entry.getImagePathList();
        if (imageUrls != null && !imageUrls.isEmpty()) {
            cloudStorageService.deleteFiles(imageUrls);
        }
        
        journalService.deleteEntry(entryId);
    }

    @GetMapping("/search")
    public List<JournalEntry> searchEntries(@RequestParam Integer userId, @RequestParam(required = false) String keyword, @RequestParam(required = false) String date) {
        return journalService.searchEntries(userId, keyword, date);
    }

    //Calendar
    @GetMapping("/calendar/{userId}")
    public List<Map<String, Object>> getCalendarEntries(@PathVariable Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<JournalEntry> entries = journalService.getEntriesByUser(user);

        List<Map<String, Object>> events = new ArrayList<>();

        for (JournalEntry entry : entries) {
            Map<String, Object> event = new HashMap<>();
            event.put("id", entry.getId());
            event.put("title", entry.getTitle());
            event.put("start", entry.getEntryDate().toString()); // required by FullCalendar
            events.add(event);
        }

        return events;
    }

    // Get all journal entries for a specific user on a specific date
    @GetMapping("/user/{userId}/entries/date/{entryDate}")
    public List<JournalEntry> getEntriesByDate(
            @PathVariable Integer userId,
            @PathVariable String entryDate
    ) {
        User user = userRepository.findById(userId).orElseThrow();
        LocalDate date = LocalDate.parse(entryDate);
        return journalService.getEntriesByUser(user).stream()
                .filter(e -> e.getEntryDate().equals(date))
                .toList();
    }

    // Get a single entry by its id (avoid conflict with /api/entries/{userId})
    @GetMapping("/entry/{entryId}")
    public ResponseEntity<JournalEntry> getEntryById(@PathVariable Integer entryId) {
        return journalService.getEntryById(entryId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Delete single image
    @PostMapping("/delete-image")
    public ResponseEntity<String> deleteImage(@RequestBody Map<String, Object> request) {
        try {
            Integer entryId = (Integer) request.get("entryId");
            String imageUrl = (String) request.get("imagePath");
            
            JournalEntry entry = journalService.getEntryById(entryId).orElseThrow();
            List<String> imageUrls = entry.getImagePathList();
            
            if (imageUrls.remove(imageUrl)) {
                entry.setImagePathList(imageUrls);
                journalService.createEntry(entry);
                
                // Delete image from cloud storage
                cloudStorageService.deleteFile(imageUrl);
                
                return ResponseEntity.ok("Image deleted successfully");
            } else {
                return ResponseEntity.badRequest().body("Image not found");
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error deleting image: " + e.getMessage());
        }
    }

    // Add images to existing entry
    @PostMapping("/add-images/{entryId}")
    public ResponseEntity<JournalEntry> addImagesToEntry(
            @PathVariable Integer entryId,
            @RequestParam("images") MultipartFile[] images
    ) throws IOException {
        try {
            JournalEntry entry = journalService.getEntryById(entryId).orElseThrow();
            List<String> existingUrls = entry.getImagePathList();
            
            List<String> newUrls = cloudStorageService.uploadFiles(images, "my-journey/journals");
            
            existingUrls.addAll(newUrls);
            entry.setImagePathList(existingUrls);
            
            return ResponseEntity.ok(journalService.createEntry(entry));
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

}
