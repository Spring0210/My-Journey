package com.myjourney.service;

import com.myjourney.dto.NotificationResponse;
import com.myjourney.exception.AppException;
import com.myjourney.model.Notification;
import com.myjourney.model.Notification.Type;
import com.myjourney.model.SpacePost;
import com.myjourney.model.User;
import com.myjourney.repository.NotificationRepository;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private SpaceMemberRepository spaceMemberRepository;

    @Autowired
    private UserRepository userRepository;

    // Notify all space members (except the poster) when a new post is created
    @Transactional
    public void notifyNewPost(SpacePost post) {
        String actorUsername = post.getAuthor().getUsername();
        Integer postId = post.getId();
        Integer spaceId = post.getSpace().getId();
        String spaceName = post.getSpace().getName();

        // Get all space members except the post author
        spaceMemberRepository.findBySpace(post.getSpace()).forEach(member -> {
            if (!member.getUser().getId().equals(post.getAuthor().getId())) {
                Notification n = new Notification();
                n.setRecipient(member.getUser());
                n.setType(Type.NEW_POST);
                n.setActorUsername(actorUsername);
                n.setSpaceId(spaceId);
                n.setSpaceName(spaceName);
                n.setPostId(postId);
                notificationRepository.save(n);
            }
        });
    }

    // Notify the post author when someone else comments on their post
    @Transactional
    public void notifyNewComment(SpacePost post, User commenter) {
        // Don't notify if the author is commenting on their own post
        if (post.getAuthor().getId().equals(commenter.getId())) return;

        Notification n = new Notification();
        n.setRecipient(post.getAuthor());
        n.setType(Type.NEW_COMMENT);
        n.setActorUsername(commenter.getUsername());
        n.setSpaceId(post.getSpace().getId());
        n.setSpaceName(post.getSpace().getName());
        n.setPostId(post.getId());
        notificationRepository.save(n);
    }

    // Get all notifications for the current user
    public List<NotificationResponse> getNotifications(Integer userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return notificationRepository.findByRecipientOrderByCreatedAtDesc(user).stream()
                .map(this::toDto)
                .toList();
    }

    // Get unread notification count for the current user
    public long getUnreadCount(Integer userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return notificationRepository.countByRecipientAndReadFalse(user);
    }

    // Mark all notifications as read for the current user
    @Transactional
    public void markAllRead(Integer userId) {
        User user = userRepository.findById(userId).orElseThrow();
        notificationRepository.markAllReadByRecipient(user);
    }

    // Delete a single notification — only the recipient can delete it
    @Transactional
    public void deleteNotification(Integer notifId, Integer userId) {
        Notification n = notificationRepository.findById(notifId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Notification not found"));
        if (!n.getRecipient().getId().equals(userId)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }
        notificationRepository.delete(n);
    }

    // Delete all notifications for the current user
    @Transactional
    public void deleteAllNotifications(Integer userId) {
        User user = userRepository.findById(userId).orElseThrow();
        notificationRepository.deleteAllByRecipient(user);
    }

    private NotificationResponse toDto(Notification n) {
        // Look up actor's avatar so the frontend can display it
        String actorAvatar = userRepository.findByUsername(n.getActorUsername())
                .map(User::getAvatar)
                .orElse(null);

        return new NotificationResponse(
                n.getId(),
                n.getType().name(),
                n.getActorUsername(),
                actorAvatar,
                n.getSpaceId(),
                n.getSpaceName(),
                n.getPostId(),
                n.isRead(),
                n.getCreatedAt()
        );
    }
}
