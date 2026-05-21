package com.myjourney.agent;

import com.myjourney.agent.dto.ToolComment;
import com.myjourney.agent.dto.ToolDocumentDetail;
import com.myjourney.agent.dto.ToolSearchResult;
import com.myjourney.agent.dto.ToolSpaceSummary;

import java.time.LocalDate;
import java.util.List;

// The 8 tools the internal agent (and later the MCP server) can call.
// All methods are access-checked against the authenticated user -- the
// implementation MUST refuse access to spaces the user is not a member of.
//
// See docs/superpowers/specs/2026-05-19-team-kb-mcp-design.md section 4.
public interface DocumentToolset {

    // -- Read tools ------------------------------------------------

    // Keyword search. spaceId=null means search every space the caller is in.
    ToolSearchResult searchDocuments(
            Integer callerUserId,
            String query,
            Integer spaceId,
            LocalDate dateFrom,
            LocalDate dateTo,
            List<String> tags,   // AND match (lowercase); null = no tag filter
            int limit            // capped to 25
    );

    ToolDocumentDetail getDocument(Integer callerUserId, Long documentId);

    List<ToolSpaceSummary> listSpaces(Integer callerUserId);

    // Paginated listing inside one space.
    ToolSearchResult listDocuments(
            Integer callerUserId,
            Integer spaceId,
            LocalDate since,
            String tag,
            int limit,
            int offset
    );

    List<ToolComment> getComments(Integer callerUserId, Long documentId);

    // -- Write tools -----------------------------------------------

    // spaceId=null routes to the caller's personal space.
    // doc_type is derived server-side from space.isPersonal (the LLM has no
    // say). entryDate is only meaningful for personal-space docs (defaults
    // to today when null); it's ignored in shared spaces.
    ToolDocumentDetail createDocument(
            Integer callerUserId,
            String title,
            String content,
            Integer spaceId,
            LocalDate entryDate,
            List<String> tags
    );

    // Author-only. null fields mean "unchanged"; an empty tags list clears tags.
    ToolDocumentDetail updateDocument(
            Integer callerUserId,
            Long documentId,
            String title,
            String content,
            List<String> tags
    );

    ToolComment addComment(Integer callerUserId, Long documentId, String content);

    // Create a brand-new shared Space owned by the caller. Returns the
    // Space summary so the agent can immediately reference the new id (e.g.
    // by creating a document inside it on the very next tool call).
    ToolSpaceSummary createSpace(
            Integer callerUserId,
            String name,
            String description
    );
}
