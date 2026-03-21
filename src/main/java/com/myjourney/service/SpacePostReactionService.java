package com.myjourney.service;

import com.myjourney.dto.ReactionSummary;
import com.myjourney.exception.AppException;
import com.myjourney.model.SpacePost;
import com.myjourney.model.SpacePostReaction;
import com.myjourney.model.User;
import com.myjourney.repository.SpaceMemberRepository;
import com.myjourney.repository.SpacePostReactionRepository;
import com.myjourney.repository.SpacePostRepository;
import com.myjourney.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
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

    // Add or switch a reaction; returns updated reaction summary for the post
    @Transactional
    public ReactionSummary addOrUpdateReaction(Integer postId, Integer userId, String emoji) {
        if (!ALLOWED_EMOJIS.contains(emoji)) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Invalid emoji");
        }

        SpacePost post = spacePostRepository.findById(postId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Post not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        if (!spaceMemberRepository.existsBySpaceAndUser(post.getSpace(), user)) {
            throw new AppException(HttpStatus.FORBIDDEN, "Access denied");
        }

        // Upsert: update emoji if a reaction already exists, otherwise create a new one
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
    public ReactionSummary removeReaction(Integer postId, Integer userId) {
        SpacePost post = spacePostRepository.findById(postId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Post not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "User not found"));

        reactionRepository.findByPostAndUser(post, user)
                .ifPresent(reactionRepository::delete);

        return buildReactionSummary(post, userId);
    }

    // Build ReactionSummary: { counts: {emoji: count}, myReaction: "❤️" | null }
    public ReactionSummary buildReactionSummary(SpacePost post, Integer userId) {
        // Aggregate counts per emoji
        List<Object[]> rows = reactionRepository.countByPostGroupByEmoji(post);
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Object[] row : rows) {
            counts.put((String) row[0], (Long) row[1]);
        }

        // Current user's reaction (null if none)
        String myReaction = null;
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            myReaction = reactionRepository.findByPostAndUser(post, user)
                    .map(SpacePostReaction::getEmoji)
                    .orElse(null);
        }

        return new ReactionSummary(counts, myReaction);
    }
}
