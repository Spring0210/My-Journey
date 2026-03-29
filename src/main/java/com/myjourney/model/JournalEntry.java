package com.myjourney.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.LocalDate;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "journal_entry")
public class JournalEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private LocalDate entryDate;

    @Column(name = "image_paths", columnDefinition = "TEXT")
    private String imagePaths; // Store multiple image paths, separated by commas

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDate getEntryDate() {
        return entryDate;
    }

    public void setEntryDate(LocalDate entryDate) {
        this.entryDate = entryDate;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getImagePaths() {
        return imagePaths;
    }

    public void setImagePaths(String imagePaths) {
        this.imagePaths = imagePaths;
    }

    // Get image path list
    public List<String> getImagePathList() {
        if (imagePaths == null || imagePaths.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> paths = new ArrayList<>();
        for (String path : imagePaths.split(",")) {
            if (!path.trim().isEmpty()) {
                paths.add(path.trim());
            }
        }
        return paths;
    }

    // Set image path list
    public void setImagePathList(List<String> imagePathList) {
        if (imagePathList == null || imagePathList.isEmpty()) {
            this.imagePaths = null;
        } else {
            this.imagePaths = String.join(",", imagePathList);
        }
    }

    // Note: Backward compatibility methods removed as we've fully migrated to multi-image support
}
