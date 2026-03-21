package com.myjourney.dto;

import java.util.Map;

/**
 * Emoji reaction state for a single post.
 * counts    — map of emoji → total count (only emojis with ≥1 reaction are included)
 * myReaction — the requesting user's current emoji, or null if they haven't reacted
 */
public record ReactionSummary(
        Map<String, Long> counts,
        String myReaction
) {}
