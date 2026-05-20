package com.myjourney.repository;

import com.myjourney.dto.HeatmapPoint;
import com.myjourney.model.Document;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    Page<Document> findBySpace(Space space, Pageable pageable);

    Page<Document> findBySpaceAndDocType(Space space, Document.DocType docType, Pageable pageable);

    // Same as findBySpaceAndDocType, plus an exact entry_date match. Powers the
    // "show me what I wrote on May 12" navigation from Calendar / Heatmap.
    Page<Document> findBySpaceAndDocTypeAndEntryDate(
            Space space, Document.DocType docType, LocalDate entryDate, Pageable pageable);

    Page<Document> findBySpaceAndEntryDate(Space space, LocalDate entryDate, Pageable pageable);

    // Used by journal Calendar / Heatmap views — JOURNAL docs only.
    List<Document> findBySpaceAndDocTypeAndEntryDateBetween(
            Space space, Document.DocType docType, LocalDate from, LocalDate to);

    // Heatmap aggregate: count of JOURNAL docs per entry_date in the given range.
    @Query("""
        SELECT new com.myjourney.dto.HeatmapPoint(d.entryDate, COUNT(d))
        FROM Document d
        WHERE d.space = :space
          AND d.docType = com.myjourney.model.Document.DocType.JOURNAL
          AND d.entryDate BETWEEN :start AND :end
        GROUP BY d.entryDate
        """)
    List<HeatmapPoint> findJournalHeatmap(
            @Param("space") Space space,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    long countByAuthor(User author);
}
