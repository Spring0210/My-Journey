package com.myjourney.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "space_post_reaction",
       uniqueConstraints = @UniqueConstraint(columnNames = {"post_id", "user_id"})) // one reaction per user per post
public class SpacePostReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "post_id", nullable = false)
    private SpacePost post;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String emoji;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public SpacePost getPost() { return post; }
    public void setPost(SpacePost post) { this.post = post; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
