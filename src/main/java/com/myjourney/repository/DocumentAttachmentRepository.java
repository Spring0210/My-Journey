package com.myjourney.repository;

import com.myjourney.model.Document;
import com.myjourney.model.DocumentAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentAttachmentRepository extends JpaRepository<DocumentAttachment, Long> {

    List<DocumentAttachment> findByDocumentOrderByPositionAsc(Document document);

    void deleteByDocument(Document document);
}
