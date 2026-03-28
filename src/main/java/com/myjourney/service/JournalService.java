package com.myjourney.service;

import com.myjourney.dto.PageResponse;
import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import com.myjourney.repository.JournalRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class JournalService {

    @Autowired
    private JournalRepository journalRepository;

    @Autowired
    private UserRepository userRepository;

    public JournalEntry createEntry(JournalEntry journalEntry) {
        return journalRepository.save(journalEntry);
    }

    public List<JournalEntry> getEntriesByUser(User user) {
        return journalRepository.findByUser(user);
    }

    public PageResponse<JournalEntry> getEntriesByUserPaged(User user, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "entryDate"));
        Page<JournalEntry> result = journalRepository.findByUser(user, pageable);

        return new PageResponse<>(
                result.getContent(),
                result.getTotalPages(),
                result.getTotalElements(),
                result.getNumber());
    }

    public Optional<JournalEntry> getEntryById(Integer id) {
        return journalRepository.findById(id);
    }

    public void deleteEntry(Integer id) {
        journalRepository.deleteById(id);
    }

    // Fetch entries within a month range for AI recap
    public List<JournalEntry> getEntriesByUserAndDateRange(User user, LocalDate start, LocalDate end) {
        return journalRepository.findByUserAndEntryDateBetweenOrderByEntryDateAsc(user, start, end);
    }

    // Search entries matching ANY of the given keywords (OR logic, deduped, sorted newest first)
    public List<JournalEntry> searchEntriesByKeywords(Integer userId, List<String> keywords) {
        User user = userRepository.findById(userId).orElseThrow();
        List<JournalEntry> all = journalRepository.findByUser(user);

        // Collect IDs already added to avoid duplicates while preserving order
        java.util.Set<Integer> seen = new java.util.LinkedHashSet<>();
        List<JournalEntry> results = new ArrayList<>();

        for (String keyword : keywords) {
            String lower = keyword.toLowerCase();
            for (JournalEntry entry : all) {
                if (seen.contains(entry.getId())) continue;
                boolean titleMatch   = entry.getTitle()   != null && entry.getTitle().toLowerCase().contains(lower);
                boolean contentMatch = entry.getContent() != null && entry.getContent().toLowerCase().contains(lower);
                if (titleMatch || contentMatch) {
                    seen.add(entry.getId());
                    results.add(entry);
                }
            }
        }

        // Sort newest first
        results.sort((a, b) -> b.getEntryDate().compareTo(a.getEntryDate()));
        return results;
    }

    public List<JournalEntry> searchEntries(Integer userId, String keyword, String date) {
        User user = userRepository.findById(userId).orElseThrow();

        List<JournalEntry> entries = journalRepository.findByUser(user);

        if (keyword != null && !keyword.isEmpty()) {
            entries = entries.stream()
                    .filter(e -> e.getTitle().toLowerCase().contains(keyword.toLowerCase()) ||
                            e.getContent().toLowerCase().contains(keyword.toLowerCase()))
                    .toList();
        }

        if (date != null && !date.isEmpty()) {
            LocalDate targetDate = LocalDate.parse(date);
            entries = entries.stream()
                    .filter(e -> e.getEntryDate().equals(targetDate))
                    .toList();
        }

        return entries;
    }
}
