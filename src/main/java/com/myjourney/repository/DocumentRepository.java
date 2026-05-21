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

    // ── Search (LIKE on title + content) ─────────────────────
    // Powers the keyword search bar on /journal and (in future) /spaces/:id.
    // LIKE %keyword% is fine while document volumes are small; FULLTEXT indexing
    // is wired up via V3 and can replace these queries in a later batch.

    @Query("""
        SELECT d FROM Document d
        WHERE d.space = :space
          AND d.docType = :docType
          AND (LOWER(d.title)   LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(d.content) LIKE LOWER(CONCAT('%', :keyword, '%')))
        """)
    Page<Document> searchBySpaceAndDocTypeAndKeyword(
            @Param("space") Space space,
            @Param("docType") Document.DocType docType,
            @Param("keyword") String keyword,
            Pageable pageable);

    @Query("""
        SELECT d FROM Document d
        WHERE d.space = :space
          AND d.docType = :docType
          AND d.entryDate = :entryDate
          AND (LOWER(d.title)   LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(d.content) LIKE LOWER(CONCAT('%', :keyword, '%')))
        """)
    Page<Document> searchBySpaceAndDocTypeAndKeywordAndEntryDate(
            @Param("space") Space space,
            @Param("docType") Document.DocType docType,
            @Param("keyword") String keyword,
            @Param("entryDate") LocalDate entryDate,
            Pageable pageable);

    // AI-search helper: single-keyword OR-match used by the service-layer
    // dedup loop. Newest first so the merged result order is intuitive.
    @Query("""
        SELECT d FROM Document d
        WHERE d.space = :space
          AND d.docType = :docType
          AND (LOWER(d.title)   LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(d.content) LIKE LOWER(CONCAT('%', :keyword, '%')))
        ORDER BY
            CASE WHEN d.docType = com.myjourney.model.Document.DocType.JOURNAL
                 THEN d.entryDate END DESC,
            d.createdAt DESC
        """)
    List<Document> findBySpaceAndDocTypeAndKeyword(
            @Param("space") Space space,
            @Param("docType") Document.DocType docType,
            @Param("keyword") String keyword);

    long countByAuthor(User author);

    // Cross-space keyword search used by the agent toolset's searchDocuments
    // when spaceId is null. Caller restricts spaceIds to spaces the user is
    // a member of. Date filters are optional. Both JOURNAL and NOTE docs are
    // returned; ordering matches the per-space search (entry_date desc for
    // JOURNAL, created_at desc otherwise).
    @Query("""
        SELECT d FROM Document d
        WHERE d.space.id IN :spaceIds
          AND (LOWER(d.title)   LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(d.content) LIKE LOWER(CONCAT('%', :keyword, '%')))
          AND (:from IS NULL OR d.entryDate >= :from)
          AND (:to   IS NULL OR d.entryDate <= :to)
        ORDER BY
            CASE WHEN d.docType = com.myjourney.model.Document.DocType.JOURNAL
                 THEN d.entryDate END DESC,
            d.createdAt DESC
        """)
    List<Document> searchAcrossSpaces(
            @Param("spaceIds") List<Integer> spaceIds,
            @Param("keyword") String keyword,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            Pageable pageable);
}
