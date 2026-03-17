// Base URL for backend resources (update if you deploy)
const API_BASE = "";
const IMAGE_BASE = ""; // used to prefix relative imagePath

// Parse query string to get entryId
function getEntryId() {
    // Extract id from URL: detail.html?id=123
    const url = new URL(window.location.href);
    return url.searchParams.get("id");
}

// Update date display in header
function updateDateDisplay(dateString) {
    if (!dateString) return;
    
    // Parse date string to avoid timezone issues
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const dateDisplay = document.getElementById('entryDateDisplay');
    if (dateDisplay) {
        dateDisplay.textContent = formattedDate;
    }
}

// Render current images if any
function renderCurrentImages(entry) {
    const box = document.getElementById("imageBox");
    box.innerHTML = "";
    
    // Use image management interface
    createImageManagement(entry, box);
    
    // Update image count
    updateImageCount(entry);
}

// Update image count display
function updateImageCount(entry) {
    const imageCount = document.getElementById('imageCount');
    if (!imageCount) return;
    
    let count = 0;
    if (entry.imagePaths) {
        const imagePaths = entry.imagePaths.split(',').filter(path => path.trim());
        count = imagePaths.length;
    }
    
    imageCount.textContent = `${count} photo${count !== 1 ? 's' : ''}`;
}

// Render preview when new files are selected
function attachImagePreview() {
    const input = document.getElementById("imageInput");
    const preview = document.getElementById("previewBox");

    // Show a client-side preview for selected image files
    input.addEventListener("change", () => {
        preview.innerHTML = "";
        const files = input.files;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                const img = document.createElement("img");
                img.src = url;
                img.alt = "Preview";
                img.style.margin = "5px";
                img.style.width = "100px";
                img.style.height = "100px";
                img.style.objectFit = "cover";
                img.style.borderRadius = "8px";
                img.style.border = "2px solid #e0e0e0";
                preview.appendChild(img);
            }
        }
    });
}

// Load entry details by id
async function loadEntry(entryId) {
    // Fetch single entry using the non-conflicting endpoint
    const res = await apiRequest(`${API_BASE}/api/entries/entry/${entryId}`);
    if (!res.ok) throw new Error("Failed to load entry");
    const entry = await res.json();

    // Fill form fields with entry data
    document.getElementById("title").value = entry.title || "";
    document.getElementById("content").value = entry.content || "";
    document.getElementById("entryDate").value = entry.entryDate || "";
    
    // Update date display
    updateDateDisplay(entry.entryDate);

    // Render current images
    renderCurrentImages(entry);
}

// Save changes (text/date + optional new images)
async function saveEntry(entryId) {
    // Build a FormData payload because image upload is multipart
    const fd = new FormData();
    fd.append("title", document.getElementById("title").value);
    fd.append("content", document.getElementById("content").value);
    fd.append("entryDate", document.getElementById("entryDate").value);

    // Append files if user selected new images
    const files = document.getElementById("imageInput").files;
    for (let i = 0; i < files.length; i++) {
        fd.append("images", files[i]);
    }

    // Use your existing edit endpoint (multipart POST)
    const res = await apiRequestWithFile(`${API_BASE}/api/entries/edit/${entryId}`, fd);
    if (!res.ok) throw new Error("Failed to save entry");
    return await res.json();
}

// Delete entry
async function deleteEntry(entryId) {
    const ok = confirm("Are you sure you want to delete this entry?");
    if (!ok) return;

    const res = await apiRequest(`${API_BASE}/api/entries/${entryId}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete entry");
    alert("Entry deleted.");
    // After deletion, navigate back to journals list
    window.location.href = "journals.html";
}

// Wire up buttons and init page
document.addEventListener("DOMContentLoaded", async () => {
    // Get user info from layout manager
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('userId');
    
    // Handle back navigation (go back or fallback to list)
    document.getElementById("backBtn").addEventListener("click", () => {
        if (document.referrer) history.back();
        else window.location.href = "journals.html";
    });

    // Prepare preview handler
    attachImagePreview();
    
    // Handle date input changes
    document.getElementById("entryDate").addEventListener("change", function() {
        updateDateDisplay(this.value);
    });
    
    // Handle add images button
    document.getElementById("addImagesBtn").addEventListener("click", async () => {
        const files = document.getElementById("imageInput").files;
        if (files.length === 0) {
            alert("Please select images to add");
            return;
        }
        
        const entryId = getEntryId();
        if (entryId) {
            await addImagesToEntry(entryId, files);
            // Reload entry to show new images
            await loadEntry(entryId);
            // Clear file input
            document.getElementById("imageInput").value = "";
            document.getElementById("previewBox").innerHTML = "";
        }
    });

    // Load entry
    const entryId = getEntryId();
    if (!entryId) {
        alert("Missing entry id.");
        window.location.href = "journals.html";
        return;
    }

    try {
        await loadEntry(entryId);
    } catch (e) {
        console.error(e);
        alert("Failed to load entry.");
    }

    // Save changes
    document.getElementById("saveBtn").addEventListener("click", async () => {
        try {
            await saveEntry(entryId);
            alert("Saved.");
            // Reload to reflect new image path if updated
            await loadEntry(entryId);
        } catch (e) {
            console.error(e);
            alert("Save failed.");
        }
    });

    // Delete entry
    document.getElementById("deleteBtn").addEventListener("click", async () => {
        try {
            await deleteEntry(entryId);
        } catch (e) {
            console.error(e);
            alert("Delete failed.");
        }
    });
});
