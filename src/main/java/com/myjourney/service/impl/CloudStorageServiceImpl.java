package com.myjourney.service.impl;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.myjourney.service.CloudStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@Service
public class CloudStorageServiceImpl implements CloudStorageService {

    private final Cloudinary cloudinary;

    @Autowired
    public CloudStorageServiceImpl(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    @Override
    public String uploadFile(MultipartFile file, String folder) {
        try {
            System.out.println("Starting upload to Cloudinary - File: " + file.getOriginalFilename() + ", Folder: " + folder);

            // Configure upload options
            Map<String, Object> uploadOptions = new HashMap<>();
            uploadOptions.put("folder", folder != null ? folder : "my-journey");
            uploadOptions.put("resource_type", "auto"); // Auto-detect image/video
            uploadOptions.put("quality", "auto"); // Auto-optimize quality
            uploadOptions.put("fetch_format", "auto"); // Auto-optimize format

            // Upload file to Cloudinary
            Map<String, Object> result = cloudinary.uploader().upload(
                file.getBytes(),
                uploadOptions
            );

            String url = (String) result.get("secure_url");
            System.out.println("Successfully uploaded to Cloudinary: " + url);

            // Return the secure URL
            return url;

        } catch (IOException e) {
            System.err.println("Failed to upload file to Cloudinary: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to upload file to Cloudinary", e);
        }
    }

    @Override
    public List<String> uploadFiles(MultipartFile[] files, String folder) {
        List<String> urls = new ArrayList<>();

        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                String url = uploadFile(file, folder);
                urls.add(url);
            }
        }

        return urls;
    }

    @Override
    public boolean deleteFile(String fileUrl) {
        try {
            // Extract public ID from Cloudinary URL
            String publicId = extractPublicIdFromUrl(fileUrl);

            if (publicId == null) {
                return false;
            }

            // Delete file from Cloudinary
            Map<String, Object> result = cloudinary.uploader().destroy(
                publicId,
                ObjectUtils.emptyMap()
            );

            return "ok".equals(result.get("result"));

        } catch (Exception e) {
            System.err.println("Failed to delete file from Cloudinary: " + e.getMessage());
            return false;
        }
    }

    @Override
    public int deleteFiles(List<String> fileUrls) {
        int deletedCount = 0;

        for (String url : fileUrls) {
            if (deleteFile(url)) {
                deletedCount++;
            }
        }

        return deletedCount;
    }

    @Override
    public boolean isAvailable() {
        try {
            return cloudinary != null && cloudinary.config.cloudName != null &&
                   !cloudinary.config.cloudName.isEmpty();

        } catch (Exception e) {
            return false;
        }
    }

    private String extractPublicIdFromUrl(String url) {
        try {
            String[] parts = url.split("/upload/");
            if (parts.length < 2) {
                return null;
            }

            String afterUpload = parts[1];
            if (afterUpload.matches("^v\\d+/.*")) {
                afterUpload = afterUpload.substring(afterUpload.indexOf('/') + 1);
            }

            int lastDot = afterUpload.lastIndexOf('.');
            if (lastDot != -1) {
                afterUpload = afterUpload.substring(0, lastDot);
            }

            return afterUpload;

        } catch (Exception e) {
            System.err.println("Failed to extract public ID from URL: " + url);
            return null;
        }
    }
}
