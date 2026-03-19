const userId = parseInt(localStorage.getItem('userId'));
const spaceId = new URLSearchParams(window.location.search).get('id');
let currentPage = 0;
let totalPages = 0;
let selectedImages = [];

if (!spaceId) window.location.href = 'spaces.html';

// ── Load Space Detail ──────────────────────────────────────────
async function loadSpaceDetail() {
    try {
        const res = await apiRequest(`/api/spaces/${spaceId}`);
        if (res.status === 403) { alert('Access denied.'); window.location.href = 'spaces.html'; return; }
        const space = await res.json();
        if (space.error) { alert(space.error); window.location.href = 'spaces.html'; return; }

        document.title = `${space.name} - Journey`;
        document.getElementById('spaceTitle').textContent = space.name;
        document.getElementById('spaceDescription').textContent = space.description || 'No description.';

        const isOwner = space.ownerUsername === localStorage.getItem('username');

        // Show invite code to all members
        document.getElementById('inviteCodeBox').hidden = false;
        document.getElementById('inviteCode').textContent = space.inviteCode;

        // Members list
        const membersList = document.getElementById('membersList');
        document.getElementById('memberCount').textContent = `(${space.members.length})`;
        membersList.innerHTML = space.members.map(m => `
            <div class="member-row">
                <div class="member-avatar">${m.username.charAt(0).toUpperCase()}</div>
                <div class="member-info">
                    <span class="member-name">${escapeHtml(m.username)}</span>
                    ${m.role === 'OWNER' ? '<span class="role-badge role-badge--owner">Owner</span>' : ''}
                </div>
            </div>
        `).join('');

        // Danger zone
        const dangerZone = document.getElementById('dangerZone');
        const btn = document.getElementById('leaveOrDeleteBtn');
        dangerZone.hidden = false;
        if (isOwner) {
            btn.textContent = 'Delete Space';
            btn.addEventListener('click', deleteSpace);
        } else {
            btn.textContent = 'Leave Space';
            btn.addEventListener('click', leaveSpace);
        }
    } catch (e) {
        console.error(e);
    }
}

// ── Copy Invite Code ───────────────────────────────────────────
document.getElementById('copyCodeBtn').addEventListener('click', () => {
    const code = document.getElementById('inviteCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copyCodeBtn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
});

// ── Load Posts ─────────────────────────────────────────────────
async function loadPosts(page = 0) {
    const container = document.getElementById('postsList');
    try {
        const res = await apiRequest(`/api/spaces/${spaceId}/posts?page=${page}&size=20`);
        const data = await res.json();
        if (data.error) { container.innerHTML = `<p class="muted">${data.error}</p>`; return; }

        currentPage = data.currentPage;
        totalPages = data.totalPages;
        const posts = data.content || [];

        if (posts.length === 0 && page === 0) {
            container.innerHTML = '<div class="empty-state"><p>No posts yet. Be the first to share something!</p></div>';
        } else {
            container.innerHTML = posts.map(post => renderPost(post)).join('');
            addImageClickEvents(container);
            addDeleteListeners(container);
        }

        updatePagination();
    } catch (e) {
        container.innerHTML = '<p class="muted">Failed to load posts.</p>';
    }
}

function renderPost(post) {
    const isAuthor = post.authorId === userId;
    const date = new Date(post.createdAt + 'Z').toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const imagesHtml = post.images && post.images.length > 0
        ? `<div class="post-images post-images--${Math.min(post.images.length, 3)}">${post.images.map(url =>
            `<img src="${url}" alt="post image" />`).join('')}</div>`
        : '';

    return `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="member-avatar">${post.authorUsername.charAt(0).toUpperCase()}</div>
                <div class="post-meta">
                    <span class="post-author">${escapeHtml(post.authorUsername)}</span>
                    <span class="post-date">${date}</span>
                </div>
                ${isAuthor ? `<button class="post-delete-btn" data-post-id="${post.id}" title="Delete">&times;</button>` : ''}
            </div>
            ${post.content ? `<p class="post-content">${escapeHtml(post.content)}</p>` : ''}
            ${imagesHtml}
        </div>
    `;
}

function addDeleteListeners(container) {
    container.querySelectorAll('.post-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Delete this post?')) return;
            const postId = btn.dataset.postId;
            const res = await apiRequest(`/api/spaces/${spaceId}/posts/${postId}`, { method: 'DELETE' });
            if (res.ok) loadPosts(currentPage);
            else alert('Failed to delete post.');
        });
    });
}

function updatePagination() {
    const pag = document.getElementById('postsPagination');
    if (totalPages <= 1) { pag.hidden = true; return; }
    pag.hidden = false;
    document.getElementById('postsPageInfo').textContent = `Page ${currentPage + 1} of ${totalPages}`;
    document.getElementById('prevPostsBtn').disabled = currentPage === 0;
    document.getElementById('nextPostsBtn').disabled = currentPage >= totalPages - 1;
}

document.getElementById('prevPostsBtn').addEventListener('click', () => loadPosts(currentPage - 1));
document.getElementById('nextPostsBtn').addEventListener('click', () => loadPosts(currentPage + 1));

// ── Composer: Image Preview ────────────────────────────────────
document.getElementById('postImages').addEventListener('change', (e) => {
    selectedImages = Array.from(e.target.files);
    const preview = document.getElementById('imagePreviewList');
    preview.innerHTML = selectedImages.map((f, i) => `
        <div class="composer-preview-item">
            <img src="${URL.createObjectURL(f)}" />
            <button class="remove-preview" data-index="${i}">&times;</button>
        </div>
    `).join('');

    preview.querySelectorAll('.remove-preview').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedImages.splice(parseInt(btn.dataset.index), 1);
            // Re-trigger change display
            const dt = new DataTransfer();
            selectedImages.forEach(f => dt.items.add(f));
            document.getElementById('postImages').files = dt.files;
            document.getElementById('postImages').dispatchEvent(new Event('change'));
        });
    });
});

// ── Submit Post ────────────────────────────────────────────────
document.getElementById('postBtn').addEventListener('click', async () => {
    const content = document.getElementById('postContent').value.trim();
    if (!content && selectedImages.length === 0) {
        alert('Please add some text or images.');
        return;
    }

    const formData = new FormData();
    if (content) formData.append('content', content);
    selectedImages.forEach(f => formData.append('images', f));

    const btn = document.getElementById('postBtn');
    btn.disabled = true;
    btn.textContent = 'Posting...';

    try {
        const res = await apiRequestWithFile(`/api/spaces/${spaceId}/posts`, formData);
        if (res && res.ok) {
            document.getElementById('postContent').value = '';
            document.getElementById('postImages').value = '';
            document.getElementById('imagePreviewList').innerHTML = '';
            selectedImages = [];
            loadPosts(0);
        } else {
            alert('Failed to post.');
        }
    } catch (e) {
        alert('Failed to post.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Post';
    }
});

// ── Leave / Delete ─────────────────────────────────────────────
async function leaveSpace() {
    if (!confirm('Leave this space?')) return;
    const res = await apiRequest(`/api/spaces/${spaceId}/leave`, { method: 'POST' });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    window.location.href = 'spaces.html';
}

async function deleteSpace() {
    if (!confirm('Delete this space? This cannot be undone.')) return;
    const res = await apiRequest(`/api/spaces/${spaceId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    window.location.href = 'spaces.html';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadSpaceDetail();
    loadPosts(0);
});
