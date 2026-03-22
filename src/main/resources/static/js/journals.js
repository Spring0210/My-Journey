const imageBaseUrl = "";

const username = localStorage.getItem('username');
const userId   = localStorage.getItem('userId');

let currentPage = 0;
const PAGE_SIZE = 9;
let isSearchMode = false;

// Load paginated entries
function loadAllEntries(page = 0) {
    isSearchMode = false;
    apiRequest(`/api/entries/${userId}?page=${page}&size=${PAGE_SIZE}`)
        .then(res => {
            if (!res || !res.ok) throw new Error('Failed to load entries');
            return res.json();
        })
        .then(data => {
            renderEntryList(data.content);
            renderPagination(data.currentPage, data.totalPages);
        })
        .catch(() => {
            // Don't corrupt currentPage — just show an error without changing state
            document.getElementById('journalList').innerHTML =
                '<p style="color:var(--muted);padding:24px 0">Failed to load entries. Please try again.</p>';
        });
}

// Render entries in journalList div
function renderEntryList(entries) {
    const list = document.getElementById('journalList');
    list.innerHTML = '';

    if (!entries || entries.length === 0) {
        list.innerHTML = '<p style="color:var(--muted);padding:24px 0">No entries yet.</p>';
        return;
    }

    entries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'card card-entry';

        let imagesHtml = '';
        if (entry.imagePaths) {
            const paths = entry.imagePaths.split(',').filter(p => p.trim());
            if (paths.length > 0) {
                imagesHtml = '<div class="entry-images">';
                paths.slice(0, 2).forEach(path => {
                    const src = path.trim().startsWith('http') ? path.trim() : path.trim();
                    imagesHtml += `<img src="${src}" alt="Entry image">`;
                });
                if (paths.length > 2) {
                    imagesHtml += `<div class="more-images-count">+${paths.length - 2}</div>`;
                }
                imagesHtml += '</div>';
            }
        }

        div.innerHTML = `
            <h3>${entry.title}</h3>
            <p>${entry.content}</p>
            <small>${entry.entryDate}</small>
            ${imagesHtml}
        `;

        addImageClickEvents(div);

        div.addEventListener('click', (e) => {
            if (e.target.tagName !== 'IMG') {
                window.location.href = `detail.html?id=${entry.id}`;
            }
        });

        list.appendChild(div);
    });
}

function renderPagination(page, totalPages) {
    const pagination = document.getElementById('pagination');
    const prevBtn    = document.getElementById('prevBtn');
    const nextBtn    = document.getElementById('nextBtn');
    const pageInfo   = document.getElementById('pageInfo');

    // Always update currentPage so Prev/Next handlers have the correct state
    currentPage = page;

    if (totalPages <= 1) {
        pagination.hidden = true;
        return;
    }

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

// Search
document.getElementById('searchBtn').addEventListener('click', () => {
    isSearchMode = true;
    document.getElementById('pagination').hidden = true;

    const keyword = document.getElementById('searchKeyword').value;
    const date    = document.getElementById('searchDate').value;

    const params = new URLSearchParams();
    params.append("userId", userId);
    if (keyword) params.append("keyword", keyword);
    if (date)    params.append("date", date);

    apiRequest(`/api/entries/search?${params.toString()}`)
        .then(res => res.json())
        .then(entries => renderEntryList(entries));
});

// Clear search
document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchDate').value    = '';
    loadAllEntries(0);
});

document.addEventListener('DOMContentLoaded', () => loadAllEntries(0));
