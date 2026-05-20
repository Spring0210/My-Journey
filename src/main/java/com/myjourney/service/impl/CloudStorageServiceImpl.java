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
    @SuppressWarnings("unchecked")
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
    @SuppressWarnings("unchecked")
    public String uploadVideo(MultipartFile file, String folder) {
        try {
            log.info("Uploading video to Cloudinary - file: {}, folder: {}", file.getOriginalFilename(), folder);

            Map<String, Object> uploadOptions = new HashMap<>();
            uploadOptions.put("folder", folder != null ? folder : "my-journey");
            uploadOptions.put("resource_type", "video");

            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), uploadOptions);
            String url = (String) result.get("secure_url");
            log.info("Uploaded video to Cloudinary: {}", url);
            return url;

        } catch (IOException e) {
            log.error("Failed to upload video to Cloudinary: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload video to Cloudinary", e);
        }
    }

    @Override
    public List<String> uploadVideos(MultipartFile[] files, String folder) {
        List<String> urls = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                urls.add(uploadVideo(file, folder));
            }
        }
        return urls;
    }

    // Document attachments come through this path. `resource_type=auto` lets
    // Cloudinary decide image vs video vs raw based on the actual bytes —
    // unlike `uploadFile`, which force-converts to JPG and so blows up on
    // PDFs / zips / text files.
    @Override
    @SuppressWarnings("unchecked")
    public String uploadRaw(MultipartFile file, String folder) {
        try {
            log.info("Uploading attachment to Cloudinary - file: {}, folder: {}",
                    file.getOriginalFilename(), folder);

            Map<String, Object> uploadOptions = new HashMap<>();
            uploadOptions.put("folder", folder != null ? folder : "my-journey");
            uploadOptions.put("resource_type", "auto");
            // Preserve the original filename so raw assets (PDFs, zips) keep their
            // extension for download. unique_filename appends a random suffix to
            // avoid collisions when two users upload "report.pdf" to the same folder.
            if (file.getOriginalFilename() != null) {
                uploadOptions.put("use_filename", true);
                uploadOptions.put("unique_filename", true);
            }

            Map<String, Object> result = cloudinary.uploader().upload(
                    file.getBytes(), uploadOptions);
            String url = (String) result.get("secure_url");

            // q_auto is an image/video delivery transform; raw assets reject it.
            if (url != null && url.contains("/image/upload/")) {
                url = url.replace("/upload/", "/upload/q_auto/");
            }

            log.info("Uploaded attachment to Cloudinary: {}", url);
            return url;
        } catch (IOException e) {
            log.error("Failed to upload attachment to Cloudinary: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to upload attachment to Cloudinary", e);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public boolean deleteFile(String fileUrl) {
        try {
            // Extract public ID from Cloudinary URL
            String publicId = extractPublicIdFromUrl(fileUrl);

            if (publicId == null) {
                return false;
            }

            // Detect resource type from URL path segment.
            // raw assets (PDFs/zips/...) use /raw/upload/; videos use /video/upload/; everything else is image.
            String resourceType;
            if (fileUrl.contains("/video/upload/")) {
                resourceType = "video";
            } else if (fileUrl.contains("/raw/upload/")) {
                resourceType = "raw";
            } else {
                resourceType = "image";
            }

            Map<String, Object> result = cloudinary.uploader().destroy(
                publicId,
                ObjectUtils.asMap("resource_type", resourceType)
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
