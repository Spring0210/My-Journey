package com.myjourney.dto;

import java.time.LocalDate;

/** One data point on the year heatmap — the date and entry count for that day. */
public record HeatmapPoint(
        LocalDate date,
        Long count
) {}
