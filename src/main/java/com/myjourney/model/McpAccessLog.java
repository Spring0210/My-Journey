package com.myjourney.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// Rolling audit log of MCP tool calls. Powers the "Recent activity" panel on
// Profile > MCP Access. Retention: 30 days; cleanup runs as a scheduled job
// in a later batch.
@Entity
@Table(name = "mcp_access_log")
public class McpAccessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "token_id", nullable = false)
    private McpApiToken token;

    @Column(name = "tool_name", nullable = false, length = 64)
    private String toolName;

    @Column(name = "called_at", nullable = false)
    private LocalDateTime calledAt;

    @Column(nullable = false)
    private boolean success;

    @PrePersist
    protected void onCreate() {
        if (calledAt == null) calledAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public McpApiToken getToken() { return token; }
    public void setToken(McpApiToken token) { this.token = token; }

    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }

    public LocalDateTime getCalledAt() { return calledAt; }
    public void setCalledAt(LocalDateTime calledAt) { this.calledAt = calledAt; }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
}
