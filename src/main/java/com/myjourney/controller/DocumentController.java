package com.myjourney.controller;

import com.myjourney.dto.CreateDocumentRequest;
import com.myjourney.dto.DocumentAttachmentResponse;
import com.myjourney.dto.DocumentCommentResponse;
import com.myjourney.dto.DocumentResponse;
import com.myjourney.dto.DocumentSummaryResponse;
import com.myjourney.dto.PageResponse;
import com.myjourney.dto.UpdateDocumentRequest;
import com.myjourney.exception.AppException;
import com.myjourney.model.Document;
import com.myjourney.model.DocumentAttachment;
import com.myjourney.model.DocumentComment;
import com.myjourney.service.CloudStorageService;
import com.myjourney.service.DocumentService;
import com.myjourney.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

// REST surface for the unified Document model (team-KB pivot).
// Mirrors the DocumentService API; the same toolset is later exposed to
// the internal AI agent and the MCP server, which is why business logic
// is kept in the service layer and the controller stays thin.
@RestController
@CrossOrigin
public class DocumentController {

    private static final int SNIPPET_MAX_CHARS = 200;

    @Autowired private DocumentService documentService;
    @Autowired private CloudStorageService cloudStorageService;
    @Autowired private JwtUtil jwtUtil;

    // ============================================================
    // Document CRUD
    // ============================================================

    // POST /api/spaces/{spaceId}/documents — create a document in this space
    @PostMapping("/api/spaces/{spaceId}/documents")
    public ResponseEntity<DocumentResponse> createDocument(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @RequestBody CreateDocumentRequest req
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        Document.DocType docType = parseDocType(req.docType(), Document.DocType.NOTE);
        Document doc = documentService.createDocument(
                userId, spaceId, req.title(), req.content(),
                docType, req.entryDate(), req.tags());
        return ResponseEntity.ok(toDetailResponse(doc));
    }

    // GET /api/spaces/{spaceId}/documents — paginated list, optional type filter
    @GetMapping("/api/spaces/{spaceId}/documents")
    public ResponseEntity<PageResponse<DocumentSummaryResponse>> listDocuments(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Integer spaceId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        Document.DocType docType = (type == null || type.isBlank())
                ? null : parseDocType(type, null);
        Page<Document> docs = documentService.listDocumentsInSpace(userId, spaceId, docType, page, size);
        List<DocumentSummaryResponse> items = docs.getContent().stream()
                .map(this::toSummaryResponse)
                .toList();
        return ResponseEntity.ok(new PageResponse<>(
                items, docs.getTotalPages(), docs.getTotalElements(), page));
    }

    // GET /api/documents/{id} — full detail (content + attachments + comments)
    @GetMapping("/api/documents/{id}")
    public ResponseEntity<DocumentResponse> getDocument(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        Document doc = documentService.getDocumentForUser(userId, id);
        return ResponseEntity.ok(toDetailResponse(doc));
    }

    // PUT /api/documents/{id} — update title/content/tags (author only)
    @PutMapping("/api/documents/{id}")
    public ResponseEntity<DocumentResponse> updateDocument(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id,
            @RequestBody UpdateDocumentRequest req
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        Document doc = documentService.updateDocument(
                userId, id, req.title(), req.content(), req.tags());
        return ResponseEntity.ok(toDetailResponse(doc));
    }

    // DELETE /api/documents/{id} — author or space owner; Cloudinary cleanup inside service
    @DeleteMapping("/api/documents/{id}")
    public ResponseEntity<Void> deleteDocument(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        documentService.deleteDocument(userId, id);
        return ResponseEntity.ok().build();
    }

    // ============================================================
    // Comments
    // ============================================================

    // GET /api/documents/{id}/comments — list (chronological)
    @GetMapping("/api/documents/{id}/comments")
    public ResponseEntity<List<DocumentCommentResponse>> listComments(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        // Access-check via the doc lookup; throws FORBIDDEN if user is not a member.
        documentService.getDocumentForUser(userId, id);
        List<DocumentComment> comments = documentService.getComments(id);
        return ResponseEntity.ok(comments.stream().map(this::toCommentResponse).toList());
    }

    // POST /api/documents/{id}/comments — any space member can comment
    @PostMapping("/api/documents/{id}/comments")
    public ResponseEntity<DocumentCommentResponse> addComment(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        DocumentComment c = documentService.addComment(userId, id, body.get("content"));
        return ResponseEntity.ok(toCommentResponse(c));
    }

    // DELETE /api/documents/{id}/comments/{commentId} — comment author or space owner
    @DeleteMapping("/api/documents/{id}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id,
            @PathVariable Long commentId
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        documentService.deleteComment(userId, commentId);
        return ResponseEntity.ok().build();
    }

    // ============================================================
    // Attachments
    // ============================================================

    // GET /api/documents/{id}/attachments — list in upload order
    @GetMapping("/api/documents/{id}/attachments")
    public ResponseEntity<List<DocumentAttachmentResponse>> listAttachments(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        documentService.getDocumentForUser(userId, id); // access-check
        List<DocumentAttachment> attachments = documentService.getAttachments(id);
        return ResponseEntity.ok(attachments.stream().map(this::toAttachmentResponse).toList());
    }

    // POST /api/documents/{id}/attachments — multipart upload; routes to
    // Cloudinary's image or video pipeline based on the file's mime type.
    @PostMapping("/api/documents/{id}/attachments")
    public ResponseEntity<DocumentAttachmentResponse> uploadAttachment(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();
        if (file == null || file.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Attachment file is required");
        }

        String mimeType = file.getContentType();
        boolean isVideo = mimeType != null && mimeType.startsWith("video/");
        String folder = "my-journey/documents/" + id;
        String url = isVideo
                ? cloudStorageService.uploadVideo(file, folder)
                : cloudStorageService.uploadFile(file, folder);

        DocumentAttachment a = documentService.addAttachment(
                userId, id, url,
                file.getOriginalFilename(),
                mimeType,
                file.getSize());
        return ResponseEntity.ok(toAttachmentResponse(a));
    }

    // DELETE /api/documents/{id}/attachments/{attachmentId} — author only; service cleans up Cloudinary
    @DeleteMapping("/api/documents/{id}/attachments/{attachmentId}")
    public ResponseEntity<Void> deleteAttachment(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long id,
            @PathVariable Long attachmentId
    ) {
        Integer userId = jwtUtil.extractUserIdFromHeader(authHeader);
        if (userId == null) return ResponseEntity.status(401).build();

        documentService.deleteAttachment(userId, attachmentId);
        return ResponseEntity.ok().build();
    }

    // ============================================================
    // Conversion helpers
    // ============================================================

    // Detail view assembles attachments + comments in additional service
    // round-trips. Acceptable: doc detail is one click off a list view and
    // the rows are small. Could be folded into a single JOIN FETCH later.
    private DocumentResponse toDetailResponse(Document d) {
        List<DocumentAttachmentResponse> attachments = documentService.getAttachments(d.getId())
                .stream().map(this::toAttachmentResponse).toList();
        List<DocumentCommentResponse> comments = documentService.getComments(d.getId())
                .stream().map(this::toCommentResponse).toList();
        return new DocumentResponse(
                d.getId(),
                d.getTitle(),
                d.getContent(),
                d.getDocType().name(),
                d.getEntryDate(),
                d.getTags(),
                d.getSpace().getId(),
                d.getSpace().getName(),
                d.getAuthor().getId(),
                d.getAuthor().getUsername(),
                d.getAuthor().getAvatar(),
                d.getCreatedAt(),
                d.getUpdatedAt(),
                attachments,
                comments);
    }

    private DocumentSummaryResponse toSummaryResponse(Document d) {
        String content = d.getContent() == null ? "" : d.getContent();
        String snippet = content.length() > SNIPPET_MAX_CHARS
                ? content.substring(0, SNIPPET_MAX_CHARS)
                : content;
        return new DocumentSummaryResponse(
                d.getId(),
                d.getTitle(),
                snippet,
                d.getDocType().name(),
                d.getEntryDate(),
                d.getTags(),
                d.getSpace().getId(),
                d.getAuthor().getId(),
                d.getAuthor().getUsername(),
                d.getAuthor().getAvatar(),
                d.getCreatedAt(),
                d.getUpdatedAt());
    }

    private DocumentAttachmentResponse toAttachmentResponse(DocumentAttachment a) {
        return new DocumentAttachmentResponse(
                a.getId(),
                a.getFileUrl(),
                a.getOriginalName(),
                a.getMimeType(),
                a.getSizeBytes(),
                a.getPosition(),
                a.getUploadedAt());
    }

    private DocumentCommentResponse toCommentResponse(DocumentComment c) {
        return new DocumentCommentResponse(
                c.getId(),
                c.getContent(),
                c.getAuthor().getId(),
                c.getAuthor().getUsername(),
                c.getAuthor().getAvatar(),
                c.getCreatedAt());
    }

    // Returns the parsed DocType for non-null/blank input, or `fallback`
    // when input is null/blank and a fallback is supplied. Rejects bogus
    // values with a 400 instead of bubbling an IllegalArgumentException.
    private Document.DocType parseDocType(String raw, Document.DocType fallback) {
        if (raw == null || raw.isBlank()) {
            if (fallback != null) return fallback;
            throw new AppException(HttpStatus.BAD_REQUEST, "docType is required");
        }
        try {
            return Document.DocType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(HttpStatus.BAD_REQUEST,
                    "Unknown docType '" + raw + "'. Expected JOURNAL or NOTE.");
        }
    }
}
