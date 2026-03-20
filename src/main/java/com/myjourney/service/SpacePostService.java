package com.myjourney.service;

import com.myjourney.model.Space;
import com.myjourney.model.SpacePost;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpacePostRepository;
import com.myjourney.repository.SpaceRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    // Create a post in a space (members only)
    @Transactional
    public Map<String, Object> createPost(Integer spaceId, Integer userId, String content, List<String> imageUrls) {
        Map<String, Object> response = new HashMap<>();

        Space space = spaceRepository.findById(spaceId).orElse(null);
        if (space == null) {
            response.put("error", "Space not found");
            return response;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            response.put("error", "Access denied");
            return response;
        }

        if ((content == null || content.isBlank()) && (imageUrls == null || imageUrls.isEmpty())) {
            response.put("error", "Post must have content or images");
            return response;
        }

        SpacePost post = new SpacePost();
        post.setSpace(space);
        post.setAuthor(user);
        post.setContent(content);
        post.setImagePathList(imageUrls);
        spacePostRepository.save(post);

        return toMap(post);
    }

    // Get posts in a space (members only), newest first, paginated
    public Map<String, Object> getPosts(Integer spaceId, Integer userId, int page, int size) {
        Map<String, Object> response = new HashMap<>();

        Space space = spaceRepository.findById(spaceId).orElse(null);
        if (space == null) {
            response.put("error", "Space not found");
            return response;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !spaceMemberRepository.existsBySpaceAndUser(space, user)) {
            response.put("error", "Access denied");
            return response;
        }

        Page<SpacePost> result = spacePostRepository.findBySpaceOrderByCreatedAtDesc(
                space, PageRequest.of(page, size));

        response.put("content", result.getContent().stream().map(this::toMap).toList());
        response.put("totalPages", result.getTotalPages());
        response.put("totalElements", result.getTotalElements());
        response.put("currentPage", result.getNumber());
        return response;
    }

    // Delete a post (author or space owner only)
    @Transactional
    public Map<String, Object> deletePost(Integer postId, Integer userId) {
        Map<String, Object> response = new HashMap<>();

        Optional<SpacePost> postOpt = spacePostRepository.findById(postId);
        if (postOpt.isEmpty()) {
            response.put("error", "Post not found");
            return response;
        }

        SpacePost post = postOpt.get();
        boolean isAuthor = post.getAuthor().getId().equals(userId);
        boolean isSpaceOwner = post.getSpace().getOwner().getId().equals(userId);

        if (!isAuthor && !isSpaceOwner) {
            response.put("error", "Access denied");
            return response;
        }

        response.put("imageUrls", post.getImagePathList());
        spacePostRepository.delete(post);
        response.put("message", "Post deleted successfully");
        return response;
    }

    private Map<String, Object> toMap(SpacePost post) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", post.getId());
        map.put("content", post.getContent());
        map.put("images", post.getImagePathList());
        map.put("authorId", post.getAuthor().getId());
        map.put("authorUsername", post.getAuthor().getUsername());
        map.put("authorAvatar", post.getAuthor().getAvatar()); // include avatar for frontend display
        map.put("createdAt", post.getCreatedAt());
        map.put("updatedAt", post.getUpdatedAt());
        return map;
    }
}
