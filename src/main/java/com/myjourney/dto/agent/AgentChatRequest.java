package com.myjourney.dto.agent;

import java.util.List;

// Inbound payload for POST /api/agent/chat. conversationId=null starts a new
// conversation; attachmentUrls are Cloudinary URLs the user already uploaded.
//
// crossSpace = true switches the agent into "all my spaces" scope: the system
// prompt no longer pins to a single space, and the model is told to leave
// space_id null when calling search_documents. The conversation row still
// lives in a concrete space (the caller's personal space, supplied as
// spaceId), since agent_conversation requires a non-null space_id.
public record AgentChatRequest(
        Integer spaceId,
        Long conversationId,
        String message,
        List<String> attachmentUrls,
        Boolean crossSpace
) {}
