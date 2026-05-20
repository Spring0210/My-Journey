package com.myjourney.service;

import com.myjourney.dto.CalendarEventResponse;
import com.myjourney.dto.HeatmapPoint;
import com.myjourney.exception.AppException;
import com.myjourney.model.Document;
import com.myjourney.model.DocumentAttachment;
import com.myjourney.model.DocumentComment;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import com.myjourney.repository.DocumentAttachmentRepository;
import com.myjourney.repository.DocumentCommentRepository;
import com.myjourney.repository.DocumentRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Locale;
import java.util.stream.Collectors;

// Core CRUD for the unified Document model.
// This batch ships the data-layer skeleton only: no full-text search,
// no AI agent integration, no MCP tools. Those layers will compose
// these primitives in later batches.
@Service
public class DocumentService {

    @Autowired private DocumentRepository documentRepository;
    @Autowired private DocumentCommentRepository commentRepository;
    @Autowired private DocumentAttachmentRepository attachmentRepository;
    @Autowired private SpaceRepository spaceRepository;
    @Autowired private SpaceMemberRepository spaceMemberRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CloudStorageService cloudStorageService;

    // ============================================================
    // Document CRUD
    // ============================================================

    @Transactional
    public Document createDocument(Integer userId,
                                    Integer spaceId,
                                    String title,
                                    String content,
                                    Document.DocType docType,
                                    LocalDate entryDate,
                                    List<String> tags) {
        User user = loadUser(userId);
        Space space = loadSpace(spaceId);
        requireMember(user, space);

        if (docType == null) docType = Document.DocType.NOTE;
        if (docType == Document.DocType.JOURNAL && entryDate == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Journal documents require entry_date");
        }
        if (title == null || title.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Document title cannot be empty");
        }

        Document doc = new Document();
        doc.setAuthor(user);
        doc.setSpace(space);
        doc.setTitle(title.trim());
        doc.setContent(content != null ? content : "");
        doc.setDocType(docType);
        doc.setEntryDate(entryDate);
        doc.setTags(normalizeTags(tags));
        return documentRepository.save(doc);
    }

    @Transactional
    public Document updateDocument(Integer userId,
                                    Long docId,
                                    String title,
                                    String content,
                                    List<String> tags) {
        Document doc = loadDocument(docId);
        if (!doc.getAuthor().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Only the author can edit this document");
        }
        if (title != null) {
            if (title.isBlank()) {
                throw new AppException(HttpStatus.BAD_REQUEST, "Title cannot be empty");
            }
            doc.setTitle(title.trim());
        }
        if (content != null) doc.setContent(content);
        if (tags != null) doc.setTags(normalizeTags(tags));
        return documentRepository.save(doc);
    }

    public Document getDocumentForUser(Integer userId, Long docId) {
        User user = loadUser(userId);
        Document doc = loadDocument(docId);
        requireMember(user, doc.getSpace());
        return doc;
    }

    public Page<Document> listDocumentsInSpace(Integer userId,
                                                Integer spaceId,
                                                Document.DocType docType,
                                                LocalDate entryDate,
                                                int page,
                                                int size) {
        User user = loadUser(userId);
        Space space = loadSpace(spaceId);
        requireMember(user, space);

        // Sort by entry_date desc when filtering JOURNAL docs (the chronological
        // axis users actually scan); otherwise fall back to created_at desc.
        Sort.Direction dir = Sort.Direction.DESC;
        String sortField = (docType == Document.DocType.JOURNAL) ? "entryDate" : "createdAt";
        PageRequest pageable = PageRequest.of(page, size, Sort.by(dir, sortField));

        if (entryDate != null && docType != null) {
            return documentRepository.findBySpaceAndDocTypeAndEntryDate(space, docType, entryDate, pageable);
        }
        if (entryDate != null) {
            return documentRepository.findBySpaceAndEntryDate(space, entryDate, pageable);
        }
        if (docType != null) {
            return documentRepository.findBySpaceAndDocType(space, docType, pageable);
        }
        return documentRepository.findBySpace(space, pageable);
    }

    // Calendar feed for the /journal page — JOURNAL docs in the given space
    // that have an entry_date. hasImage is computed in a single side query so
    // we don't blow up to N+1 lookups on a year of entries.
    public List<CalendarEventResponse> getJournalCalendar(Integer userId, Integer spaceId) {
        User user = loadUser(userId);
        Space space = loadSpace(spaceId);
        requireMember(user, space);

        List<Document> docs = documentRepository.findBySpaceAndDocTypeAndEntryDateBetween(
                space, Document.DocType.JOURNAL, LocalDate.of(1970, 1, 1), LocalDate.of(9999, 12, 31));
        Set<Long> withAttachment = new HashSet<>(
                attachmentRepository.findDocumentIdsWithAttachmentInSpace(space));

        return docs.stream()
                .map(d -> new CalendarEventResponse(
                        d.getId(),
                        d.getTitle(),
                        d.getEntryDate().toString(),
                        withAttachment.contains(d.getId())))
                .toList();
    }

    // Up to this many image attachments per doc are surfaced in the list view
    // thumbnail strip. Anything beyond shows as a "+N" overflow chip in the UI.
    private static final int MAX_THUMBS_PER_DOC = 4;

    // Batch-fetch image attachment URLs for a list of documents, transformed
    // into ~200px Cloudinary thumbnails so card lists don't pull the full-res
    // originals. Returns a map keyed by document id.
    public Map<Long, List<String>> findImageUrlsByDocIds(List<Long> docIds) {
        if (docIds == null || docIds.isEmpty()) return Map.of();
        List<DocumentAttachment> all = attachmentRepository
                .findImageAttachmentsByDocumentIds(docIds);
        Map<Long, List<String>> grouped = new LinkedHashMap<>();
        for (DocumentAttachment a : all) {
            Long docId = a.getDocument().getId();
            List<String> list = grouped.computeIfAbsent(docId, k -> new ArrayList<>());
            if (list.size() < MAX_THUMBS_PER_DOC) {
                list.add(toCloudinaryThumb(a.getFileUrl()));
            }
        }
        return grouped;
    }

    // Inserts a Cloudinary delivery transform so the browser pulls a 200x200
    // thumbnail instead of the full-res original. f_auto serves WebP/AVIF on
    // supporting browsers; q_auto picks a quality level. No-op on non-Cloudinary
    // URLs (legacy /uploads/... entries) so they keep working as-is.
    private static String toCloudinaryThumb(String url) {
        if (url == null) return null;
        int idx = url.indexOf("/image/upload/");
        if (idx == -1) return url;
        return url.replaceFirst(
                "/image/upload/",
                "/image/upload/c_fill,w_200,h_200,q_auto,f_auto/");
    }

    public List<HeatmapPoint> getJournalHeatmap(Integer userId, Integer spaceId, int year) {
        User user = loadUser(userId);
        Space space = loadSpace(spaceId);
        requireMember(user, space);

        LocalDate start = LocalDate.of(year, 1, 1);
        LocalDate end   = LocalDate.of(year, 12, 31);
        return documentRepository.findJournalHeatmap(space, start, end);
    }

    @Transactional
    public void deleteDocument(Integer userId, Long docId) {
        Document doc = loadDocument(docId);
        boolean isAuthor = doc.getAuthor().getId().equals(userId);
        boolean isSpaceOwner = doc.getSpace().getOwner().getId().equals(userId);
        if (!isAuthor && !isSpaceOwner) {
            throw new AppException(HttpStatus.FORBIDDEN,
                    "Only the author or space owner can delete this document");
        }
        // Snapshot Cloudinary URLs before the DB cascade removes the rows.
        // Legacy /uploads/* paths (pre-Cloudinary backfill) silently no-op
        // inside deleteFiles — they fail Cloudinary's publicId extraction.
        List<String> urls = attachmentRepository.findByDocumentOrderByPositionAsc(doc)
                .stream()
                .map(DocumentAttachment::getFileUrl)
                .toList();
        // FK ON DELETE CASCADE in V2 takes care of attachments + comments rows.
        documentRepository.delete(doc);
        if (!urls.isEmpty()) cloudStorageService.deleteFiles(urls);
    }

    // ============================================================
    // Comments
    // ============================================================

    @Transactional
    public DocumentComment addComment(Integer userId, Long docId, String content) {
        if (content == null || content.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Comment cannot be empty");
        }
        User user = loadUser(userId);
        Document doc = loadDocument(docId);
        requireMember(user, doc.getSpace());

        DocumentComment c = new DocumentComment();
        c.setAuthor(user);
        c.setDocument(doc);
        c.setContent(content.trim());
        return commentRepository.save(c);
    }

    public List<DocumentComment> getComments(Long docId) {
        Document doc = loadDocument(docId);
        return commentRepository.findByDocumentOrderByCreatedAtAsc(doc);
    }

    @Transactional
    public void deleteComment(Integer userId, Long commentId) {
        DocumentComment c = commentRepository.findById(commentId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Comment not found"));
        boolean isAuthor = c.getAuthor().getId().equals(userId);
        boolean isSpaceOwner = c.getDocument().getSpace().getOwner().getId().equals(userId);
        if (!isAuthor && !isSpaceOwner) {
            throw new AppException(HttpStatus.FORBIDDEN,
                    "Only the comment author or space owner can delete this comment");
        }
        commentRepository.delete(c);
    }

    // ============================================================
    // Attachments
    // ============================================================

    @Transactional
    public DocumentAttachment addAttachment(Integer userId,
                                              Long docId,
                                              String fileUrl,
                                              String originalName,
                                              String mimeType,
                                              Long sizeBytes) {
        if (fileUrl == null || fileUrl.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Attachment URL is required");
        }
        Document doc = loadDocument(docId);
        if (!doc.getAuthor().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN,
                    "Only the document author can attach files");
        }

        // Append at the end of the current attachment ordering.
        List<DocumentAttachment> existing = attachmentRepository.findByDocumentOrderByPositionAsc(doc);
        int nextPos = existing.isEmpty()
                ? 0
                : existing.get(existing.size() - 1).getPosition() + 1;

        DocumentAttachment a = new DocumentAttachment();
        a.setDocument(doc);
        a.setFileUrl(fileUrl);
        a.setOriginalName(originalName);
        a.setMimeType(mimeType);
        a.setSizeBytes(sizeBytes);
        a.setPosition(nextPos);
        return attachmentRepository.save(a);
    }

    public List<DocumentAttachment> getAttachments(Long docId) {
        Document doc = loadDocument(docId);
        return attachmentRepository.findByDocumentOrderByPositionAsc(doc);
    }

    @Transactional
    public void deleteAttachment(Integer userId, Long attachmentId) {
        DocumentAttachment a = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Attachment not found"));
        if (!a.getDocument().getAuthor().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN,
                    "Only the document author can remove attachments");
        }
        String url = a.getFileUrl();
        attachmentRepository.delete(a);
        if (url != null && !url.isBlank()) cloudStorageService.deleteFile(url);
    }

    // ============================================================
    // Helpers
    // ============================================================

    private User loadUser(Integer id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private Space loadSpace(Integer id) {
        return spaceRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));
    }

    private Document loadDocument(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    private void requireMember(User user, Space space) {
        if (!spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Not a member of this space");
        }
    }

    // Tags are normalized lowercase + trimmed + deduplicated.
    // Returns a mutable ArrayList so Hibernate's JSON serializer is happy.
    private List<String> normalizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) return new ArrayList<>();
        return tags.stream()
                .filter(t -> t != null && !t.isBlank())
                .map(t -> t.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .collect(Collectors.toCollection(ArrayList::new));
    }
}
