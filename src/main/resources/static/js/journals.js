const imageBaseUrl = "";

const username = localStorage.getItem('username');
const userId   = localStorage.getItem('userId');

let currentPage = 0;
let totalPages = 0;
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

function renderPagination(page, total) {
    const pagination = document.getElementById('pagination');
    const prevBtn    = document.getElementById('prevBtn');
    const nextBtn    = document.getElementById('nextBtn');
    const pageInfo   = document.getElementById('pageInfo');

    // Always update state so Prev/Next handlers have the correct values
    currentPage = page;
    totalPages = total;

    if (total <= 1) {
        pagination.hidden = true;
        return;
    }

    pagination.hidden = false;
    pageInfo.textContent = `Page ${page + 1} of ${total}`;
    prevBtn.disabled = page === 0;
    nextBtn.disabled = page >= total - 1;
}

document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentPage > 0) loadAllEntries(currentPage - 1);
});

document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentPage < totalPages - 1) loadAllEntries(currentPage + 1);
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

document.addEventListener('DOMContentLoaded', () => {
    loadAllEntries(0);

    // Populate year selector with current year and 4 years back
    const yearSelect = document.getElementById('recapYear');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 4; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }
    // Default month selector to current month
    document.getElementById('recapMonth').value = new Date().getMonth() + 1;
});

// ── Monthly Recap ───────────────────────────────────────────────
document.getElementById('monthlyRecapBtn').addEventListener('click', () => {
    // Reset result text when opening the modal
    document.getElementById('recapText').hidden = true;
    document.getElementById('recapModal').hidden = false;
});

document.getElementById('generateRecapBtn').addEventListener('click', async () => {
    const year = parseInt(document.getElementById('recapYear').value);
    const month = parseInt(document.getElementById('recapMonth').value);
    const textEl = document.getElementById('recapText');
    const btn = document.getElementById('generateRecapBtn');

    textEl.textContent = 'Generating...';
    textEl.hidden = false;
    btn.disabled = true;

    try {
        const res = await apiRequest('/api/entries/ai-recap', {
            method: 'POST',
            body: JSON.stringify({ year, month })
        });
        const data = await res.json();
        textEl.textContent = data.recap || data.error || 'Failed to generate.';
    } catch (e) {
        textEl.textContent = 'Failed to generate recap. Please try again.';
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('closeRecapModal').addEventListener('click', () => {
    document.getElementById('recapModal').hidden = true;
});
document.getElementById('closeRecapBtn').addEventListener('click', () => {
    document.getElementById('recapModal').hidden = true;
});
document.getElementById('recapModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('recapModal'))
        document.getElementById('recapModal').hidden = true;
});
