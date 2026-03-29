// Image viewing and management utility functions

// Check if the URL is a Cloudinary URL
function isCloudinaryUrl(url) {
    return url && (url.startsWith('http://') || url.startsWith('https://')) && url.includes('cloudinary.com');
}

// Create image modal for viewing large images
function createImageModal() {
    if (document.getElementById('imageModal')) {
        return; // Already exists
    }
    
    const modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.className = 'image-modal';
    modal.innerHTML = `
        <span class="image-modal-close">&times;</span>
        <img class="image-modal-content" id="modalImage">
    `;
    
    document.body.appendChild(modal);
    
    // Click to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('image-modal-close')) {
            modal.style.display = 'none';
        }
    });
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

// Show large image in modal
function showImageModal(imageSrc) {
    createImageModal();
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    modalImg.src = imageSrc;
    modal.style.display = 'block';
}

// Add click events to images
function addImageClickEvents(container) {
    const images = container.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            showImageModal(img.src);
        });
    });
}

// Create image management interface
function createImageManagement(entry, container) {
    const imagePaths = entry.imagePaths ? entry.imagePaths.split(',').filter(path => path.trim()) : [];
    
    if (imagePaths.length === 0) {
        container.innerHTML = '<p>No images uploaded.</p>';
        return;
    }
    
    container.innerHTML = '<div class="image-management"></div>';
    const managementDiv = container.querySelector('.image-management');
    
    imagePaths.forEach((path, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.innerHTML = `
            <img src="${isCloudinaryUrl(path.trim()) ? path.trim() : '' + path.trim()}" alt="Entry image">
            <button class="delete-btn" data-index="${index}" data-path="${path.trim()}">&times;</button>
        `;
        
        // Add click event to view large image
        const img = imageItem.querySelector('img');
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            showImageModal(img.src);
        });
        
        // Add delete button event
        const deleteBtn = imageItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteImage(entry.id, path.trim(), imageItem);
        });
        
        managementDiv.appendChild(imageItem);
    });
}

// Delete single image
async function deleteImage(entryId, imagePath, imageElement) {
    if (!confirm('Are you sure you want to delete this image?')) {
        return;
    }
    
    try {
        const response = await apiRequest(`/api/entries/delete-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                entryId: entryId,
                imagePath: imagePath
            })
        });
        
        if (response.ok) {
            imageElement.remove();
            // Check if there are any remaining images
            const remainingImages = document.querySelectorAll('.image-item');
            if (remainingImages.length === 0) {
                document.querySelector('.image-management').innerHTML = '<p>No images uploaded.</p>';
            }
            
            // Update image count
            const imageCount = document.getElementById('imageCount');
            if (imageCount) {
                imageCount.textContent = `${remainingImages.length} photo${remainingImages.length !== 1 ? 's' : ''}`;
            }
        } else {
            showToast('Failed to delete image');
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        showToast('Error deleting image');
    }
}

// Add new images to existing entry
async function addImagesToEntry(entryId, files) {
    if (files.length === 0) return;
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    
    try {
        const response = await apiRequestWithFile(`/api/entries/add-images/${entryId}`, formData);
        
        if (response.ok) {
            const updatedEntry = await response.json();
            // Reload image management interface
            const container = document.querySelector('.image-management').parentElement;
            createImageManagement(updatedEntry, container);
            
            // Update image count
            const imageCount = document.getElementById('imageCount');
            if (imageCount) {
                const imagePaths = updatedEntry.imagePaths ? updatedEntry.imagePaths.split(',').filter(path => path.trim()) : [];
                imageCount.textContent = `${imagePaths.length} photo${imagePaths.length !== 1 ? 's' : ''}`;
            }
        } else {
            showToast('Failed to add images');
        }
    } catch (error) {
        console.error('Error adding images:', error);
        showToast('Error adding images');
    }
}
