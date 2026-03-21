package com.myjourney.dto;

/** One event entry for the FullCalendar frontend (id, title, ISO date string). */
public record CalendarEventResponse(
        Integer id,
        String title,
        String start
) {}
