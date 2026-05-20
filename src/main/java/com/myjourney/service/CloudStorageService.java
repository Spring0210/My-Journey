package com.myjourney.service;

import org.springframework.web.multipart.MultipartFile;
import java.util.List;

/**
 * Cloud Storage Service Interface
 * Provides unified management for file uploads and deletions.
 */
public interface CloudStorageService {
    
    /**
     * Upload a single file to the cloud storage.
     * @param file   The file to be uploaded.
     * @param folder The folder path in the cloud storage (e.g. "journals/images").
     * @return The public URL of the uploaded file.
     */
    String uploadFile(MultipartFile file, String folder);
    
    /**
     * Upload multiple files to the cloud storage.
     * @param files  The array of files to be uploaded.
     * @param folder The folder path in the cloud storage.
     * @return A list of public URLs for the uploaded files.
     */
    List<String> uploadFiles(MultipartFile[] files, String folder);
    
    /**
     * Delete a file from the cloud storage.
     * @param fileUrl The public URL of the file to be deleted.
     * @return true if the file was deleted successfully, false otherwise.
     */
    boolean deleteFile(String fileUrl);
    
    /**
     * Delete multiple files from the cloud storage.
     * @param fileUrls A list of public URLs for the files to be deleted.
     * @return The number of files successfully deleted.
     */
    int deleteFiles(List<String> fileUrls);
    
    /**
     * Upload a single video file to the cloud storage.
     * @param file   The video file to be uploaded.
     * @param folder The folder path in the cloud storage.
     * @return The public URL of the uploaded video.
     */
    String uploadVideo(MultipartFile file, String folder);

    /**
     * Upload multiple video files to the cloud storage.
     * @param files  The array of video files to be uploaded.
     * @param folder The folder path in the cloud storage.
     * @return A list of public URLs for the uploaded videos.
     */
    List<String> uploadVideos(MultipartFile[] files, String folder);

    /**
     * Upload any file (image / video / PDF / arbitrary binary) with auto-detection.
     * Unlike {@link #uploadFile} this does NOT force JPG conversion, so PDFs and
     * non-image content survive intact. Used by document attachments.
     * @param file   The file to be uploaded.
     * @param folder The folder path in the cloud storage.
     * @return The public URL of the uploaded asset.
     */
    String uploadRaw(MultipartFile file, String folder);

    /**
     * Check whether the cloud storage service is available.
     * @return true if the service is available, false otherwise.
     */
    boolean isAvailable();
}
