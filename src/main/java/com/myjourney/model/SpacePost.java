package com.myjourney.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "space_post")
public class SpacePost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "space_id", nullable = false)
    private Space space;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User author;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_paths", columnDefinition = "TEXT")
    private String imagePaths;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public List<String> getImagePathList() {
        if (imagePaths == null || imagePaths.isEmpty()) return new ArrayList<>();
        List<String> paths = new ArrayList<>();
        for (String path : imagePaths.split(",")) {
            if (!path.trim().isEmpty()) paths.add(path.trim());
        }
        return paths;
    }

    public void setImagePathList(List<String> list) {
        if (list == null || list.isEmpty()) {
            this.imagePaths = null;
        } else {
            this.imagePaths = String.join(",", list);
        }
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Space getSpace() { return space; }
    public void setSpace(Space space) { this.space = space; }

    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getImagePaths() { return imagePaths; }
    public void setImagePaths(String imagePaths) { this.imagePaths = imagePaths; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
