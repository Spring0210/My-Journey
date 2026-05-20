package com.myjourney.dto;

/**
 * One event entry for the FullCalendar frontend.
 * `hasImage` lets the UI render a small camera glyph in the event pill when true.
 */
public record CalendarEventResponse(
        // Long covers both legacy journal_entry IDs (INT, widened) and the
        // new document IDs (BIGINT). Frontend deserializes either as `number`.
        Long id,
        String title,
        String start,
        boolean hasImage
) {}
