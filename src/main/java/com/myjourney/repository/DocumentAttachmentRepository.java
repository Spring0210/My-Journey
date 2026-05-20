package com.myjourney.repository;

import com.myjourney.model.Document;
import com.myjourney.model.DocumentAttachment;
import com.myjourney.model.Space;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DocumentAttachmentRepository extends JpaRepository<DocumentAttachment, Long> {

    List<DocumentAttachment> findByDocumentOrderByPositionAsc(Document document);

    void deleteByDocument(Document document);

    // Returns IDs of documents in the given space that have at least one
    // attachment. Lets the calendar compute the "hasImage" flag in one
    // query instead of N+1 lookups per event.
    @Query("""
        SELECT DISTINCT da.document.id
        FROM DocumentAttachment da
        WHERE da.document.space = :space
        """)
    List<Long> findDocumentIdsWithAttachmentInSpace(@Param("space") Space space);

    // Batch fetch image attachments for a page of documents. Filters by
    // mime_type when present (new uploads) and falls back to the Cloudinary
    // URL pattern for legacy migrated rows where mime_type is NULL.
    @Query("""
        SELECT da FROM DocumentAttachment da
        WHERE da.document.id IN :docIds
          AND (da.mimeType LIKE 'image/%' OR da.fileUrl LIKE '%/image/upload/%')
        ORDER BY da.document.id, da.position ASC
        """)
    List<DocumentAttachment> findImageAttachmentsByDocumentIds(
            @Param("docIds") List<Long> docIds);
}
