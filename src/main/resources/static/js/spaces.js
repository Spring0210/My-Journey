const userId = localStorage.getItem('userId');

async function loadSpaces() {
    const container = document.getElementById('spacesList');
    try {
        const res = await apiRequest('/api/spaces');
        const spaces = await res.json();

        if (!spaces || spaces.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>You haven't joined any spaces yet.</p>
                    <p>Create one or join with an invite code.</p>
                </div>`;
            return;
        }

        container.innerHTML = spaces.map(space => `
            <div class="space-card" onclick="window.location.href='space.html?id=${space.id}'">
                <div class="space-card-cover" style="${space.coverImage ? `background-image:url(${space.coverImage})` : ''}">
                    ${!space.coverImage ? `<div class="space-card-initial">${space.name.charAt(0).toUpperCase()}</div>` : ''}
                </div>
                <div class="space-card-body">
                    <div class="space-card-header">
                        <h3>${escapeHtml(space.name)}</h3>
                        <span class="role-badge role-badge--${space.role.toLowerCase()}">${space.role}</span>
                    </div>
                    <p class="space-card-desc">${escapeHtml(space.description || 'No description')}</p>
                    <p class="space-card-owner">by ${escapeHtml(space.ownerUsername)}</p>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p class="muted">Failed to load spaces.</p>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showModal(id) { document.getElementById(id).hidden = false; }
function hideModal(id) { document.getElementById(id).hidden = true; }

// Create Space
document.getElementById('createBtn').addEventListener('click', () => showModal('createModal'));
document.getElementById('closeCreateModal').addEventListener('click', () => hideModal('createModal'));
document.getElementById('cancelCreate').addEventListener('click', () => hideModal('createModal'));

document.getElementById('confirmCreate').addEventListener('click', async () => {
    const name = document.getElementById('spaceName').value.trim();
    const desc = document.getElementById('spaceDesc').value.trim();
    if (!name) { alert('Space name is required.'); return; }

    try {
        const res = await apiRequest('/api/spaces', {
            method: 'POST',
            body: JSON.stringify({ name, description: desc })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
        hideModal('createModal');
        document.getElementById('spaceName').value = '';
        document.getElementById('spaceDesc').value = '';
        window.location.href = `space.html?id=${data.id}`;
    } catch (e) {
        alert('Failed to create space.');
    }
});

// Join Space
document.getElementById('joinBtn').addEventListener('click', () => showModal('joinModal'));
document.getElementById('closeJoinModal').addEventListener('click', () => hideModal('joinModal'));
document.getElementById('cancelJoin').addEventListener('click', () => hideModal('joinModal'));

document.getElementById('confirmJoin').addEventListener('click', async () => {
    const inviteCode = document.getElementById('inviteCodeInput').value.trim();
    if (!inviteCode) { alert('Invite code is required.'); return; }

    try {
        const res = await apiRequest('/api/spaces/join', {
            method: 'POST',
            body: JSON.stringify({ inviteCode })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
        hideModal('joinModal');
        window.location.href = `space.html?id=${data.id}`;
    } catch (e) {
        alert('Failed to join space.');
    }
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.hidden = true;
    });
});

document.addEventListener('DOMContentLoaded', loadSpaces);
