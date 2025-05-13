package com.myjourney.service;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import com.myjourney.repository.JournalRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class JournalService {

    @Autowired
    private JournalRepository journalRepository;

    public JournalEntry createEntry(JournalEntry journalEntry) {
        return journalRepository.save(journalEntry);
    }

    public List<JournalEntry> getEntriesByUser(User user) {
        return  journalRepository.findByUser(user);
    }

    public Optional<JournalEntry> getEntryById(Integer id) {
        return journalRepository.findById(id);
    }

    public void deleteEntry(Integer id) {
        journalRepository.deleteById(id);
    }
}
