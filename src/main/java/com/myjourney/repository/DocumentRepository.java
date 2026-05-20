package com.myjourney.repository;

import com.myjourney.model.Document;
import com.myjourney.model.Space;
import com.myjourney.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    Page<Document> findBySpace(Space space, Pageable pageable);

    Page<Document> findBySpaceAndDocType(Space space, Document.DocType docType, Pageable pageable);

    // Used by journal Calendar / Heatmap views — JOURNAL docs only.
    List<Document> findBySpaceAndDocTypeAndEntryDateBetween(
            Space space, Document.DocType docType, LocalDate from, LocalDate to);

    long countByAuthor(User author);
}
