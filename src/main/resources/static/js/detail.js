const API_BASE  = "";
const IMAGE_BASE = "";

function getEntryId() {
    return new URL(window.location.href).searchParams.get("id");
}

function updateDateDisplay(dateString) {
    if (!dateString) return;
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    const el = document.getElementById('entryDateDisplay');
    if (el) el.textContent = date.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function renderCurrentImages(entry) {
    const box = document.getElementById("imageBox");
    box.innerHTML = "";
    createImageManagement(entry, box);
    updateImageCount(entry);
}

function updateImageCount(entry) {
    const el = document.getElementById('imageCount');
    if (!el) return;
    const count = entry.imagePaths
        ? entry.imagePaths.split(',').filter(p => p.trim()).length
        : 0;
    el.textContent = `${count} photo${count !== 1 ? 's' : ''}`;
}

function attachImagePreview() {
    const input   = document.getElementById("imageInput");
    const preview = document.getElementById("previewBox");
    input.addEventListener("change", () => {
        preview.innerHTML = "";
        Array.from(input.files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const img = document.createElement("img");
            img.src = URL.createObjectURL(file);
            Object.assign(img.style, {
                width: '100px', height: '100px', objectFit: 'cover',
                borderRadius: '8px', margin: '4px'
            });
            preview.appendChild(img);
        });
    });
}

async function loadEntry(entryId) {
    const res = await apiRequest(`${API_BASE}/api/entries/entry/${entryId}`);
    if (!res.ok) throw new Error("Failed to load entry");
    const entry = await res.json();
    document.getElementById("title").value     = entry.title    || "";
    document.getElementById("content").value   = entry.content  || "";
    document.getElementById("entryDate").value = entry.entryDate || "";
    updateDateDisplay(entry.entryDate);
    renderCurrentImages(entry);
    return entry;
}

async function saveEntry(entryId) {
    const fd = new FormData();
    fd.append("title",     document.getElementById("title").value);
    fd.append("content",   document.getElementById("content").value);
    fd.append("entryDate", document.getElementById("entryDate").value);
    Array.from(document.getElementById("imageInput").files)
        .forEach(f => fd.append("images", f));
    const res = await apiRequestWithFile(`${API_BASE}/api/entries/edit/${entryId}`, fd);
    if (!res.ok) throw new Error("Failed to save entry");
    return await res.json();
}

async function createEntry(userId) {
    const fd = new FormData();
    fd.append("title",     document.getElementById("title").value);
    fd.append("content",   document.getElementById("content").value);
    fd.append("entryDate", document.getElementById("entryDate").value);
    Array.from(document.getElementById("imageInput").files)
        .forEach(f => fd.append("images", f));
    const res = await apiRequestWithFile(`${API_BASE}/api/entries/${userId}`, fd);
    if (!res.ok) throw new Error("Failed to create entry");
    return await res.json();
}

async function deleteEntry(entryId) {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    const res = await apiRequest(`${API_BASE}/api/entries/${entryId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete entry");
    window.location.href = "journals.html";
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    const userId  = localStorage.getItem('userId');
    const entryId = getEntryId();

    attachImagePreview();
    document.getElementById("entryDate").addEventListener("change", function () {
        updateDateDisplay(this.value);
    });
    document.getElementById("backBtn").addEventListener("click", () => {
        if (document.referrer) history.back();
        else window.location.href = "journals.html";
    });

    // ── CREATE MODE ──────────────────────────────────────────────
    if (!entryId) {
        document.getElementById("pageTitle").textContent = "New Entry";
        document.getElementById("saveBtn").textContent   = "Create Entry";
        document.getElementById("deleteBtn").style.display = "none";

        // Hide current-images section (nothing to show yet)
        document.querySelector(".current-images").style.display = "none";

        // Rename subsection and hide "Add Selected Images" button
        document.querySelector(".add-images .subsection-title").textContent = "Images (optional)";
        document.getElementById("addImagesBtn").style.display = "none";

        // Default to today's date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById("entryDate").value = today;
        updateDateDisplay(today);

        document.getElementById("saveBtn").addEventListener("click", async () => {
            const title     = document.getElementById("title").value.trim();
            const entryDate = document.getElementById("entryDate").value;
            if (!title || !entryDate) {
                alert("Title and date are required.");
                return;
            }
            const btn = document.getElementById("saveBtn");
            btn.disabled     = true;
            btn.textContent  = "Creating...";
            try {
                const newEntry = await createEntry(userId);
                window.location.href = `detail.html?id=${newEntry.id}`;
            } catch (e) {
                console.error(e);
                alert("Failed to create entry.");
                btn.disabled    = false;
                btn.textContent = "Create Entry";
            }
        });

        return; // stop here — edit-mode init below is not needed
    }

    // ── EDIT MODE ────────────────────────────────────────────────
    document.getElementById("pageTitle").textContent = "Edit Entry";

    try {
        await loadEntry(entryId);
    } catch (e) {
        console.error(e);
        alert("Failed to load entry.");
        return;
    }

    document.getElementById("saveBtn").addEventListener("click", async () => {
        const btn = document.getElementById("saveBtn");
        btn.disabled    = true;
        btn.textContent = "Saving...";
        try {
            await saveEntry(entryId);
            await loadEntry(entryId);
            document.getElementById("imageInput").value  = "";
            document.getElementById("previewBox").innerHTML = "";
        } catch (e) {
            console.error(e);
            alert("Save failed.");
        } finally {
            btn.disabled    = false;
            btn.textContent = "Save Changes";
        }
    });

    document.getElementById("deleteBtn").addEventListener("click", async () => {
        try { await deleteEntry(entryId); }
        catch (e) { console.error(e); alert("Delete failed."); }
    });

    document.getElementById("addImagesBtn").addEventListener("click", async () => {
        const files = document.getElementById("imageInput").files;
        if (files.length === 0) { alert("Please select images to add."); return; }
        await addImagesToEntry(entryId, files);
        await loadEntry(entryId);
        document.getElementById("imageInput").value  = "";
        document.getElementById("previewBox").innerHTML = "";
    });
});
