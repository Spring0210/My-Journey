const userId = parseInt(localStorage.getItem('userId'));
const username = localStorage.getItem('username');
const myAvatar = localStorage.getItem('avatar');
const spaceId = new URLSearchParams(window.location.search).get('id');
let currentPage = 0;
let totalPages = 0;
let selectedImages = [];
let objectUrls = [];
let selectedVideos = [];
let videoObjectUrls = [];
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
        renderMembersList(space.members);

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

// ── Members List ───────────────────────────────────────────────
function renderMembersList(members) {
    document.getElementById('memberCount').textContent = `(${members.length})`;
    const list = document.getElementById('membersList');
    list.innerHTML = '';

    members.forEach(m => {
        const row = document.createElement('div');
        row.className = 'member-row';
        row.dataset.userId = m.userId;

        // Kick button — owner only, not shown for the owner themselves
        const kickHtml = (isOwner && m.role !== 'OWNER')
            ? `<button class="kick-btn" title="Remove member">✕</button>`
            : '';

        row.innerHTML = `
            ${renderAvatar(m.avatar, m.username)}
            <div class="member-info">
                <span class="member-name">${escapeHtml(m.username)}</span>
                ${m.role === 'OWNER' ? '<span class="role-badge role-badge--owner">Owner</span>' : ''}
            </div>
            ${kickHtml}
        `;

        if (isOwner && m.role !== 'OWNER') {
            row.querySelector('.kick-btn').addEventListener('click', () => kickMember(m.userId, m.username, row));
        }

        list.appendChild(row);
    });
}

async function kickMember(targetUserId, targetUsername, rowEl) {
    if (!confirm(`Remove ${targetUsername} from this space?`)) return;
    try {
        const res = await apiRequest(`/api/spaces/${spaceId}/members/${targetUserId}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Failed to remove member.');
            return;
        }
        // Remove row from DOM and update count
        rowEl.remove();
        const countEl = document.getElementById('memberCount');
        const current = parseInt(countEl.textContent.replace(/\D/g, '')) || 0;
        countEl.textContent = `(${current - 1})`;
    } catch (e) {
        alert('Failed to remove member.');
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

// ── Video Player ───────────────────────────────────────────────
function renderVideoList(videos) {
    if (!videos || videos.length === 0) return '';
    return `<div class="video-list">${
        videos.map(url => `
            <div class="video-wrap">
                <video controls preload="metadata" playsinline>
                    <source src="${url}" />
                </video>
            </div>`).join('')
    }</div>`;
}

function renderPost(post) {
    const canDelete = post.authorId === userId || isOwner;
    const canEdit   = post.authorId === userId;
    // Show "(edited)" if the post was updated after creation (allow 1s tolerance)
    const wasEdited = post.updatedAt && post.createdAt &&
        new Date(post.updatedAt + 'Z') - new Date(post.createdAt + 'Z') > 1000;
    return `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                ${renderAvatar(post.authorAvatar, post.authorUsername)}
                <div class="post-meta">
                    <span class="post-author">${escapeHtml(post.authorUsername)}</span>
                    <span class="post-date">${formatDate(post.createdAt)}${wasEdited ? ' <span class="post-edited">(edited)</span>' : ''}</span>
                </div>
                <div class="post-actions">
                    ${canEdit   ? `<button class="post-edit-btn"   data-post-id="${post.id}" title="Edit">Edit</button>` : ''}
                    ${canDelete ? `<button class="post-delete-btn" data-post-id="${post.id}" title="Delete">&times;</button>` : ''}
                </div>
            </div>
            ${post.content ? `<p class="post-content">${escapeHtml(post.content)}</p>` : ''}
            ${renderImageGrid(post.id, post.images)}
            ${renderVideoList(post.videos)}
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

    // Edit buttons — inline editing of post text
    container.querySelectorAll('.post-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card     = container.querySelector(`.post-card[data-post-id="${btn.dataset.postId}"]`);
            const contentEl = card.querySelector('.post-content');
            // Prevent opening a second editor on the same post
            if (card.querySelector('.post-edit-area')) return;

            const original = contentEl ? contentEl.textContent : '';

            // Hide the original content paragraph while editing
            if (contentEl) contentEl.hidden = true;

            const editor = document.createElement('div');
            editor.className = 'post-edit-area';
            editor.innerHTML = `
                <textarea class="post-edit-textarea">${escapeHtml(original)}</textarea>
                <div class="post-edit-btns">
                    <button class="btn btn--primary btn--sm post-edit-save">Save</button>
                    <button class="btn btn--ghost  btn--sm post-edit-cancel">Cancel</button>
                </div>
            `;

            // Insert editor right after the post header
            const header = card.querySelector('.post-header');
            header.insertAdjacentElement('afterend', editor);
            editor.querySelector('.post-edit-textarea').focus();

            // Cancel — restore original state
            editor.querySelector('.post-edit-cancel').addEventListener('click', () => {
                editor.remove();
                if (contentEl) contentEl.hidden = false;
            });

            // Save — call API and update DOM on success
            editor.querySelector('.post-edit-save').addEventListener('click', async () => {
                const newContent = editor.querySelector('.post-edit-textarea').value.trim();
                if (!newContent) { alert('Content cannot be empty.'); return; }

                const saveBtn = editor.querySelector('.post-edit-save');
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';

                try {
                    const res = await apiRequest(
                        `/api/spaces/${spaceId}/posts/${btn.dataset.postId}`,
                        { method: 'PATCH', body: JSON.stringify({ content: newContent }) }
                    );
                    if (!res.ok) { alert('Failed to save.'); return; }

                    // Update the content paragraph in-place
                    if (contentEl) {
                        contentEl.textContent = newContent;
                        contentEl.hidden = false;
                    } else {
                        // Post had no text before — create the element
                        const p = document.createElement('p');
                        p.className = 'post-content';
                        p.textContent = newContent;
                        editor.insertAdjacentElement('beforebegin', p);
                    }
                    // Mark post as edited
                    const dateEl = card.querySelector('.post-date');
                    if (dateEl && !dateEl.querySelector('.post-edited')) {
                        dateEl.insertAdjacentHTML('beforeend', ' <span class="post-edited">(edited)</span>');
                    }
                    editor.remove();
                } catch (e) {
                    alert('Failed to save.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                }
            });
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

// ── Composer: Image & Video Preview ───────────────────────────
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

    videoObjectUrls.forEach(url => URL.revokeObjectURL(url));
    videoObjectUrls = selectedVideos.map(f => URL.createObjectURL(f));

    const preview = document.getElementById('imagePreviewList');

    const imageItems = objectUrls.map((url, i) => `
        <div class="composer-preview-item">
            <img src="${url}" />
            <button class="remove-preview" data-index="${i}" data-type="image">&times;</button>
        </div>
    `).join('');

    const videoItems = videoObjectUrls.map((url, i) => `
        <div class="composer-preview-item composer-preview-video">
            <video src="${url}" preload="metadata"></video>
            <div class="video-thumb-play">▶</div>
            <button class="remove-preview" data-index="${i}" data-type="video">&times;</button>
        </div>
    `).join('');

    preview.innerHTML = imageItems + videoItems;

    preview.querySelectorAll('.remove-preview').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            if (btn.dataset.type === 'video') {
                selectedVideos.splice(idx, 1);
            } else {
                selectedImages.splice(idx, 1);
            }
            renderComposerPreviews();
        });
    });
}

document.getElementById('postVideos').addEventListener('change', (e) => {
    // Limit to 1 video per post
    selectedVideos = Array.from(e.target.files).slice(0, 1);
    renderComposerPreviews();
});

// ── Submit Post ────────────────────────────────────────────────
document.getElementById('postBtn').addEventListener('click', async () => {
    const content = document.getElementById('postContent').value.trim();
    if (!content && selectedImages.length === 0 && selectedVideos.length === 0) {
        alert('Please add some text, images, or a video.');
        return;
    }

    const formData = new FormData();
    if (content) formData.append('content', content);
    selectedImages.forEach(f => formData.append('images', f));
    selectedVideos.forEach(f => formData.append('videos', f));

    const btn = document.getElementById('postBtn');
    btn.disabled = true;
    btn.textContent = 'Posting...';

    // Show progress bar when uploading a video (images are fast)
    const hasVideo = selectedVideos.length > 0;
    const progressEl = document.getElementById('uploadProgress');
    const fillEl = document.getElementById('uploadProgressFill');
    const textEl = document.getElementById('uploadProgressText');
    if (hasVideo) {
        progressEl.hidden = false;
        fillEl.style.width = '0%';
        textEl.textContent = 'Uploading 0%';
    }

    try {
        const token = localStorage.getItem('token');
        const ok = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/spaces/${spaceId}/posts`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            if (hasVideo) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        fillEl.style.width = `${pct}%`;
                        textEl.textContent = `Uploading ${pct}%`;
                    }
                };
            }

            xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(formData);
        });

        if (ok) {
            document.getElementById('postContent').value = '';
            document.getElementById('imagePreviewList').innerHTML = '';
            document.getElementById('postVideos').value = '';
            selectedImages = [];
            selectedVideos = [];
            objectUrls = [];
            videoObjectUrls = [];
            loadPosts(0);
        } else {
            alert('Failed to post.');
        }
    } catch (e) {
        alert('Failed to post.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Post';
        progressEl.hidden = true;
        fillEl.style.width = '0%';
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

// ── AI Recap ───────────────────────────────────────────────────
document.getElementById('aiSummaryBtn').addEventListener('click', async () => {
    const modal = document.getElementById('aiSummaryModal');
    const textEl = document.getElementById('aiSummaryText');
    const btn = document.getElementById('aiSummaryBtn');

    textEl.textContent = 'Generating...';
    modal.hidden = false;
    btn.disabled = true;

    try {
        const res = await apiRequest(`/api/spaces/${spaceId}/ai-summary`, { method: 'POST' });
        const data = await res.json();
        if (data.error) { textEl.textContent = data.error; return; }
        textEl.textContent = data.summary;
    } catch (e) {
        textEl.textContent = 'Failed to generate summary. Please try again.';
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('closeAiSummaryModal').addEventListener('click', () => {
    document.getElementById('aiSummaryModal').hidden = true;
});
document.getElementById('closeAiSummaryBtn').addEventListener('click', () => {
    document.getElementById('aiSummaryModal').hidden = true;
});
document.getElementById('aiSummaryModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('aiSummaryModal'))
        document.getElementById('aiSummaryModal').hidden = true;
});

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadSpaceDetail();
    loadPosts(0);
});
