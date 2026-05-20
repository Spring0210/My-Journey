package com.myjourney.agent;

import com.myjourney.agent.dto.ToolComment;
import com.myjourney.agent.dto.ToolDocumentDetail;
import com.myjourney.agent.dto.ToolSearchResult;
import com.myjourney.agent.dto.ToolSpaceSummary;
import com.myjourney.exception.AppException;
import com.myjourney.model.Document;
import com.myjourney.model.DocumentComment;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import com.myjourney.service.DocumentService;
import com.myjourney.service.SpaceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

// Bridges the agent's 8-tool surface to the existing service layer. Holds no
// business logic of its own -- all access checks, validation, and persistence
// happen inside DocumentService / SpaceService.
@Service
public class DocumentToolsetImpl implements DocumentToolset {

    // Snippet length surfaced to the LLM for each search hit. Long enough to
    // disambiguate matches but short enough that 25 hits don't blow the context
    // window before the model can call get_document for the relevant one.
    private static final int SNIPPET_MAX = 200;

    // Caps recent-comments included in a single getDocument payload so a
    // chatty doc doesn't blow the LLM's context window.
    private static final int RECENT_COMMENTS_CAP = 20;

    @Autowired private DocumentService documentService;
    @Autowired private SpaceService spaceService;
    @Autowired private UserRepository userRepository;
    @Autowired private SpaceRepository spaceRepository;
    @Autowired private SpaceMemberRepository spaceMemberRepository;

    @Override
    public ToolSearchResult searchDocuments(Integer userId,
                                            String query,
                                            Integer spaceId,
                                            LocalDate from,
                                            LocalDate to,
                                            List<String> tags,
                                            int limit) {
        int capped = Math.min(Math.max(limit, 1), 25);
        List<Document> docs;
        if (spaceId == null) {
            docs = documentService.searchAccessibleDocuments(userId, query, from, to, tags, capped);
        } else {
            // Toolset has no doc-type filter, so search NOTE + JOURNAL and merge.
            // Each call is already access-checked inside the service.
            Page<Document> notes    = documentService.searchDocumentsInSpace(
                    userId, spaceId, Document.DocType.NOTE,    query, null, 0, capped);
            Page<Document> journals = documentService.searchDocumentsInSpace(
                    userId, spaceId, Document.DocType.JOURNAL, query, null, 0, capped);
            docs = Stream.concat(notes.getContent().stream(), journals.getContent().stream())
                    .limit(capped)
                    .toList();
        }
        List<ToolSearchResult.Hit> hits = docs.stream().map(this::toHit).toList();
        return new ToolSearchResult(hits);
    }

    @Override
    public ToolDocumentDetail getDocument(Integer userId, Long documentId) {
        Document d = documentService.getDocumentForUser(userId, documentId);
        List<ToolDocumentDetail.Attachment> atts = documentService.getAttachments(documentId).stream()
                .map(a -> new ToolDocumentDetail.Attachment(
                        a.getFileUrl(), a.getOriginalName(), a.getMimeType(), a.getSizeBytes()))
                .toList();
        List<ToolComment> comments = documentService.getComments(documentId).stream()
                .limit(RECENT_COMMENTS_CAP)
                .map(this::toComment)
                .toList();
        return new ToolDocumentDetail(
                d.getId(),
                d.getTitle(),
                d.getContent(),
                d.getDocType().name(),
                d.getEntryDate(),
                d.getTags(),
                d.getSpace().getId(),
                d.getSpace().getName(),
                d.getAuthor().getUsername(),
                d.getCreatedAt(),
                d.getUpdatedAt(),
                atts,
                comments);
    }

    @Override
    public List<ToolSpaceSummary> listSpaces(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));
        return spaceMemberRepository.findSpaceIdsByUser(user).stream()
                .map(id -> spaceRepository.findById(id).orElse(null))
                .filter(Objects::nonNull)
                .map(s -> new ToolSpaceSummary(
                        s.getId(),
                        s.getName(),
                        s.isPersonal(),
                        spaceMemberRepository.countBySpace(s)))
                .toList();
    }

    @Override
    public ToolSearchResult listDocuments(Integer userId,
                                          Integer spaceId,
                                          String docType,
                                          LocalDate since,
                                          String tag,
                                          int limit,
                                          int offset) {
        int capped = Math.min(Math.max(limit, 1), 25);
        Document.DocType type = parseDocType(docType);
        // The underlying service paginates by (page, size); translate the agent's
        // (offset, limit) the simplest way that still respects both.
        Page<Document> p = documentService.listDocumentsInSpace(
                userId, spaceId, type, null, offset / Math.max(capped, 1), capped);

        // `since` and `tag` filters aren't expressible via the existing repo
        // signatures, so apply them in memory on the already-capped page.
        String tagLower = tag == null ? null : tag.toLowerCase();
        List<ToolSearchResult.Hit> hits = p.getContent().stream()
                .filter(d -> since == null
                        || (d.getEntryDate() != null && !d.getEntryDate().isBefore(since)))
                .filter(d -> tagLower == null
                        || (d.getTags() != null && d.getTags().contains(tagLower)))
                .map(this::toHit)
                .toList();
        return new ToolSearchResult(hits);
    }

    @Override
    public List<ToolComment> getComments(Integer userId, Long documentId) {
        // Access check piggy-backs on getDocumentForUser; getComments itself
        // doesn't enforce membership.
        documentService.getDocumentForUser(userId, documentId);
        return documentService.getComments(documentId).stream()
                .map(this::toComment)
                .toList();
    }

    @Override
    public ToolDocumentDetail createDocument(Integer userId,
                                              String title,
                                              String content,
                                              Integer spaceId,
                                              String docType,
                                              LocalDate entryDate,
                                              List<String> tags) {
        Integer effectiveSpaceId = spaceId != null ? spaceId : spaceService.findPersonalSpaceId(userId);
        Document.DocType type = parseDocType(docType);
        if (type == null) type = Document.DocType.NOTE;
        Document d = documentService.createDocument(
                userId, effectiveSpaceId, title, content, type, entryDate, tags);
        return getDocument(userId, d.getId());
    }

    @Override
    public ToolDocumentDetail updateDocument(Integer userId,
                                              Long documentId,
                                              String title,
                                              String content,
                                              List<String> tags) {
        Document d = documentService.updateDocument(userId, documentId, title, content, tags);
        return getDocument(userId, d.getId());
    }

    @Override
    public ToolComment addComment(Integer userId, Long documentId, String content) {
        DocumentComment c = documentService.addComment(userId, documentId, content);
        return toComment(c);
    }

    // -- Mapping helpers ----------------------------------------------

    private ToolSearchResult.Hit toHit(Document d) {
        String body = d.getContent() == null ? "" : d.getContent();
        String snippet = body.length() > SNIPPET_MAX ? body.substring(0, SNIPPET_MAX) : body;
        return new ToolSearchResult.Hit(
                d.getId(),
                d.getTitle(),
                snippet,
                d.getSpace().getId(),
                d.getSpace().getName(),
                d.getEntryDate(),
                d.getDocType().name());
    }

    private ToolComment toComment(DocumentComment c) {
        return new ToolComment(
                c.getId(),
                c.getContent(),
                c.getAuthor().getUsername(),
                c.getCreatedAt());
    }

    private Document.DocType parseDocType(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Document.DocType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(HttpStatus.BAD_REQUEST,
                    "Unknown docType '" + raw + "'. Expected JOURNAL or NOTE.");
        }
    }
}
