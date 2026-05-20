package com.myjourney.repository;

import com.myjourney.model.Document;
import com.myjourney.model.DocumentComment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentCommentRepository extends JpaRepository<DocumentComment, Long> {

    List<DocumentComment> findByDocumentOrderByCreatedAtAsc(Document document);

    Page<DocumentComment> findByDocumentOrderByCreatedAtAsc(Document document, Pageable pageable);

    long countByDocument(Document document);

    void deleteByDocument(Document document);
}
