package com.myjourney.repository;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JournalRepository extends JpaRepository<JournalEntry, Integer> {
    List<JournalEntry> findByUser(User user);
    Page<JournalEntry> findByUser(User user, Pageable pageable);
}
