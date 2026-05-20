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

    // ID-based variant — used by paths that hold a Document proxy whose
    // associations may already be in REMOVED state (e.g. just after deleting
    // a sibling attachment within the same transaction). Avoids relying on
    // Hibernate's proxy lookup machinery for the WHERE clause.
    List<DocumentAttachment> findByDocument_IdOrderByPositionAsc(Long documentId);

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

    // Batch fetch video attachments for a page of documents. Cloudinary stores
    // videos under `/video/upload/` so the URL pattern catches legacy migrated
    // rows where mime_type was set to NULL during the V4 backfill.
    @Query("""
        SELECT da FROM DocumentAttachment da
        WHERE da.document.id IN :docIds
          AND (da.mimeType LIKE 'video/%' OR da.fileUrl LIKE '%/video/upload/%')
        ORDER BY da.document.id, da.position ASC
        """)
    List<DocumentAttachment> findVideoAttachmentsByDocumentIds(
            @Param("docIds") List<Long> docIds);

    // String-projection variant for deleteDocument. Returns just the Cloudinary
    // URLs without loading DocumentAttachment entities into the session — a
    // session full of managed attachments referencing the about-to-be-removed
    // Document confuses Hibernate at flush time and surfaces as a
    // TransientObjectException ("persistent instance references an unsaved
    // transient instance of Document").
    @Query("""
        SELECT da.fileUrl FROM DocumentAttachment da
        WHERE da.document.id = :docId
        ORDER BY da.position ASC
        """)
    List<String> findFileUrlsByDocumentId(@Param("docId") Long docId);
}
