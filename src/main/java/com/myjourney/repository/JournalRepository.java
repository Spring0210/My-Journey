package com.myjourney.repository;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JournalRepository extends JpaRepository<JournalEntry, Integer> {
    List<JournalEntry> findByUser(User user);
}
