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
     * Check whether the cloud storage service is available.
     * @return true if the service is available, false otherwise.
     */
    boolean isAvailable();
}
