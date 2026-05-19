package com.myjourney.service;

import com.myjourney.dto.MediaPageResponse;
import com.myjourney.dto.MediaResponse;
import com.myjourney.model.JournalEntry;
import com.myjourney.model.Media;
import com.myjourney.model.SpacePost;
import com.myjourney.repository.JournalRepository;
import com.myjourney.repository.MediaRepository;
import com.myjourney.repository.SpacePostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Read-side service for the Media library page.
 *
 * Cursor format: "YYYY-MM-DD_id" of the last row from the previous page.
 * Backend returns rows strictly past that (older or same-date-but-smaller-id).
 */
@Service
public class MediaService {

    /** Default page size if the client does not specify one. */
    public static final int DEFAULT_LIMIT = 60;
    /** Hard ceiling — clients can't request more than this in one shot. */
    public static final int MAX_LIMIT = 200;

    @Autowired
    private MediaRepository mediaRepository;

    @Autowired
    private JournalRepository journalRepository;

    @Autowired
    private SpacePostRepository spacePostRepository;

    public MediaPageResponse fetchPage(Integer userId, String typeParam, String cursor, Integer limitParam) {
        Media.Type typeFilter = parseTypeFilter(typeParam);

        int limit = (limitParam == null || limitParam <= 0) ? DEFAULT_LIMIT : limitParam;
        limit = Math.min(limit, MAX_LIMIT);

        LocalDate cursorDate = null;
        Long cursorId = null;
        if (cursor != null && !cursor.isBlank()) {
            int sep = cursor.indexOf('_');
            if (sep <= 0 || sep == cursor.length() - 1) {
                throw new IllegalArgumentException("Invalid cursor");
            }
            try {
                cursorDate = LocalDate.parse(cursor.substring(0, sep));
                cursorId   = Long.parseLong(cursor.substring(sep + 1));
            } catch (RuntimeException e) {
                throw new IllegalArgumentException("Invalid cursor");
            }
        }

        // Fetch limit + 1 to detect whether there is another page without a separate count.
        List<Media> rows = mediaRepository.findPage(
                userId, typeFilter, cursorDate, cursorId,
                PageRequest.of(0, limit + 1)
        );

        boolean hasMore = rows.size() > limit;
        if (hasMore) rows = rows.subList(0, limit);

        // Batch-load source titles so we issue at most 2 extra queries regardless of page size.
        Map<Long, String> journalTitles = loadJournalTitles(rows);
        Map<Long, String> postSnippets  = loadPostSnippets(rows);

        List<MediaResponse> items = new ArrayList<>(rows.size());
        for (Media m : rows) {
            String title = switch (m.getSourceType()) {
                case JOURNAL    -> journalTitles.getOrDefault(m.getSourceId(), "");
                case SPACE_POST -> postSnippets.getOrDefault(m.getSourceId(), "");
            };
            items.add(new MediaResponse(
                    m.getId(),
                    m.getType().name(),
                    m.getUrl(),
                    m.getSourceType().name(),
                    m.getSourceId(),
                    m.getSourceDate(),
                    title
            ));
        }

        String nextCursor = null;
        if (hasMore && !rows.isEmpty()) {
            Media last = rows.get(rows.size() - 1);
            nextCursor = last.getSourceDate().toString() + "_" + last.getId();
        }

        return new MediaPageResponse(items, nextCursor);
    }

    private Media.Type parseTypeFilter(String typeParam) {
        if (typeParam == null || typeParam.isBlank() || "ALL".equalsIgnoreCase(typeParam)) {
            return null;
        }
        try {
            return Media.Type.valueOf(typeParam.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid type filter — expected IMAGE, VIDEO, or ALL");
        }
    }

    private Map<Long, String> loadJournalTitles(List<Media> rows) {
        Set<Integer> ids = collectSourceIds(rows, Media.SourceType.JOURNAL);
        if (ids.isEmpty()) return Map.of();
        Map<Long, String> out = new HashMap<>();
        for (JournalEntry e : journalRepository.findAllById(ids)) {
            out.put(e.getId().longValue(), e.getTitle() == null ? "" : e.getTitle());
        }
        return out;
    }

    private Map<Long, String> loadPostSnippets(List<Media> rows) {
        Set<Integer> ids = collectSourceIds(rows, Media.SourceType.SPACE_POST);
        if (ids.isEmpty()) return Map.of();
        Map<Long, String> out = new HashMap<>();
        for (SpacePost p : spacePostRepository.findAllById(ids)) {
            out.put(p.getId().longValue(), snippet(p.getContent()));
        }
        return out;
    }

    private static Set<Integer> collectSourceIds(List<Media> rows, Media.SourceType type) {
        Set<Integer> ids = new HashSet<>();
        for (Media m : rows) {
            if (m.getSourceType() == type) ids.add(m.getSourceId().intValue());
        }
        return ids;
    }

    /** Trim a Space post's content for the lightbox bottom strip. */
    private static String snippet(String content) {
        if (content == null) return "";
        String trimmed = content.trim();
        if (trimmed.length() <= 60) return trimmed;
        return trimmed.substring(0, 60).trim() + "...";
    }
}
