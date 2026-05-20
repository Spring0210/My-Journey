package com.myjourney.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

// Denormalized media record. One row per (sourceType, sourceId, position).
// Written via MediaSyncService whenever a JournalEntry or SpacePost is
// created / updated / deleted. Powers the /api/media library page.
@Entity
@Table(
    name = "media",
    indexes = {
        @Index(name = "idx_media_user_date",      columnList = "user_id, source_date DESC, id DESC"),
        @Index(name = "idx_media_user_type_date", columnList = "user_id, type, source_date DESC, id DESC"),
        @Index(name = "idx_media_source",         columnList = "source_type, source_id")
    }
)
public class Media {

    public enum Type { IMAGE, VIDEO }
    // JOURNAL / SPACE_POST refer to the legacy journal_entry / space_post
    // tables (still backing the V1 paths). DOCUMENT covers everything in the
    // unified Document model — both JOURNAL-type docs in a user's personal
    // space and NOTE-type docs in a team space.
    public enum SourceType { JOURNAL, SPACE_POST, DOCUMENT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Type type;

    @Column(nullable = false, length = 500)
    private String url;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 16)
    private SourceType sourceType;

    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    @Column(name = "source_date", nullable = false)
    private LocalDate sourceDate;

    // Ordering of this media within its source's CSV (0-based).
    // Lets the lightbox preserve upload order when paging within a single entry.
    @Column(nullable = false)
    private Integer position;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }

    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public SourceType getSourceType() { return sourceType; }
    public void setSourceType(SourceType sourceType) { this.sourceType = sourceType; }

    public Long getSourceId() { return sourceId; }
    public void setSourceId(Long sourceId) { this.sourceId = sourceId; }

    public LocalDate getSourceDate() { return sourceDate; }
    public void setSourceDate(LocalDate sourceDate) { this.sourceDate = sourceDate; }

    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
