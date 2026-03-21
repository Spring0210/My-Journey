package com.myjourney.service;

import com.myjourney.model.SpacePost;
import com.myjourney.model.SpacePostReaction;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpacePostReactionRepository;
import com.myjourney.repository.SpacePostRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class SpacePostReactionService {

    // Allowed emoji set
    private static final Set<String> ALLOWED_EMOJIS = Set.of("❤️", "👍", "😂", "🐮", "🥲", "😭", "😮");

    @Autowired
    private SpacePostReactionRepository reactionRepository;

    @Autowired
    private SpacePostRepository spacePostRepository;

    @Autowired
    private SpaceMemberRepository spaceMemberRepository;

    @Autowired
    private UserRepository userRepository;

    // Add or switch a reaction. Returns updated reaction counts for the post.
    @Transactional
    public Map<String, Object> addOrUpdateReaction(Integer postId, Integer userId, String emoji) {
        Map<String, Object> response = new HashMap<>();

        if (!ALLOWED_EMOJIS.contains(emoji)) {
            response.put("error", "Invalid emoji");
            return response;
        }

        SpacePost post = spacePostRepository.findById(postId).orElse(null);
        if (post == null) {
            response.put("error", "Post not found");
            return response;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null || !spaceMemberRepository.existsBySpaceAndUser(post.getSpace(), user)) {
            response.put("error", "Access denied");
            return response;
        }

        // Upsert: update emoji if reaction exists, otherwise create new
        Optional<SpacePostReaction> existing = reactionRepository.findByPostAndUser(post, user);
        if (existing.isPresent()) {
            existing.get().setEmoji(emoji);
            reactionRepository.save(existing.get());
        } else {
            SpacePostReaction reaction = new SpacePostReaction();
            reaction.setPost(post);
            reaction.setUser(user);
            reaction.setEmoji(emoji);
            reactionRepository.save(reaction);
        }

        return buildReactionSummary(post, userId);
    }

    // Remove the current user's reaction from a post
    @Transactional
    public Map<String, Object> removeReaction(Integer postId, Integer userId) {
        Map<String, Object> response = new HashMap<>();

        SpacePost post = spacePostRepository.findById(postId).orElse(null);
        if (post == null) {
            response.put("error", "Post not found");
            return response;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            response.put("error", "Access denied");
            return response;
        }

        reactionRepository.findByPostAndUser(post, user)
                .ifPresent(reactionRepository::delete);

        return buildReactionSummary(post, userId);
    }

    // Build a map of { counts: {emoji: count}, myReaction: "❤️" | null }
    public Map<String, Object> buildReactionSummary(SpacePost post, Integer userId) {
        Map<String, Object> summary = new HashMap<>();

        // Aggregate counts per emoji
        List<Object[]> rows = reactionRepository.countByPostGroupByEmoji(post);
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Object[] row : rows) {
            counts.put((String) row[0], (Long) row[1]);
        }
        summary.put("counts", counts);

        // Current user's reaction (null if none)
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            reactionRepository.findByPostAndUser(post, user)
                    .ifPresentOrElse(
                            r -> summary.put("myReaction", r.getEmoji()),
                            () -> summary.put("myReaction", null)
                    );
        } else {
            summary.put("myReaction", null);
        }

        return summary;
    }
}
