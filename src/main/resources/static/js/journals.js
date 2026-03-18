const imageBaseUrl = "";

const username = localStorage.getItem('username');
const userId = localStorage.getItem('userId');

let currentPage = 0;
const PAGE_SIZE = 9;
let isSearchMode = false;

// Load paginated entries
function loadAllEntries(page = 0) {
    isSearchMode = false;
    apiRequest(`/api/entries/${userId}?page=${page}&size=${PAGE_SIZE}`)
        .then(res => res.json())
        .then(data => {
            renderEntryList(data.content);
            renderPagination(data.currentPage, data.totalPages);
        });
}

// Render entries in journalList div
function renderEntryList(entries) {
    const list = document.getElementById('journalList');
    list.innerHTML = '';

    entries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'card card-entry';

        let imagesHtml = '';
        if (entry.imagePaths) {
            const imagePaths = entry.imagePaths.split(',').filter(path => path.trim());
            if (imagePaths.length > 0) {
                imagesHtml = '<div class="entry-images">';
                const displayImages = imagePaths.slice(0, 2);
                displayImages.forEach(path => {
                    const trimmedPath = path.trim();
                    const imageSrc = trimmedPath.startsWith('http') ? trimmedPath : `${trimmedPath}`;
                    imagesHtml += `<img src="${imageSrc}" alt="Entry image">`;
                });
                if (imagePaths.length > 2) {
                    imagesHtml += `<div class="more-images-count">+${imagePaths.length - 2}</div>`;
                }
                imagesHtml += '</div>';
            }
        }

        div.innerHTML = `
      <h3>${entry.title}</h3>
      <p>${entry.content}</p>
      <small>${entry.entryDate}</small>
      ${imagesHtml}
      <hr/>
    `;

        addImageClickEvents(div);

        div.addEventListener('click', (e) => {
            if (!e.target.closest('button') && e.target.tagName !== 'IMG') {
                window.location.href = `detail.html?id=${entry.id}`;
            }
        });
        list.appendChild(div);
    });
}

function renderPagination(page, totalPages) {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');

    if (totalPages <= 1) {
        pagination.hidden = true;
        return;
    }

    currentPage = page;
    pagination.hidden = false;
    pageInfo.textContent = `Page ${page + 1} of ${totalPages}`;
    prevBtn.disabled = page === 0;
    nextBtn.disabled = page >= totalPages - 1;
}

document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentPage > 0) loadAllEntries(currentPage - 1);
});

document.getElementById('nextBtn').addEventListener('click', () => {
    loadAllEntries(currentPage + 1);
});

// Toggle the visibility of the entry form
document.getElementById('toggleFormBtn').addEventListener('click', () => {
    const form = document.getElementById('entryForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
});

// Image preview functionality
document.getElementById('images').addEventListener('change', function(e) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';

    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.margin = '5px';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    }
});

// Submit new journal entry
document.getElementById('submitEntry').addEventListener('click', () => {
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const entryDate = document.getElementById('entryDate').value;
    const images = document.getElementById('images').files;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    formData.append("entryDate", entryDate);

    for (let i = 0; i < images.length; i++) {
        formData.append("images", images[i]);
    }

    const url = editingEntryId
        ? `/api/entries/edit/${editingEntryId}`
        : `/api/entries/${userId}`;

    apiRequestWithFile(url, formData)
        .then(res => res.json())
        .then(() => {
            alert(editingEntryId ? "Entry updated." : "Entry created.");

            editingEntryId = null;
            document.getElementById('title').value = '';
            document.getElementById('content').value = '';
            document.getElementById('entryDate').value = '';
            document.getElementById('images').value = '';
            document.getElementById('imagePreview').innerHTML = '';

            loadAllEntries(0);
            document.getElementById('entryForm').style.display = 'none';
        })
        .catch(err => {
            alert("Upload failed.");
            console.error(err);
        });
});

let editingEntryId = null;

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('edit-btn')) {
        editingEntryId = e.target.getAttribute('data-id');
        document.getElementById('title').value = e.target.getAttribute('data-title');
        document.getElementById('content').value = e.target.getAttribute('data-content');
        document.getElementById('entryDate').value = e.target.getAttribute('data-date');

        document.getElementById('entryForm').style.display = 'block';
        document.getElementById('submitEntry').textContent = 'Save';
    }
});

document.addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-btn')) {
        const entryId = e.target.getAttribute('data-id');

        const confirmDelete = confirm("Are you sure you want to delete this journal entry?");
        if (!confirmDelete) return;

        apiRequest(`/api/entries/${entryId}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    alert("Entry deleted.");
                    loadAllEntries(currentPage);
                } else {
                    alert("Failed to delete entry.");
                }
            })
            .catch(err => {
                alert("Error deleting entry.");
                console.error(err);
            });
    }
});

// Search (no pagination)
document.getElementById('searchBtn').addEventListener('click', () => {
    isSearchMode = true;
    document.getElementById('pagination').hidden = true;

    const keyword = document.getElementById('searchKeyword').value;
    const date = document.getElementById('searchDate').value;

    const params = new URLSearchParams();
    params.append("userId", userId);
    if (keyword) params.append("keyword", keyword);
    if (date) params.append("date", date);

    apiRequest(`/api/entries/search?${params.toString()}`)
        .then(res => res.json())
        .then(entries => {
            renderEntryList(entries);
        });
});

// Clear search → restore pagination
document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchDate').value = '';
    loadAllEntries(0);
});

document.addEventListener('DOMContentLoaded', () => loadAllEntries(0));
