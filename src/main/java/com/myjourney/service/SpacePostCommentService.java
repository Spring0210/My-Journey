package com.myjourney.service;

import com.myjourney.dto.CommentResponse;
import com.myjourney.exception.AppException;
import com.myjourney.model.SpacePost;
import com.myjourney.model.SpacePostComment;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpacePostCommentRepository;
import com.myjourney.repository.SpacePostRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SpacePostCommentService {

    @Autowired
    private SpacePostCommentRepository commentRepository;

    @Autowired
    private SpacePostRepository postRepository;

    @Autowired
    private SpaceMemberRepository spaceMemberRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    // Add a comment to a post — members only
    @Transactional
    public CommentResponse addComment(Integer postId, Integer userId, String content) {
        if (content == null || content.isBlank()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Comment cannot be empty");
        }

        SpacePost post = postRepository.findById(postId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Post not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (!spaceMemberRepository.existsBySpaceAndUser(post.getSpace(), user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }

        SpacePostComment comment = new SpacePostComment();
        comment.setPost(post);
        comment.setAuthor(user);
        comment.setContent(content.trim());
        commentRepository.save(comment);

        // Notify the post author about the new comment (skips if commenter is the author)
        notificationService.notifyNewComment(post, user);

        return toDto(comment);
    }

    // Delete a comment — author or space owner only
    @Transactional
    public void deleteComment(Integer commentId, Integer userId) {
        SpacePostComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Comment not found"));

        boolean isAuthor = comment.getAuthor().getId().equals(userId);
        boolean isSpaceOwner = comment.getPost().getSpace().getOwner().getId().equals(userId);

        if (!isAuthor && !isSpaceOwner) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }

        commentRepository.delete(comment);
    }

    // Get all comments for a post as DTOs, oldest first
    public List<CommentResponse> getComments(SpacePost post) {
        return commentRepository.findByPostOrderByCreatedAtAsc(post).stream()
                .map(this::toDto)
                .toList();
    }

    private CommentResponse toDto(SpacePostComment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getContent(),
                comment.getAuthor().getId(),
                comment.getAuthor().getUsername(),
                comment.getAuthor().getAvatar(),
                comment.getCreatedAt()
        );
    }
}
