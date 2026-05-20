package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.myjourney.exception.AppException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// Parses an Anthropic tool_use block (name + input JSON) and calls the
// matching DocumentToolset method. Returns the toolset's return value so
// AgentService can serialize it back into a tool_result content block.
//
// Kept separate from AgentService so the dispatch logic can be unit-tested
// without booting the Anthropic loop or a Spring context.
@Component
public class ToolDispatcher {

    private final DocumentToolset toolset;

    @Autowired
    public ToolDispatcher(DocumentToolset toolset) {
        this.toolset = toolset;
    }

    public Object dispatch(Integer userId, String toolName, JsonNode args) {
        return switch (toolName) {
            case ToolSchemas.NAME_SEARCH_DOCUMENTS -> toolset.searchDocuments(
                    userId,
                    str(args, "query"),
                    intOrNull(args, "space_id"),
                    date(args, "date_from"),
                    date(args, "date_to"),
                    strList(args, "tags"),
                    intOrDefault(args, "limit", 10));
            case ToolSchemas.NAME_GET_DOCUMENT -> toolset.getDocument(
                    userId,
                    longRequired(args, "document_id"));
            case ToolSchemas.NAME_LIST_SPACES -> toolset.listSpaces(userId);
            case ToolSchemas.NAME_LIST_DOCUMENTS -> toolset.listDocuments(
                    userId,
                    intOrNull(args, "space_id"),
                    strOrNull(args, "doc_type"),
                    date(args, "since"),
                    strOrNull(args, "tag"),
                    intOrDefault(args, "limit", 10),
                    intOrDefault(args, "offset", 0));
            case ToolSchemas.NAME_GET_COMMENTS -> toolset.getComments(
                    userId,
                    longRequired(args, "document_id"));
            case ToolSchemas.NAME_CREATE_DOCUMENT -> toolset.createDocument(
                    userId,
                    str(args, "title"),
                    str(args, "content"),
                    intOrNull(args, "space_id"),
                    strOrNull(args, "doc_type"),
                    date(args, "entry_date"),
                    strList(args, "tags"));
            case ToolSchemas.NAME_UPDATE_DOCUMENT -> toolset.updateDocument(
                    userId,
                    longRequired(args, "document_id"),
                    strOrNull(args, "title"),
                    strOrNull(args, "content"),
                    strList(args, "tags"));
            case ToolSchemas.NAME_ADD_COMMENT -> toolset.addComment(
                    userId,
                    longRequired(args, "document_id"),
                    str(args, "content"));
            default -> throw new AppException(HttpStatus.BAD_REQUEST,
                    "Unknown tool name: " + toolName);
        };
    }

    // -- arg parsers (Anthropic args are always a JSON object) ------------

    private static String str(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Missing required arg: " + key);
        }
        return args.get(key).asText();
    }

    private static String strOrNull(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return null;
        return args.get(key).asText();
    }

    private static Integer intOrNull(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return null;
        return args.get(key).asInt();
    }

    private static int intOrDefault(JsonNode args, String key, int def) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return def;
        return args.get(key).asInt();
    }

    private static Long longRequired(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Missing required arg: " + key);
        }
        return args.get(key).asLong();
    }

    private static LocalDate date(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return null;
        try {
            return LocalDate.parse(args.get(key).asText());
        } catch (Exception e) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Invalid date for " + key);
        }
    }

    private static List<String> strList(JsonNode args, String key) {
        if (args == null || !args.has(key) || args.get(key).isNull()) return null;
        List<String> out = new ArrayList<>();
        for (JsonNode n : args.get(key)) out.add(n.asText());
        return out;
    }
}
