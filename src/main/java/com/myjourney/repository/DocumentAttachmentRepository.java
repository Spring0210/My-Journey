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
}
