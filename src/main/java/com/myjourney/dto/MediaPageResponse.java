package com.myjourney.dto;

import java.util.List;

// One page of the user's media library.
// nextCursor is null when the last page has been reached. Cursor format is
// "{source_date}_{id}" — passed straight back to /api/media via the
// ?cursor= query param.
public record MediaPageResponse(
        List<MediaResponse> items,
        String nextCursor
) {}
