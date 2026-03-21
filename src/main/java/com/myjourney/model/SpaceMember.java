package com.myjourney.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(
    name = "space_member",
    uniqueConstraints = @UniqueConstraint(columnNames = {"space_id", "user_id"})
)
public class SpaceMember {

    public enum Role {
        OWNER, MEMBER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "space_id", nullable = false)
    private Space space;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.MEMBER;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Space getSpace() { return space; }
    public void setSpace(Space space) { this.space = space; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
}
