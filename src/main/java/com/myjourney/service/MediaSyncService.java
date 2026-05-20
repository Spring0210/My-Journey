package com.myjourney.service;

import com.myjourney.model.Document;
import com.myjourney.model.DocumentAttachment;
import com.myjourney.model.JournalEntry;
import com.myjourney.model.Media;
import com.myjourney.model.SpacePost;
import com.myjourney.repository.DocumentAttachmentRepository;
import com.myjourney.repository.MediaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Keeps the denormalized `media` table in sync with `journal_entry` and
 * `space_post`. Strategy is "replace": on every create / update / delete of
 * a source row, all media rows for that source are wiped and rewritten from
 * the source's current image/video lists. Simpler and safer than diffing,
 * and easily fast at this scale (a typical entry has <10 media items).
 *
 * Callers: JournalService.createEntry / deleteEntry,
 *          SpacePostService.createPost / editPost / deletePost.
 */
@Service
public class MediaSyncService {

    @Autowired
    private MediaRepository mediaRepository;

    @Autowired
    private DocumentAttachmentRepository attachmentRepository;

    /** Sync media rows after a JournalEntry was saved (created or updated). */
    @Transactional
    public void syncJournalEntry(JournalEntry entry) {
        if (entry == null || entry.getId() == null) return;

        Integer userId = entry.getUser() != null ? entry.getUser().getId() : null;
        if (userId == null) return;

        Long sourceId = entry.getId().longValue();
        mediaRepository.deleteBySourceTypeAndSourceId(Media.SourceType.JOURNAL, sourceId);

        List<String> images = entry.getImagePathList();
        if (images == null || images.isEmpty()) return;

        List<Media> rows = new ArrayList<>(images.size());
        int position = 0;
        for (String url : images) {
            rows.add(buildRow(
                    userId,
                    Media.Type.IMAGE,
                    url,
                    Media.SourceType.JOURNAL,
                    sourceId,
                    entry.getEntryDate(),
                    position++
            ));
        }
        mediaRepository.saveAll(rows);
    }

    /** Sync media rows after a SpacePost was saved (created or updated). */
    @Transactional
    public void syncSpacePost(SpacePost post) {
        if (post == null || post.getId() == null) return;

        Integer userId = post.getAuthor() != null ? post.getAuthor().getId() : null;
        if (userId == null) return;

        Long sourceId = post.getId().longValue();
        mediaRepository.deleteBySourceTypeAndSourceId(Media.SourceType.SPACE_POST, sourceId);

        // SpacePost has no entryDate — use the post's createdAt date as the
        // source_date so timeline grouping in the media library matches when
        // the post was shared. Falls back to today if createdAt is null
        // (shouldn't happen because @PrePersist sets it).
        LocalDate sourceDate = post.getCreatedAt() != null
                ? post.getCreatedAt().toLocalDate()
                : LocalDate.now(ZoneOffset.UTC);

        List<Media> rows = new ArrayList<>();
        int position = 0;
        for (String url : safeList(post.getImagePathList())) {
            rows.add(buildRow(
                    userId,
                    Media.Type.IMAGE,
                    url,
                    Media.SourceType.SPACE_POST,
                    sourceId,
                    sourceDate,
                    position++
            ));
        }
        for (String url : safeList(post.getVideoPathList())) {
            rows.add(buildRow(
                    userId,
                    Media.Type.VIDEO,
                    url,
                    Media.SourceType.SPACE_POST,
                    sourceId,
                    sourceDate,
                    position++
            ));
        }

        if (!rows.isEmpty()) mediaRepository.saveAll(rows);
    }

    /**
     * Sync media rows after a Document's attachment list changed (create,
     * upload, or delete of an attachment). Wipes existing DOCUMENT rows for
     * this doc and rewrites from the current attachments. Image and video
     * attachments map to Media.Type.IMAGE / VIDEO respectively; other file
     * types (PDFs, zips, ...) are skipped — they're not "media".
     */
    @Transactional
    public void syncDocument(Document doc) {
        if (doc == null || doc.getId() == null) return;

        Integer userId = doc.getAuthor() != null ? doc.getAuthor().getId() : null;
        if (userId == null) return;

        Long sourceId = doc.getId();
        mediaRepository.deleteBySourceTypeAndSourceId(Media.SourceType.DOCUMENT, sourceId);

        // JOURNAL docs anchor on entry_date (the day being journaled about);
        // NOTE docs use created_at as their timeline date so the gallery
        // groups them by when they were saved.
        LocalDate sourceDate = doc.getEntryDate() != null
                ? doc.getEntryDate()
                : (doc.getCreatedAt() != null
                        ? doc.getCreatedAt().toLocalDate()
                        : LocalDate.now(ZoneOffset.UTC));

        // Query by document ID rather than by the doc proxy. When this runs
        // inside `deleteAttachment` the doc is a Hibernate proxy whose nested
        // collections may be in a transitional state — the ID-based query
        // avoids that surface entirely.
        List<DocumentAttachment> attachments =
                attachmentRepository.findByDocument_IdOrderByPositionAsc(sourceId);
        if (attachments.isEmpty()) return;

        List<Media> rows = new ArrayList<>();
        int position = 0;
        for (DocumentAttachment a : attachments) {
            Media.Type type = classify(a);
            if (type == null) continue; // non-media attachment (PDF, doc, etc.)
            rows.add(buildRow(
                    userId,
                    type,
                    a.getFileUrl(),
                    Media.SourceType.DOCUMENT,
                    sourceId,
                    sourceDate,
                    position++
            ));
        }
        if (!rows.isEmpty()) mediaRepository.saveAll(rows);
    }

    // Decide whether a DocumentAttachment is an image, video, or neither.
    // Prefers mime_type when set; falls back to the Cloudinary URL pattern
    // so legacy backfilled rows (where mime_type is NULL) still classify.
    private static Media.Type classify(DocumentAttachment a) {
        String mime = a.getMimeType();
        if (mime != null) {
            if (mime.startsWith("image/")) return Media.Type.IMAGE;
            if (mime.startsWith("video/")) return Media.Type.VIDEO;
            return null;
        }
        String url = a.getFileUrl();
        if (url == null) return null;
        if (url.contains("/image/upload/")) return Media.Type.IMAGE;
        if (url.contains("/video/upload/")) return Media.Type.VIDEO;
        return null;
    }

    /** Drop all media for a source — used by delete paths. */
    @Transactional
    public void clearForSource(Media.SourceType sourceType, Long sourceId) {
        if (sourceId == null) return;
        mediaRepository.deleteBySourceTypeAndSourceId(sourceType, sourceId);
    }

    private Media buildRow(
            Integer userId,
            Media.Type type,
            String url,
            Media.SourceType sourceType,
            Long sourceId,
            LocalDate sourceDate,
            int position
    ) {
        Media m = new Media();
        m.setUserId(userId);
        m.setType(type);
        m.setUrl(url);
        m.setSourceType(sourceType);
        m.setSourceId(sourceId);
        m.setSourceDate(sourceDate);
        m.setPosition(position);
        return m;
    }

    private static List<String> safeList(List<String> list) {
        return list != null ? list : List.of();
    }
}
