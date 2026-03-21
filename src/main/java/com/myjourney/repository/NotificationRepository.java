package com.myjourney.repository;

import com.myjourney.model.Notification;
import com.myjourney.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    // Get all notifications for a user, newest first
    List<Notification> findByRecipientOrderByCreatedAtDesc(User recipient);

    // Count unread notifications for a user
    long countByRecipientAndReadFalse(User recipient);

    // Mark all of a user's notifications as read in one query
    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.recipient = :recipient AND n.read = false")
    void markAllReadByRecipient(@Param("recipient") User recipient);

    // Delete all notifications for a user
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.recipient = :recipient")
    void deleteAllByRecipient(@Param("recipient") User recipient);
}
