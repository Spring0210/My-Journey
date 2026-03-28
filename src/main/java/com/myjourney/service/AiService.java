package com.myjourney.service;

import com.myjourney.model.JournalEntry;
import com.myjourney.model.SpacePost;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    @Value("${anthropic.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    // Generate a warm recap of a space's recent activity using Claude Haiku
    public String generateSpaceSummary(String spaceName, List<SpacePost> posts) {
        StringBuilder postsText = new StringBuilder();
        // Reverse to chronological order (oldest first) so Claude reads the timeline naturally
        List<SpacePost> chronological = new ArrayList<>(posts);
        Collections.reverse(chronological);
        // Include post date so Claude can reference time context ("last week", etc.)
        for (SpacePost post : chronological) {
            postsText.append("- [").append(post.getAuthor().getUsername())
                     .append(", ").append(post.getCreatedAt().toLocalDate()).append("]: ");
            if (post.getContent() != null && !post.getContent().isBlank()) {
                postsText.append(post.getContent().trim());
            }
            int imgCount = post.getImagePathList().size();
            int vidCount = post.getVideoPathList().size();
            if (imgCount > 0) postsText.append(" [").append(imgCount).append(" photo(s)]");
            if (vidCount > 0) postsText.append(" [").append(vidCount).append(" video(s)]");
            postsText.append("\n");
        }

        String prompt = String.format(
            "These are recent posts from a shared space called \"%s\":\n\n%s\n" +
            "Write a short, genuine recap of this group's recent activity (3-5 sentences). " +
            "Mention specific people and moments from the posts. " +
            "Write like a thoughtful friend summarizing what the group has been up to — natural and personal, not generic. " +
            "Reply in the same language as the posts. " +
            "Plain text only: no emoji, no bullet points, no markdown.",
            spaceName, postsText
        );

        // Use system prompt to enforce plain text output at the model level
        Map<String, Object> requestBody = Map.of(
            "model", "claude-haiku-4-5-20251001",
            "max_tokens", 512,
            "system", "You are a concise, warm writer. Output plain text only — no emoji, no bullet points, no markdown, no headers.",
            "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                "https://api.anthropic.com/v1/messages", request, Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
            return (String) content.get(0).get("text");
        } catch (Exception e) {
            log.error("Anthropic API call failed", e);
            throw new RuntimeException("Failed to generate summary");
        }
    }

    // Extract 2-3 search keywords from a natural language query for journal search
    public List<String> extractSearchKeywords(String query) {
        String prompt = String.format(
            "The user wants to search their personal journal with this query: \"%s\"\n" +
            "Extract 2-3 essential search keywords from this query. " +
            "Focus on names, places, topics, and emotions — not stop words. " +
            "Output only the keywords separated by |||. No explanation, no extra text.",
            query
        );

        Map<String, Object> requestBody = Map.of(
            "model", "claude-haiku-4-5-20251001",
            "max_tokens", 60,
            "system", "You extract search keywords. Output only the keywords separated by |||. No extra text.",
            "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                "https://api.anthropic.com/v1/messages", request, Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
            String text = (String) content.get(0).get("text");
            return Arrays.stream(text.split("\\|\\|\\|"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .limit(3)
                .toList();
        } catch (Exception e) {
            log.error("Anthropic API call failed for keyword extraction", e);
            throw new RuntimeException("Failed to extract search keywords");
        }
    }

    // Generate 3 personalized writing prompts based on the user's recent journal entries
    public List<String> generateWritingPrompts(List<JournalEntry> entries) {
        StringBuilder entriesText = new StringBuilder();
        for (JournalEntry entry : entries) {
            entriesText.append("- [").append(entry.getEntryDate()).append("] ").append(entry.getTitle());
            if (entry.getContent() != null && !entry.getContent().isBlank()) {
                String content = entry.getContent().trim();
                // Truncate to keep the prompt concise
                if (content.length() > 200) content = content.substring(0, 200) + "...";
                entriesText.append(": ").append(content);
            }
            entriesText.append("\n");
        }

        String prompt = String.format(
            "Here are some recent journal entries:\n\n%s\n" +
            "Based on recurring themes, emotions, and topics in these entries, generate 3 personalized writing prompts " +
            "that help this person explore their experiences more deeply. " +
            "Make the prompts specific to what this person has been writing about — not generic. " +
            "Reply in the same language as the entries. " +
            "Output exactly 3 prompts separated by |||. No numbering, no extra text.",
            entriesText
        );

        Map<String, Object> requestBody = Map.of(
            "model", "claude-haiku-4-5-20251001",
            "max_tokens", 400,
            "system", "You are a thoughtful writing coach. Output exactly 3 journal writing prompts separated by |||. No numbering, no extra text before or after.",
            "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                "https://api.anthropic.com/v1/messages", request, Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
            String text = (String) content.get(0).get("text");
            // Split on ||| separator and return up to 3 non-blank prompts
            return Arrays.stream(text.split("\\|\\|\\|"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .limit(3)
                .toList();
        } catch (Exception e) {
            log.error("Anthropic API call failed for writing prompts", e);
            throw new RuntimeException("Failed to generate writing prompts");
        }
    }

    // Generate a personal monthly reflection from a user's journal entries
    public String generateJournalMonthlyRecap(String username, int year, int month,
                                               List<JournalEntry> entries) {
        StringBuilder entriesText = new StringBuilder();
        for (JournalEntry entry : entries) {
            entriesText.append("- [").append(entry.getEntryDate()).append("] ")
                       .append(entry.getTitle());
            if (entry.getContent() != null && !entry.getContent().isBlank()) {
                // Truncate long entries to keep prompt size reasonable
                String content = entry.getContent().trim();
                if (content.length() > 300) content = content.substring(0, 300) + "...";
                entriesText.append(": ").append(content);
            }
            entriesText.append("\n");
        }

        String monthName = java.time.Month.of(month)
                .getDisplayName(TextStyle.FULL, Locale.ENGLISH);

        String prompt = String.format(
            "These are %s's journal entries from %s %d:\n\n%s\n" +
            "Write a warm, personal monthly reflection (3-5 sentences) as if looking back on this month. " +
            "Reference specific moments, emotions, or themes from the entries. " +
            "Write in second person (\"you\") addressing the journal writer directly. " +
            "Reply in the same language as the entries. " +
            "Plain text only: no emoji, no bullet points, no markdown.",
            username, monthName, year, entriesText
        );

        Map<String, Object> requestBody = Map.of(
            "model", "claude-haiku-4-5-20251001",
            "max_tokens", 512,
            "system", "You are a warm, thoughtful writer helping someone reflect on their personal journal. " +
                      "Output plain text only — no emoji, no bullet points, no markdown, no headers.",
            "messages", List.of(Map.of("role", "user", "content", prompt))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                "https://api.anthropic.com/v1/messages", request, Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
            return (String) content.get(0).get("text");
        } catch (Exception e) {
            log.error("Anthropic API call failed for journal recap", e);
            throw new RuntimeException("Failed to generate recap");
        }
    }
}
