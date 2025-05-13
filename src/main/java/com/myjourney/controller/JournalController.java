package com.myjourney.controller;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.JournalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

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
    public JournalEntry createEntry(@PathVariable Integer userId, @RequestBody JournalEntry entry) {
        User user = userRepository.findById(userId).orElseThrow();
        entry.setUser(user);
        return journalService.createEntry(entry);
    }

    @GetMapping("/{userId}")
    public List<JournalEntry> getUserEntries(@PathVariable Integer userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return journalService.getEntriesByUser(user);
    }

    //Modify Journal
    @PutMapping("/{entryId}")
    public JournalEntry updateEntry(@PathVariable Integer entryId, @RequestBody JournalEntry updatedEntry) {
        JournalEntry existing = journalService.getEntryById(entryId).orElseThrow();
        existing.setTitle(updatedEntry.getTitle());
        existing.setContent(updatedEntry.getContent());
        return journalService.createEntry(existing);
    }

    @DeleteMapping("/{entryId}")
    public void deleteEntry(@PathVariable Integer entryId) {
        journalService.deleteEntry(entryId);
    }

}
