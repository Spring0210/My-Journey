package com.myjourney.repository;

import com.myjourney.model.Media;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

public interface MediaRepository extends JpaRepository<Media, Long> {

    // Delete all media rows tied to one source — used by MediaSyncService
    // when a JournalEntry or SpacePost is updated or deleted ("replace" strategy).
    @Modifying
    @Transactional
    void deleteBySourceTypeAndSourceId(Media.SourceType sourceType, Long sourceId);

    long countByUserId(Integer userId);

    // Keyset-paginated query for the media library page.
    // Cursor is (sourceDate, id) of the LAST item from the previous page;
    // we return rows with (sourceDate, id) strictly less than the cursor.
    // Tuple comparison via the manual OR form so MySQL uses the composite index.
    //
    // typeFilter == null means "all types" (no filter on type column).
    @Query("""
        SELECT m FROM Media m
        WHERE m.userId = :userId
          AND (:typeFilter IS NULL OR m.type = :typeFilter)
          AND (
            :cursorDate IS NULL
            OR m.sourceDate < :cursorDate
            OR (m.sourceDate = :cursorDate AND m.id < :cursorId)
          )
        ORDER BY m.sourceDate DESC, m.id DESC
        """)
    List<Media> findPage(
            @Param("userId") Integer userId,
            @Param("typeFilter") Media.Type typeFilter,
            @Param("cursorDate") LocalDate cursorDate,
            @Param("cursorId") Long cursorId,
            org.springframework.data.domain.Pageable pageable
    );
}
