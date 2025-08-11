// Base URL for backend resources (update if you deploy)
const API_BASE = "http://localhost:8080";
const IMAGE_BASE = "http://localhost:8080"; // used to prefix relative imagePath

// Parse query string to get entryId
function getEntryId() {
    // Extract id from URL: detail.html?id=123
    const url = new URL(window.location.href);
    return url.searchParams.get("id");
}

// Render current image if any
function renderCurrentImage(imagePath) {
    // Display an existing image or a placeholder message
    const box = document.getElementById("imageBox");
    box.innerHTML = "";
    if (imagePath) {
        const img = document.createElement("img");
        img.src = imagePath.startsWith("http")
            ? imagePath
            : `${IMAGE_BASE}${imagePath}`;
        img.alt = "Current image";
        box.appendChild(img);
    } else {
        const p = document.createElement("p");
        p.textContent = "No image uploaded.";
        box.appendChild(p);
    }
}

// Render preview when a new file is selected
function attachImagePreview() {
    const input = document.getElementById("imageInput");
    const preview = document.getElementById("previewBox");

    // Show a client-side preview for selected image file
    input.addEventListener("change", () => {
        preview.innerHTML = "";
        const file = input.files && input.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Preview";
        preview.appendChild(img);
    });
}

// Load entry details by id
async function loadEntry(entryId) {
    // Fetch single entry using the non-conflicting endpoint
    const res = await fetch(`${API_BASE}/api/entries/entry/${entryId}`);
    if (!res.ok) throw new Error("Failed to load entry");
    const entry = await res.json();

    // Fill form fields with entry data
    document.getElementById("title").value = entry.title || "";
    document.getElementById("content").value = entry.content || "";
    document.getElementById("entryDate").value = entry.entryDate || "";

    // Render current image
    renderCurrentImage(entry.imagePath);
}

// Save changes (text/date + optional new image)
async function saveEntry(entryId) {
    // Build a FormData payload because image upload is multipart
    const fd = new FormData();
    fd.append("title", document.getElementById("title").value);
    fd.append("content", document.getElementById("content").value);
    fd.append("entryDate", document.getElementById("entryDate").value);

    // Append file if user selected a new image
    const file = document.getElementById("imageInput").files[0];
    if (file) fd.append("image", file);

    // Use your existing edit endpoint (multipart POST)
    const res = await fetch(`${API_BASE}/api/entries/edit/${entryId}`, {
        method: "POST",
        body: fd
    });
    if (!res.ok) throw new Error("Failed to save entry");
    return await res.json();
}

// Delete entry
async function deleteEntry(entryId) {
    const ok = confirm("Are you sure you want to delete this entry?");
    if (!ok) return;

    const res = await fetch(`${API_BASE}/api/entries/${entryId}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete entry");
    alert("Entry deleted.");
    // After deletion, navigate back to journals list
    window.location.href = "journals.html";
}

// Wire up buttons and init page
document.addEventListener("DOMContentLoaded", async () => {
    // Handle back navigation (go back or fallback to list)
    document.getElementById("backBtn").addEventListener("click", () => {
        if (document.referrer) history.back();
        else window.location.href = "journals.html";
    });

    // Prepare preview handler
    attachImagePreview();

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
