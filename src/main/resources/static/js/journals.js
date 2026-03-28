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

// ── AI Search ───────────────────────────────────────────────────
document.getElementById('aiSearchBtn').addEventListener('click', runAiSearch);
document.getElementById('aiSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runAiSearch();
});

async function runAiSearch() {
    const query = document.getElementById('aiSearchInput').value.trim();
    if (!query) return;

    const btn    = document.getElementById('aiSearchBtn');
    const metaEl = document.getElementById('aiSearchMeta');
    const list   = document.getElementById('journalList');

    isSearchMode = true;
    document.getElementById('pagination').hidden = true;
    btn.disabled = true;
    btn.textContent = 'Searching...';
    metaEl.hidden = true;
    list.innerHTML = '';

    try {
        const res = await apiRequest('/api/entries/ai-search', {
            method: 'POST',
            body: JSON.stringify({ query })
        });
        const data = await res.json();

        // Show which keywords were matched
        if (data.keywords && data.keywords.length > 0) {
            metaEl.textContent = `Matched keywords: ${data.keywords.join(', ')}`;
            metaEl.hidden = false;
        }

        renderEntryList(data.entries || []);
    } catch (e) {
        list.innerHTML = '<p style="color:var(--muted);padding:24px 0">AI search failed. Please try again.</p>';
    } finally {
        btn.disabled = false;
        btn.textContent = 'AI Search';
    }
}

// Clear also resets AI search state
const _originalClearHandler = document.getElementById('clearBtn').onclick;
document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('aiSearchInput').value = '';
    document.getElementById('aiSearchMeta').hidden = true;
});

// ── Writing Prompts ─────────────────────────────────────────────
function openWritingPrompts() {
    document.getElementById('promptsModal').hidden = false;
    fetchWritingPrompts();
}
function openMonthlyRecap() {
    document.getElementById('recapText').hidden = true;
    document.getElementById('recapModal').hidden = false;
}

document.getElementById('writingPromptsBtn').addEventListener('click', openWritingPrompts);
document.getElementById('writingPromptsBtnMobile').addEventListener('click', openWritingPrompts);
document.getElementById('monthlyRecapBtnMobile').addEventListener('click', openMonthlyRecap);

async function fetchWritingPrompts() {
    const listEl   = document.getElementById('promptsList');
    const introEl  = document.getElementById('promptsIntro');
    const refreshBtn = document.getElementById('refreshPromptsBtn');

    listEl.innerHTML = '<p class="prompts-loading">Generating prompts...</p>';
    introEl.hidden = true;
    refreshBtn.disabled = true;

    try {
        const res = await apiRequest('/api/entries/ai-prompts', { method: 'POST' });
        const data = await res.json();

        if (data.error) {
            listEl.innerHTML = `<p class="prompts-empty">${data.error}</p>`;
            return;
        }

        introEl.hidden = false;
        listEl.innerHTML = '';
        (data.prompts || []).forEach(prompt => {
            const card = document.createElement('div');
            card.className = 'prompt-card';

            const text = document.createElement('p');
            text.className = 'prompt-card__text';
            text.textContent = prompt;

            const btn = document.createElement('button');
            btn.className = 'btn btn--primary btn--sm prompt-card__use';
            btn.textContent = 'Use This';
            btn.addEventListener('click', () => {
                // Navigate to new entry with prompt pre-filled as content
                window.location.href = `detail.html?prompt=${encodeURIComponent(prompt)}`;
            });

            card.appendChild(text);
            card.appendChild(btn);
            listEl.appendChild(card);
        });
    } catch (e) {
        listEl.innerHTML = '<p class="prompts-empty">Failed to generate prompts. Please try again.</p>';
    } finally {
        refreshBtn.disabled = false;
    }
}

document.getElementById('refreshPromptsBtn').addEventListener('click', fetchWritingPrompts);

document.getElementById('closePromptsModal').addEventListener('click', () => {
    document.getElementById('promptsModal').hidden = true;
});
document.getElementById('closePromptsBtn').addEventListener('click', () => {
    document.getElementById('promptsModal').hidden = true;
});
document.getElementById('promptsModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('promptsModal'))
        document.getElementById('promptsModal').hidden = true;
});

// ── Monthly Recap ───────────────────────────────────────────────
document.getElementById('monthlyRecapBtn').addEventListener('click', openMonthlyRecap);

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
