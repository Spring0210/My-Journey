package com.myjourney.dto;

/**
 * One event entry for the FullCalendar frontend.
 * `hasImage` lets the UI render a small camera glyph in the event pill when true.
 */
public record CalendarEventResponse(
        Integer id,
        String title,
        String start,
        boolean hasImage
) {}
