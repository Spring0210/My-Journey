const API_BASE  = "";
const IMAGE_BASE = "";

// Pending files selected but not yet saved
let pendingFiles = [];

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

function updateImageCount(count) {
    const el = document.getElementById('imageCount');
    if (!el) return;
    if (count === 0) {
        el.textContent = '';
    } else {
        el.textContent = `${count} photo${count !== 1 ? 's' : ''}`;
    }
}

function setSaveStatus(text) {
    const el = document.getElementById('saveStatus');
    if (el) el.textContent = text;
}

// ── Unified photo grid renderer ──────────────────────────────────
// existingPaths: array of URL strings (already saved)
// pending: array of File objects (selected, not yet saved)
function renderPhotoGrid(existingPaths, pending) {
    const grid = document.getElementById('photoGrid');
    grid.innerHTML = '';

    const total = existingPaths.length + pending.length;
    updateImageCount(total);

    // Existing photos
    existingPaths.forEach((path, i) => {
        const cell = document.createElement('div');
        cell.className = 'photo-cell';

        const img = document.createElement('img');
        img.src = path;
        img.alt = 'Photo';
        img.addEventListener('click', () => showImageModal(path));

        const del = document.createElement('button');
        del.className = 'photo-cell__del';
        del.textContent = '×';
        del.title = 'Delete photo';
        del.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Delete this photo?')) return;
            const entryId = getEntryId();
            try {
                const res = await apiRequest('/api/entries/delete-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entryId, imagePath: path })
                });
                if (!res.ok) throw new Error();
                existingPaths.splice(i, 1);
                renderPhotoGrid(existingPaths, pending);
            } catch {
                alert('Failed to delete photo.');
            }
        });

        cell.appendChild(img);
        cell.appendChild(del);
        grid.appendChild(cell);
    });

    // Pending previews
    pending.forEach((file, i) => {
        const cell = document.createElement('div');
        cell.className = 'photo-cell photo-cell--pending';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = 'Preview';

        const rem = document.createElement('button');
        rem.className = 'photo-cell__remove';
        rem.textContent = '×';
        rem.title = 'Remove';
        rem.addEventListener('click', (e) => {
            e.stopPropagation();
            pending.splice(i, 1);
            renderPhotoGrid(existingPaths, pending);
        });

        cell.appendChild(img);
        cell.appendChild(rem);
        grid.appendChild(cell);
    });

    // "+" add cell (always last, unless 9 total already)
    if (total < 9) {
        const addCell = document.createElement('div');
        addCell.className = 'photo-cell photo-cell--add';
        addCell.title = 'Add photos';
        addCell.innerHTML = '<span class="photo-cell__plus">+</span>';
        addCell.addEventListener('click', () => {
            document.getElementById('imageInput').click();
        });
        grid.appendChild(addCell);
    }
}

async function loadEntry(entryId) {
    const res = await apiRequest(`${API_BASE}/api/entries/entry/${entryId}`);
    if (!res.ok) throw new Error("Failed to load entry");
    const entry = await res.json();
    document.getElementById("title").value     = entry.title    || "";
    document.getElementById("content").value   = entry.content  || "";
    document.getElementById("entryDate").value = entry.entryDate || "";
    updateDateDisplay(entry.entryDate);

    const paths = entry.imagePaths
        ? entry.imagePaths.split(',').map(p => p.trim()).filter(Boolean)
        : [];
    renderPhotoGrid(paths, pendingFiles);
    return entry;
}

async function saveEntry(entryId) {
    const fd = new FormData();
    fd.append("title",     document.getElementById("title").value);
    fd.append("content",   document.getElementById("content").value);
    fd.append("entryDate", document.getElementById("entryDate").value);
    pendingFiles.forEach(f => fd.append("images", f));
    const res = await apiRequestWithFile(`${API_BASE}/api/entries/edit/${entryId}`, fd);
    if (!res.ok) throw new Error("Failed to save entry");
    return await res.json();
}

async function createEntry(userId) {
    const fd = new FormData();
    fd.append("title",     document.getElementById("title").value);
    fd.append("content",   document.getElementById("content").value);
    fd.append("entryDate", document.getElementById("entryDate").value);
    pendingFiles.forEach(f => fd.append("images", f));
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

    document.getElementById("entryDate").addEventListener("change", function () {
        updateDateDisplay(this.value);
    });

    document.getElementById("backBtn").addEventListener("click", () => {
        if (document.referrer) history.back();
        else window.location.href = "journals.html";
    });

    // File input → add to pendingFiles and re-render
    document.getElementById("imageInput").addEventListener("change", function () {
        // Deduplicate by base name (without extension) to handle iOS Live Photos,
        // which can submit both a HEIC and a paired JPEG as two separate files
        const existingNames = new Set(pendingFiles.map(f => f.name.replace(/\.[^.]+$/, '')));
        Array.from(this.files).forEach(f => {
            const baseName = f.name.replace(/\.[^.]+$/, '');
            if (f.type.startsWith('image/') && !existingNames.has(baseName)) {
                pendingFiles.push(f);
                existingNames.add(baseName);
            }
        });
        this.value = ""; // reset so same file can be re-added if removed

        const existingPaths = Array.from(
            document.querySelectorAll('#photoGrid .photo-cell:not(.photo-cell--pending):not(.photo-cell--add) img')
        ).map(img => img.src);
        renderPhotoGrid(existingPaths, pendingFiles);
    });

    // ── ⋯ Menu toggle (close on outside click) ───────────────────
    const menuTrigger  = document.getElementById("entryMenuTrigger");
    const menuDropdown = document.getElementById("entryMenuDropdown");
    if (menuTrigger) {
        menuTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            menuDropdown.hidden = !menuDropdown.hidden;
        });
        document.addEventListener("click", () => { menuDropdown.hidden = true; });
    }

    // ── CREATE MODE ──────────────────────────────────────────────
    if (!entryId) {
        document.getElementById("saveBtn").textContent      = "Create Entry";
        document.getElementById("imageCount").style.display = "none";

        const today = new Date().toISOString().split('T')[0];
        document.getElementById("entryDate").value = today;
        updateDateDisplay(today);

        // Pre-fill content if a writing prompt was passed via query param
        const promptParam = new URL(window.location.href).searchParams.get("prompt");
        if (promptParam) {
            document.getElementById("content").value = promptParam;
        }

        // Show empty grid with just the "+" cell
        renderPhotoGrid([], pendingFiles);

        document.getElementById("saveBtn").addEventListener("click", async () => {
            const title     = document.getElementById("title").value.trim();
            const entryDate = document.getElementById("entryDate").value;
            if (!title || !entryDate) {
                alert("Title and date are required.");
                return;
            }
            const btn = document.getElementById("saveBtn");
            btn.disabled    = true;
            btn.textContent = "Creating...";
            try {
                await createEntry(userId);
                window.location.href = "journals.html";
            } catch (e) {
                console.error(e);
                alert("Failed to create entry.");
                btn.disabled    = false;
                btn.textContent = "Create Entry";
            }
        });

        return;
    }

    // ── EDIT MODE ────────────────────────────────────────────────
    document.getElementById("saveBtn").textContent    = "Save Changes";
    document.getElementById("entryMenuWrap").hidden   = false;
    document.getElementById("exportBtn").addEventListener("click", () => {
        menuDropdown.hidden = true;
        window.print();
    });

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
        setSaveStatus("");
        try {
            await saveEntry(entryId);
            pendingFiles = [];
            await loadEntry(entryId);
            setSaveStatus("Saved");
            setTimeout(() => setSaveStatus(""), 2500);
        } catch (e) {
            console.error(e);
            alert("Save failed.");
        } finally {
            btn.disabled    = false;
            btn.textContent = "Save Changes";
        }
    });

    document.getElementById("deleteBtn").addEventListener("click", async () => {
        menuDropdown.hidden = true;
        try { await deleteEntry(entryId); }
        catch (e) { console.error(e); alert("Delete failed."); }
    });
});
