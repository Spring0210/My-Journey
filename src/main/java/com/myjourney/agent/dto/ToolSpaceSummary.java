package com.myjourney.agent.dto;

public record ToolSpaceSummary(
        Integer id,
        String name,
        boolean isPersonal,
        long memberCount
) {}
