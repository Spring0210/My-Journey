package com.myjourney.service;

import com.myjourney.dto.PageResponse;
import com.myjourney.dto.PostResponse;
import com.myjourney.exception.AppException;
import com.myjourney.model.Space;
import com.myjourney.model.SpacePost;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpacePostCommentRepository;
import com.myjourney.repository.SpacePostReactionRepository;
import com.myjourney.repository.SpacePostRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class SpacePostService {

    @Autowired
    private SpacePostRepository spacePostRepository;

    @Autowired
    private SpaceRepository spaceRepository;

    @Autowired
    private SpaceMemberRepository spaceMemberRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SpacePostReactionService reactionService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private SpacePostReactionRepository reactionRepository;

    @Autowired
    private SpacePostCommentRepository commentRepository;

    @Autowired
    private SpacePostCommentService commentService;

    @Autowired
    private CloudStorageService cloudStorageService;

    // Create a post in a space — members only
    @Transactional
    public PostResponse createPost(Integer spaceId, Integer userId, String content, List<String> imageUrls, List<String> videoUrls) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (!spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }

        if ((content == null || content.isBlank())
                && (imageUrls == null || imageUrls.isEmpty())
                && (videoUrls == null || videoUrls.isEmpty())) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Post must have content, images, or videos");
        }

        SpacePost post = new SpacePost();
        post.setSpace(space);
        post.setAuthor(user);
        post.setContent(content);
        post.setImagePathList(imageUrls);
        post.setVideoPathList(videoUrls);
        spacePostRepository.save(post);

        // Notify all other space members about the new post
        notificationService.notifyNewPost(post);

        return toDto(post, userId);
    }

    // Get posts in a space — members only, newest first, paginated
    public PageResponse<PostResponse> getPosts(Integer spaceId, Integer userId, int page, int size) {
        Space space = spaceRepository.findById(spaceId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Space not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (!spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }

        Page<SpacePost> result = spacePostRepository.findBySpaceOrderByCreatedAtDesc(
                space, PageRequest.of(page, size));

        List<PostResponse> posts = result.getContent().stream()
                .map(p -> toDto(p, userId))
                .toList();

        return new PageResponse<>(posts, result.getTotalPages(), result.getTotalElements(), result.getNumber());
    }

    // Delete a post — author or space owner only; also deletes images from Cloudinary
    @Transactional
    public void deletePost(Integer postId, Integer userId) {
        SpacePost post = spacePostRepository.findById(postId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Post not found"));

        boolean isAuthor = post.getAuthor().getId().equals(userId);
        boolean isSpaceOwner = post.getSpace().getOwner().getId().equals(userId);

        if (!isAuthor && !isSpaceOwner) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }

        // Delete child records first to avoid foreign key constraint violations
        reactionRepository.deleteByPost(post);
        commentRepository.deleteByPost(post);

        // Clean up images and videos from Cloudinary before deleting the post record
        List<String> imageUrls = post.getImagePathList();
        List<String> videoUrls = post.getVideoPathList();
        spacePostRepository.delete(post);
        if (imageUrls != null && !imageUrls.isEmpty()) {
            cloudStorageService.deleteFiles(imageUrls);
        }
        if (videoUrls != null && !videoUrls.isEmpty()) {
            cloudStorageService.deleteFiles(videoUrls);
        }
    }

    private PostResponse toDto(SpacePost post, Integer requestingUserId) {
        return new PostResponse(
                post.getId(),
                post.getContent(),
                post.getImagePathList(),
                post.getVideoPathList(),
                post.getAuthor().getId(),
                post.getAuthor().getUsername(),
                post.getAuthor().getAvatar(),
                post.getCreatedAt(),
                post.getUpdatedAt(),
                reactionService.buildReactionSummary(post, requestingUserId),
                commentService.getComments(post)
        );
    }
}
