package com.myjourney.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// One turn within an agent_conversation. Stored as polymorphic JSON because:
//   - USER turn  → { "text": "..." }
//   - ASSISTANT  → { "text": "..." } OR { "tool_use": {...} } blocks
//   - TOOL       → { "tool_use_id": "...", "result": {...} }
// JsonNode keeps the schema flexible while still typed via Hibernate's
// SqlTypes.JSON mapping.
@Entity
@Table(name = "agent_message")
public class AgentMessage {

    public enum Role { USER, ASSISTANT, TOOL }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private AgentConversation conversation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "JSON")
    private JsonNode content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public AgentConversation getConversation() { return conversation; }
    public void setConversation(AgentConversation conversation) { this.conversation = conversation; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public JsonNode getContent() { return content; }
    public void setContent(JsonNode content) { this.content = content; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
