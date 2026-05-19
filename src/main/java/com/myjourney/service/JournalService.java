package com.myjourney.service;

import com.myjourney.dto.HeatmapPoint;
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

    // Aggregated entry counts per day within a year — feeds the year heatmap.
    public List<HeatmapPoint> getHeatmap(User user, int year) {
        LocalDate start = LocalDate.of(year, 1, 1);
        LocalDate end   = LocalDate.of(year, 12, 31);
        return journalRepository.countEntriesPerDay(user, start, end);
    }

    // AI search: OR across keywords using DB LIKE — deduped by id, sorted newest first
    public List<JournalEntry> searchEntriesByKeywords(Integer userId, List<String> keywords) {
        User user = userRepository.findById(userId).orElseThrow();
        java.util.LinkedHashMap<Integer, JournalEntry> seen = new java.util.LinkedHashMap<>();
        for (String keyword : keywords) {
            for (JournalEntry entry : journalRepository.findByUserAndKeyword(user, keyword)) {
                seen.putIfAbsent(entry.getId(), entry);
            }
        }
        return new ArrayList<>(seen.values());
    }

    // Keyword + date filter search using DB LIKE query
    public List<JournalEntry> searchEntries(Integer userId, String keyword, String date) {
        User user = userRepository.findById(userId).orElseThrow();

        List<JournalEntry> entries = (keyword != null && !keyword.isEmpty())
                ? journalRepository.findByUserAndKeyword(user, keyword)
                : journalRepository.findByUser(user);

        if (date != null && !date.isEmpty()) {
            LocalDate targetDate = LocalDate.parse(date);
            entries = entries.stream()
                    .filter(e -> e.getEntryDate().equals(targetDate))
                    .toList();
        }

        return entries;
    }
}
