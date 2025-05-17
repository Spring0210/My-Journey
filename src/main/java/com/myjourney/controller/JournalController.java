package com.myjourney.controller;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.JournalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.List;

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


    @GetMapping("/{userId}")
    public List<JournalEntry> getUserEntries(@PathVariable Integer userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return journalService.getEntriesByUser(user);
    }

    //Modify Journal
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

    @DeleteMapping("/{entryId}")
    public void deleteEntry(@PathVariable Integer entryId) {
        journalService.deleteEntry(entryId);
    }

    @GetMapping("/search")
    public List<JournalEntry> searchEntries(@RequestParam Integer userId, @RequestParam(required = false) String keyword, @RequestParam(required = false) String date) {
        return journalService.searchEntries(userId, keyword, date);
    }
}
