package com.myjourney.service.impl;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.myjourney.service.CloudStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.Arrays;

@Service
public class CloudStorageServiceImpl implements CloudStorageService {

    private static final Logger log = LoggerFactory.getLogger(CloudStorageServiceImpl.class);

    private final Cloudinary cloudinary;

    @Autowired
    public CloudStorageServiceImpl(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    @Override
    public String uploadFile(MultipartFile file, String folder) {
        try {
            log.info("Uploading to Cloudinary - file: {}, folder: {}", file.getOriginalFilename(), folder);

            // Configure upload options
            Map<String, Object> uploadOptions = new HashMap<>();
            uploadOptions.put("folder", folder != null ? folder : "my-journey");
            uploadOptions.put("resource_type", "image");
            uploadOptions.put("quality", "auto");
            uploadOptions.put("format", "jpg");  // Convert all formats (including HEIC) to JPEG at upload time for universal browser support
            uploadOptions.put("page", 1);        // Only take the first page/frame — prevents HEIC Live Photos from producing multiple images

            // Upload file to Cloudinary
            Map<String, Object> result = cloudinary.uploader().upload(
                file.getBytes(),
                uploadOptions
            );

            String url = (String) result.get("secure_url");

            // Insert q_auto for automatic quality optimization on delivery
            url = url.replace("/upload/", "/upload/q_auto/");

            log.info("Uploaded to Cloudinary: {}", url);
            return url;

        } catch (IOException e) {
            log.error("Failed to upload file to Cloudinary: {}", e.getMessage(), e);
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
            log.error("Failed to delete file from Cloudinary: {}", e.getMessage(), e);
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

            // Skip Cloudinary transformation segments (e.g. f_auto,q_auto) — they appear
            // before the version number and contain commas or underscores with known prefixes
            // Keep skipping segments until we hit the version string (v followed by digits)
            // or a segment that looks like the start of the public ID path
            String[] segments = afterUpload.split("/");
            int startIndex = 0;
            for (int i = 0; i < segments.length; i++) {
                if (segments[i].matches("^v\\d+$")) {
                    // Skip version segment too, public ID starts after it
                    startIndex = i + 1;
                    break;
                } else if (segments[i].contains(",") || segments[i].matches("^[a-z]_.*")) {
                    // This looks like a transformation segment, skip it
                    startIndex = i + 1;
                } else {
                    // Reached the public ID portion
                    startIndex = i;
                    break;
                }
            }

            // Rejoin remaining segments as the public ID
            String publicId = String.join("/", Arrays.copyOfRange(segments, startIndex, segments.length));

            // Remove file extension
            int lastDot = publicId.lastIndexOf('.');
            if (lastDot != -1) {
                publicId = publicId.substring(0, lastDot);
            }

            return publicId;

        } catch (Exception e) {
            log.error("Failed to extract public ID from URL: {}", url);
            return null;
        }
    }
}
