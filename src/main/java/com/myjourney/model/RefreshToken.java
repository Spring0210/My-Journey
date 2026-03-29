package com.myjourney.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "refresh_token")
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // UUID token string stored in the client
    @Column(nullable = false, unique = true)
    private String token;

    // Owner of this token
    @Column(nullable = false)
    private Integer userId;

    @Column(nullable = false)
    private LocalDateTime expiredAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }

    public LocalDateTime getExpiredAt() { return expiredAt; }
    public void setExpiredAt(LocalDateTime expiredAt) { this.expiredAt = expiredAt; }
}
