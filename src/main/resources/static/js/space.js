const userId = parseInt(localStorage.getItem('userId'));
const username = localStorage.getItem('username');
const myAvatar = localStorage.getItem('avatar');
const spaceId = new URLSearchParams(window.location.search).get('id');
let currentPage = 0;
let totalPages = 0;
let selectedImages = [];
let objectUrls = [];
let isOwner = false;
let lightboxImages = [];
let lightboxIndex = 0;
// Store post images in JS Map instead of DOM data attributes
const postImagesMap = new Map();

// Render a user avatar: show image if avatarUrl is available, otherwise show initial letter
function renderAvatar(avatarUrl, username, cssClass = 'member-avatar') {
    if (avatarUrl) {
        return `<div class="${cssClass}"><img src="${avatarUrl}" alt="${escapeHtml(username)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>`;
    }
    return `<div class="${cssClass}">${username.charAt(0).toUpperCase()}</div>`;
}

if (!spaceId) window.location.href = 'spaces.html';

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(isoStr) {
    return new Date(isoStr + 'Z').toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

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

        // Show cover image if available
        if (space.coverImage) {
            document.getElementById('spaceCoverImg').src = space.coverImage;
            document.getElementById('spaceCoverWrap').hidden = false;
        }

        isOwner = space.ownerUsername === username;

        // Invite code visible to all members
        document.getElementById('inviteCodeBox').hidden = false;
        document.getElementById('inviteCode').textContent = space.inviteCode;

        // Edit button for owner
        if (isOwner) {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn--ghost btn--sm';
            editBtn.textContent = 'Edit Space';
            editBtn.addEventListener('click', () => openEditModal(space));
            document.getElementById('spaceInfoActions').appendChild(editBtn);
        }

        // Members
        document.getElementById('memberCount').textContent = `(${space.members.length})`;
        document.getElementById('membersList').innerHTML = space.members.map(m => `
            <div class="member-row">
                ${renderAvatar(m.avatar, m.username)}
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

// ── Edit Space ─────────────────────────────────────────────────
function openEditModal(space) {
    document.getElementById('editSpaceName').value = space.name;
    document.getElementById('editSpaceDesc').value = space.description || '';

    // Show existing cover as preview
    const preview = document.getElementById('coverPreview');
    if (space.coverImage) {
        preview.src = space.coverImage;
        preview.hidden = false;
    } else {
        preview.src = '';
        preview.hidden = true;
    }
    document.getElementById('coverFileInput').value = '';
    document.getElementById('coverFilename').textContent = '';

    document.getElementById('editSpaceModal').hidden = false;
}

// Preview selected cover file
document.getElementById('coverFileInput').addEventListener('change', () => {
    const file = document.getElementById('coverFileInput').files[0];
    if (!file) return;
    document.getElementById('coverFilename').textContent = file.name;
    const preview = document.getElementById('coverPreview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
});

document.getElementById('closeEditModal').addEventListener('click', () => {
    document.getElementById('editSpaceModal').hidden = true;
});
document.getElementById('cancelEdit').addEventListener('click', () => {
    document.getElementById('editSpaceModal').hidden = true;
});
document.getElementById('editSpaceModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('editSpaceModal'))
        document.getElementById('editSpaceModal').hidden = true;
});

document.getElementById('confirmEdit').addEventListener('click', async () => {
    const name = document.getElementById('editSpaceName').value.trim();
    const description = document.getElementById('editSpaceDesc').value.trim();
    if (!name) { alert('Space name is required.'); return; }

    const btn = document.getElementById('confirmEdit');
    btn.disabled = true;
    try {
        // Update name and description
        const res = await apiRequest(`/api/spaces/${spaceId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, description })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
        document.getElementById('spaceTitle').textContent = data.name;
        document.getElementById('spaceDescription').textContent = data.description || 'No description.';
        document.title = `${data.name} - Journey`;

        // Upload cover image if a new file was selected
        const coverFile = document.getElementById('coverFileInput').files[0];
        if (coverFile) {
            const formData = new FormData();
            formData.append('file', coverFile);
            const coverRes = await apiRequestWithFile(`/api/spaces/${spaceId}/cover`, formData, 'PUT');
            const coverData = await coverRes.json();
            if (!coverData.error && coverData.coverImage) {
                document.getElementById('spaceCoverImg').src = coverData.coverImage;
                document.getElementById('spaceCoverWrap').hidden = false;
            }
        }

        document.getElementById('editSpaceModal').hidden = true;
    } catch (e) {
        alert('Failed to update space.');
    } finally {
        btn.disabled = false;
    }
});

// ── Copy Invite Code ───────────────────────────────────────────
document.getElementById('copyCodeBtn').addEventListener('click', () => {
    const code = document.getElementById('inviteCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copyCodeBtn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
});

// ── Image Grid Renderer ────────────────────────────────────────
// Follows Instagram/WeChat grid conventions:
// 1 image  → full width, aspect-ratio preserved
// 2 images → side by side
// 3 images → 1 large left + 2 stacked right
// 4 images → 2x2 grid
// 5 images → 1 large + 4 grid
// 6+ images → 3-col grid, last cell shows "+N more"
function renderImageGrid(postId, images) {
    if (!images || images.length === 0) return '';
    postImagesMap.set(postId, images);

    const count = images.length;
    const MAX_SHOW = 9;
    const shown = images.slice(0, MAX_SHOW);
    const extra = count > MAX_SHOW ? count - MAX_SHOW : 0;

    let gridClass = '';
    if (count === 1) gridClass = 'img-grid--1';
    else if (count === 2) gridClass = 'img-grid--2';
    else if (count === 3) gridClass = 'img-grid--3';
    else if (count === 4) gridClass = 'img-grid--4';
    else gridClass = 'img-grid--n';

    const cells = shown.map((url, i) => {
        const isLast = extra > 0 && i === shown.length - 1;
        return `
            <div class="img-cell${i === 0 && count === 3 ? ' img-cell--tall' : ''}"
                 data-post-id="${postId}" data-index="${i}">
                <img src="${url}" alt="post image" loading="lazy" />
                ${isLast ? `<div class="img-overlay">+${extra}</div>` : ''}
            </div>`;
    }).join('');

    return `<div class="img-grid ${gridClass}">${cells}</div>`;
}

// ── Lightbox ───────────────────────────────────────────────────
function openLightbox(images, index) {
    lightboxImages = images;
    lightboxIndex = index;
    document.getElementById('lightboxImg').src = images[index];
    document.getElementById('lightbox').hidden = false;
    document.getElementById('lightboxPrev').style.display = images.length > 1 ? '' : 'none';
    document.getElementById('lightboxNext').style.display = images.length > 1 ? '' : 'none';
}

document.getElementById('lightboxClose').addEventListener('click', () => {
    document.getElementById('lightbox').hidden = true;
});
document.getElementById('lightboxPrev').addEventListener('click', () => {
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    document.getElementById('lightboxImg').src = lightboxImages[lightboxIndex];
});
document.getElementById('lightboxNext').addEventListener('click', () => {
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    document.getElementById('lightboxImg').src = lightboxImages[lightboxIndex];
});
document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === document.getElementById('lightbox')) {
        document.getElementById('lightbox').hidden = true;
    }
});
document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (lb.hidden) return;
    if (e.key === 'Escape') lb.hidden = true;
    if (e.key === 'ArrowLeft') document.getElementById('lightboxPrev').click();
    if (e.key === 'ArrowRight') document.getElementById('lightboxNext').click();
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
            bindPostEvents(container);
        }

        updatePagination();
    } catch (e) {
        container.innerHTML = '<p class="muted">Failed to load posts.</p>';
    }
}

const ALLOWED_EMOJIS = ['❤️', '👍', '😂', '🐮', '🥲', '😭', '😮'];

function renderReactionBar(post) {
    const counts = (post.reactions && post.reactions.counts) || {};
    const myReaction = post.reactions && post.reactions.myReaction;

    // Only show emojis that already have at least 1 reaction
    const summary = ALLOWED_EMOJIS
        .filter(e => counts[e] > 0)
        .map(e => `
            <button class="reaction-chip${myReaction === e ? ' active' : ''}"
                    data-emoji="${e}" data-post-id="${post.id}">
                ${e}<span class="reaction-chip-count">${counts[e]}</span>
            </button>
        `).join('');

    // The picker is hidden by default; toggled by the "add reaction" button
    const picker = ALLOWED_EMOJIS.map(e => `
        <button class="reaction-pick-btn${myReaction === e ? ' active' : ''}"
                data-emoji="${e}" data-post-id="${post.id}">${e}</button>
    `).join('');

    return `
        <div class="reaction-bar" data-post-id="${post.id}">
            <div class="reaction-summary">${summary}</div>
            <button class="reaction-add-btn" data-post-id="${post.id}" title="Add reaction">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
            </button>
            <div class="reaction-picker" hidden>${picker}</div>
        </div>
    `;
}

function renderCommentItem(comment, postId) {
    const canDelete = comment.authorId === userId || isOwner;
    return `
        <div class="comment-item" data-comment-id="${comment.id}">
            ${renderAvatar(comment.authorAvatar, comment.authorUsername, 'member-avatar')}
            <div class="comment-body">
                <span class="comment-author">${escapeHtml(comment.authorUsername)}</span><span class="comment-text">${escapeHtml(comment.content)}</span>
                <div class="comment-meta">
                    <span class="comment-time">${formatDate(comment.createdAt)}</span>
                    ${canDelete ? `<button class="comment-delete-btn" data-comment-id="${comment.id}" data-post-id="${postId}" title="Delete">Delete</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderCommentSection(post) {
    const count = post.comments ? post.comments.length : 0;
    const toggleLabel = count > 0 ? `${count} comment${count !== 1 ? 's' : ''}` : 'Add a comment';

    const commentItems = (post.comments || [])
        .map(c => renderCommentItem(c, post.id))
        .join('');

    return `
        <div class="comment-section" data-post-id="${post.id}">
            <button class="comment-toggle-btn" data-post-id="${post.id}">${toggleLabel}</button>
            <div class="comment-body-area" hidden>
                <div class="comment-list">${commentItems}</div>
                <div class="comment-input-row">
                    ${renderAvatar(myAvatar, username, 'member-avatar')}
                    <input class="comment-input" type="text" placeholder="Write a comment…" data-post-id="${post.id}" maxlength="500" />
                    <button class="comment-send-btn" data-post-id="${post.id}">Send</button>
                </div>
            </div>
        </div>
    `;
}

function renderPost(post) {
    const canDelete = post.authorId === userId || isOwner;
    return `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                ${renderAvatar(post.authorAvatar, post.authorUsername)}
                <div class="post-meta">
                    <span class="post-author">${escapeHtml(post.authorUsername)}</span>
                    <span class="post-date">${formatDate(post.createdAt)}</span>
                </div>
                ${canDelete ? `<button class="post-delete-btn" data-post-id="${post.id}" title="Delete">&times;</button>` : ''}
            </div>
            ${post.content ? `<p class="post-content">${escapeHtml(post.content)}</p>` : ''}
            ${renderImageGrid(post.id, post.images)}
            ${renderReactionBar(post)}
            ${renderCommentSection(post)}
        </div>
    `;
}

function bindPostEvents(container) {
    // Image grid clicks → lightbox
    container.querySelectorAll('.img-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const postId = parseInt(cell.dataset.postId);
            const index = parseInt(cell.dataset.index);
            const images = postImagesMap.get(postId) || [];
            openLightbox(images, index);
        });
    });

    // Delete buttons
    container.querySelectorAll('.post-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Delete this post?')) return;
            const res = await apiRequest(`/api/spaces/${spaceId}/posts/${btn.dataset.postId}`, { method: 'DELETE' });
            if (res.ok) loadPosts(currentPage);
            else alert('Failed to delete post.');
        });
    });

    // Comment toggle — show/hide the comment area
    container.querySelectorAll('.comment-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = container.querySelector(`.comment-section[data-post-id="${btn.dataset.postId}"]`);
            const area = section.querySelector('.comment-body-area');
            area.hidden = !area.hidden;
            if (!area.hidden) {
                // Focus the input when opening
                area.querySelector('.comment-input')?.focus();
            }
        });
    });

    // Send comment on button click or Enter key
    container.querySelectorAll('.comment-send-btn').forEach(btn => {
        btn.addEventListener('click', () => sendComment(btn.dataset.postId, container));
    });
    container.querySelectorAll('.comment-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendComment(input.dataset.postId, container);
            }
        });
    });

    // Delete comment
    container.querySelectorAll('.comment-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this comment?')) return;
            const res = await apiRequest(
                `/api/spaces/${spaceId}/posts/${btn.dataset.postId}/comments/${btn.dataset.commentId}`,
                { method: 'DELETE' }
            );
            if (res.ok) {
                btn.closest('.comment-item').remove();
                updateCommentToggleLabel(btn.dataset.postId, container);
            }
        });
    });

    // "Add reaction" smiley button — toggles the picker popup
    container.querySelectorAll('.reaction-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bar = container.querySelector(`.reaction-bar[data-post-id="${btn.dataset.postId}"]`);
            const picker = bar.querySelector('.reaction-picker');
            picker.hidden = !picker.hidden;
            btn.classList.toggle('active', !picker.hidden);
        });
    });

    // Emoji picker buttons (inside the popup)
    container.querySelectorAll('.reaction-pick-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const postId = btn.dataset.postId;
            const emoji = btn.dataset.emoji;
            const bar = container.querySelector(`.reaction-bar[data-post-id="${postId}"]`);
            const isSame = btn.classList.contains('active'); // already my reaction

            if (isSame) {
                // Clicking active emoji again removes the reaction
                const res = await apiRequest(`/api/spaces/${spaceId}/posts/${postId}/reaction`, { method: 'DELETE' });
                if (res.ok) updateReactionBar(bar, await res.json());
            } else {
                const res = await apiRequest(`/api/spaces/${spaceId}/posts/${postId}/reaction`, {
                    method: 'POST',
                    body: JSON.stringify({ emoji })
                });
                if (res.ok) updateReactionBar(bar, await res.json());
            }
        });
    });

    // Clicking existing reaction chips also toggles/removes reaction
    container.querySelectorAll('.reaction-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            const postId = chip.dataset.postId;
            const emoji = chip.dataset.emoji;
            const bar = container.querySelector(`.reaction-bar[data-post-id="${postId}"]`);
            const isMine = chip.classList.contains('active');

            if (isMine) {
                const res = await apiRequest(`/api/spaces/${spaceId}/posts/${postId}/reaction`, { method: 'DELETE' });
                if (res.ok) updateReactionBar(bar, await res.json());
            } else {
                const res = await apiRequest(`/api/spaces/${spaceId}/posts/${postId}/reaction`, {
                    method: 'POST',
                    body: JSON.stringify({ emoji })
                });
                if (res.ok) updateReactionBar(bar, await res.json());
            }
        });
    });
}

// Close all open reaction pickers when clicking elsewhere on the page
document.addEventListener('click', () => {
    document.querySelectorAll('.reaction-picker:not([hidden])').forEach(picker => {
        picker.hidden = true;
        const bar = picker.closest('.reaction-bar');
        if (bar) bar.querySelector('.reaction-add-btn')?.classList.remove('active');
    });
});

// Update a single post's reaction bar in-place without re-rendering the whole list
function updateReactionBar(bar, reactions) {
    const counts = reactions.counts || {};
    const myReaction = reactions.myReaction;
    const postId = bar.dataset.postId;

    // Update reaction chips (counts row) — rebuild them since emojis may appear/disappear
    const summary = bar.querySelector('.reaction-summary');
    summary.innerHTML = ALLOWED_EMOJIS
        .filter(e => counts[e] > 0)
        .map(e => `
            <button class="reaction-chip${myReaction === e ? ' active' : ''}"
                    data-emoji="${e}" data-post-id="${postId}">
                ${e}<span class="reaction-chip-count">${counts[e]}</span>
            </button>
        `).join('');

    // Re-attach chip click handlers
    summary.querySelectorAll('.reaction-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            const emoji = chip.dataset.emoji;
            const isMine = chip.classList.contains('active');
            if (isMine) {
                const res = await apiRequest(`/api/spaces/${spaceId}/posts/${postId}/reaction`, { method: 'DELETE' });
                if (res.ok) updateReactionBar(bar, await res.json());
            } else {
                const res = await apiRequest(`/api/spaces/${spaceId}/posts/${postId}/reaction`, {
                    method: 'POST',
                    body: JSON.stringify({ emoji })
                });
                if (res.ok) updateReactionBar(bar, await res.json());
            }
        });
    });

    // Update picker active state
    bar.querySelectorAll('.reaction-pick-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.emoji === myReaction);
    });

    // Close the picker after reacting
    const picker = bar.querySelector('.reaction-picker');
    if (picker) picker.hidden = true;
    bar.querySelector('.reaction-add-btn')?.classList.remove('active');
}

// Send a new comment and insert it into the DOM without re-rendering the whole list
async function sendComment(postId, container) {
    const section = container.querySelector(`.comment-section[data-post-id="${postId}"]`);
    const input = section.querySelector('.comment-input');
    const sendBtn = section.querySelector('.comment-send-btn');
    const content = input.value.trim();
    if (!content) return;

    sendBtn.disabled = true;
    try {
        const res = await apiRequest(`/api/spaces/${spaceId}/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        if (!res.ok) { alert('Failed to post comment.'); return; }

        const comment = await res.json();

        // Insert new comment item before the input row
        const list = section.querySelector('.comment-list');
        list.insertAdjacentHTML('beforeend', renderCommentItem(comment, postId));

        // Re-attach delete handler for the new comment
        const newItem = list.lastElementChild;
        newItem.querySelector('.comment-delete-btn')?.addEventListener('click', async () => {
            if (!confirm('Delete this comment?')) return;
            const delRes = await apiRequest(
                `/api/spaces/${spaceId}/posts/${postId}/comments/${comment.id}`,
                { method: 'DELETE' }
            );
            if (delRes.ok) {
                newItem.remove();
                updateCommentToggleLabel(postId, container);
            }
        });

        input.value = '';
        updateCommentToggleLabel(postId, container);
    } finally {
        sendBtn.disabled = false;
    }
}

// Update the "N comments" label after adding or removing a comment
function updateCommentToggleLabel(postId, container) {
    const section = container.querySelector(`.comment-section[data-post-id="${postId}"]`);
    const count = section.querySelectorAll('.comment-item').length;
    const btn = section.querySelector('.comment-toggle-btn');
    btn.textContent = count > 0 ? `${count} comment${count !== 1 ? 's' : ''}` : 'Add a comment';
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
    // Deduplicate by base name to handle iOS Live Photos, which submit
    // both a HEIC and a paired JPEG as two separate files
    const seen = new Set();
    selectedImages = Array.from(e.target.files).filter(f => {
        const baseName = f.name.replace(/\.[^.]+$/, '');
        if (seen.has(baseName)) return false;
        seen.add(baseName);
        return true;
    });
    renderComposerPreviews();
});

function renderComposerPreviews() {
    // Revoke old object URLs to free memory
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls = selectedImages.map(f => URL.createObjectURL(f));

    const preview = document.getElementById('imagePreviewList');
    preview.innerHTML = objectUrls.map((url, i) => `
        <div class="composer-preview-item">
            <img src="${url}" />
            <button class="remove-preview" data-index="${i}">&times;</button>
        </div>
    `).join('');

    preview.querySelectorAll('.remove-preview').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedImages.splice(parseInt(btn.dataset.index), 1);
            renderComposerPreviews();
        });
    });
}

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
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to leave space.');
        return;
    }
    window.location.href = 'spaces.html';
}

async function deleteSpace() {
    if (!confirm('Delete this space? This cannot be undone.')) return;
    const res = await apiRequest(`/api/spaces/${spaceId}`, { method: 'DELETE' });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete space.');
        return;
    }
    window.location.href = 'spaces.html';
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadSpaceDetail();
    loadPosts(0);
});
