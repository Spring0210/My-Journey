package com.myjourney.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

// JSON tool schemas advertised to Claude. The names match what the agent
// loop dispatches on, and the descriptions guide Claude's tool selection.
// Keep the names stable -- MCP clients will rely on the same identifiers.
public final class ToolSchemas {

    private ToolSchemas() {}

    public static final String NAME_SEARCH_DOCUMENTS = "search_documents";
    public static final String NAME_GET_DOCUMENT     = "get_document";
    public static final String NAME_LIST_SPACES      = "list_spaces";
    public static final String NAME_LIST_DOCUMENTS   = "list_documents";
    public static final String NAME_GET_COMMENTS     = "get_comments";
    public static final String NAME_CREATE_DOCUMENT  = "create_document";
    public static final String NAME_UPDATE_DOCUMENT  = "update_document";
    public static final String NAME_ADD_COMMENT      = "add_comment";
    public static final String NAME_CREATE_SPACE     = "create_space";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static JsonNode allSchemas() {
        try {
            return MAPPER.readTree("""
            [
              {
                "name": "search_documents",
                "description": "Search the user's knowledge base by keyword. Returns the top matching documents with snippets. Call get_document afterward to read full content. Use this whenever the user's question references things that may be in their notes or journal.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "query": {"type": "string", "description": "Search keywords"},
                    "space_id": {"type": ["integer","null"], "description": "Optional space id to restrict to. Null = search every space the user is a member of."},
                    "date_from": {"type": ["string","null"], "format": "date"},
                    "date_to":   {"type": ["string","null"], "format": "date"},
                    "tags":  {"type": ["array","null"], "items": {"type": "string"}, "description": "AND match"},
                    "limit": {"type": "integer", "default": 10, "maximum": 25}
                  },
                  "required": ["query"]
                }
              },
              {
                "name": "get_document",
                "description": "Fetch the full content of a document by id, including attachments and recent comments.",
                "input_schema": {
                  "type": "object",
                  "properties": { "document_id": {"type": "integer"} },
                  "required": ["document_id"]
                }
              },
              {
                "name": "list_spaces",
                "description": "List all spaces the user is a member of, with their personal-space flag and member count.",
                "input_schema": { "type": "object", "properties": {} }
              },
              {
                "name": "list_documents",
                "description": "Paginate documents inside a specific space, optionally filtered by docType (JOURNAL or NOTE), creation date, or a single tag.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "space_id": {"type": "integer"},
                    "doc_type": {"type": ["string","null"], "enum": ["JOURNAL", "NOTE", null]},
                    "since":    {"type": ["string","null"], "format": "date"},
                    "tag":      {"type": ["string","null"]},
                    "limit":    {"type": "integer", "default": 10, "maximum": 25},
                    "offset":   {"type": "integer", "default": 0}
                  },
                  "required": ["space_id"]
                }
              },
              {
                "name": "get_comments",
                "description": "Return comments on a document in chronological order.",
                "input_schema": {
                  "type": "object",
                  "properties": { "document_id": {"type": "integer"} },
                  "required": ["document_id"]
                }
              },
              {
                "name": "create_document",
                "description": "Create a new document. If space_id is omitted, creates in the user's personal space. entry_date is required when doc_type is JOURNAL.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "title":      {"type": "string"},
                    "content":    {"type": "string"},
                    "space_id":   {"type": ["integer","null"]},
                    "doc_type":   {"type": ["string","null"], "enum": ["JOURNAL", "NOTE", null], "default": "NOTE"},
                    "entry_date": {"type": ["string","null"], "format": "date"},
                    "tags":       {"type": ["array","null"], "items": {"type": "string"}}
                  },
                  "required": ["title", "content"]
                }
              },
              {
                "name": "update_document",
                "description": "Update an existing document. Only the author can update. Pass null for fields you do not want to change. Passing an empty list for tags clears all tags.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "document_id": {"type": "integer"},
                    "title":       {"type": ["string","null"]},
                    "content":     {"type": ["string","null"]},
                    "tags":        {"type": ["array","null"], "items": {"type": "string"}}
                  },
                  "required": ["document_id"]
                }
              },
              {
                "name": "add_comment",
                "description": "Add a comment to a document. Any space member can comment.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "document_id": {"type": "integer"},
                    "content":     {"type": "string"}
                  },
                  "required": ["document_id", "content"]
                }
              },
              {
                "name": "create_space",
                "description": "Create a brand-new shared Space the user can later publish documents into. The user automatically becomes the OWNER. A non-empty name is required; description is optional. Use this when the user explicitly asks to set up a new workspace, team area, or shared knowledge base. Do NOT use it to write a private note -- create_document with no space_id already routes to the user's personal space.",
                "input_schema": {
                  "type": "object",
                  "properties": {
                    "name":        {"type": "string"},
                    "description": {"type": ["string","null"]}
                  },
                  "required": ["name"]
                }
              }
            ]
            """);
        } catch (Exception e) {
            throw new IllegalStateException("Bad tool schema JSON literal", e);
        }
    }

    public static List<String> names() {
        return List.of(
                NAME_SEARCH_DOCUMENTS, NAME_GET_DOCUMENT, NAME_LIST_SPACES,
                NAME_LIST_DOCUMENTS, NAME_GET_COMMENTS, NAME_CREATE_DOCUMENT,
                NAME_UPDATE_DOCUMENT, NAME_ADD_COMMENT, NAME_CREATE_SPACE);
    }
}
