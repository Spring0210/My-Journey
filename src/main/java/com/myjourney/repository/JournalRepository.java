package com.myjourney.repository;

import com.myjourney.dto.HeatmapPoint;
import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface JournalRepository extends JpaRepository<JournalEntry, Integer> {
    List<JournalEntry> findByUser(User user);
    Page<JournalEntry> findByUser(User user, Pageable pageable);
    // Fetch all entries within a date range, ordered chronologically for AI recap
    List<JournalEntry> findByUserAndEntryDateBetweenOrderByEntryDateAsc(
            User user, LocalDate start, LocalDate end);

    // Keyword search in title or content — case-insensitive, DB-level LIKE
    @Query("SELECT e FROM JournalEntry e WHERE e.user = :user AND " +
           "(LOWER(e.title) LIKE LOWER(CONCAT('%', :kw, '%')) OR " +
           " LOWER(e.content) LIKE LOWER(CONCAT('%', :kw, '%'))) " +
           "ORDER BY e.entryDate DESC")
    List<JournalEntry> findByUserAndKeyword(@Param("user") User user, @Param("kw") String keyword);

    // Aggregate entry counts per day within a date range — used by the Year heatmap view.
    // Returns one HeatmapPoint per day that has at least one entry (days with zero are
    // filled in client-side, so the response stays small for sparse calendars).
    @Query("SELECT new com.myjourney.dto.HeatmapPoint(e.entryDate, COUNT(e)) " +
           "FROM JournalEntry e " +
           "WHERE e.user = :user AND e.entryDate BETWEEN :start AND :end " +
           "GROUP BY e.entryDate")
    List<HeatmapPoint> countEntriesPerDay(
            @Param("user") User user,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );
}
