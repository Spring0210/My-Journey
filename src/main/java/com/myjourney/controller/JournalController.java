package com.myjourney.controller;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.JournalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
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

    @PostMapping("/{userId}")
    public JournalEntry createEntry(
            @PathVariable Integer userId,
            @RequestParam String title,
            @RequestParam String content,
            @RequestParam String entryDate,
            @RequestParam(required = false) MultipartFile image
    ) throws IOException {
        User user = userRepository.findById(userId).orElseThrow();
        JournalEntry entry = new JournalEntry();
        entry.setTitle(title);
        entry.setContent(content);
        entry.setEntryDate(LocalDate.parse(entryDate));
        entry.setUser(user);

        if (image != null && !image.isEmpty()) {
            String filename = System.currentTimeMillis() + "_" + image.getOriginalFilename();
            Path path = Paths.get("uploads", filename);
            Files.copy(image.getInputStream(), path);
            entry.setImagePath("/uploads/" + filename);
        }

        return journalService.createEntry(entry);
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
            @RequestParam(required = false) MultipartFile image
    ) throws IOException {
        JournalEntry existing = journalService.getEntryById(entryId).orElseThrow();

        existing.setTitle(title);
        existing.setContent(content);
        existing.setEntryDate(LocalDate.parse(entryDate));

        if (image != null && !image.isEmpty()) {
            String filename = System.currentTimeMillis() + "_" + image.getOriginalFilename();
            Path path = Paths.get("uploads").resolve(filename);
            if (!Files.exists(path.getParent())) {
                Files.createDirectories(path.getParent());
            }
            Files.copy(image.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
            existing.setImagePath("/uploads/" + filename);
        }

        return journalService.createEntry(existing); // save
    }

    //Delete entry
    @DeleteMapping("/{entryId}")
    public void deleteEntry(@PathVariable Integer entryId) {
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



}
