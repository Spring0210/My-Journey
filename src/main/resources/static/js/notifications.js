// Notifications page — list all in-app notifications, mark read, delete

const EMPTY_STATE_HTML = `
    <div class="notif-empty-wrap">
        <svg class="notif-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        <p class="notif-empty-title">No notifications</p>
        <p class="notif-empty-sub">You'll be notified when someone posts or comments in your spaces.</p>
    </div>`;

document.addEventListener('DOMContentLoaded', () => {
    loadNotifications();

    document.getElementById('markAllReadBtn').addEventListener('click', markAllRead);
    document.getElementById('clearAllBtn').addEventListener('click', clearAll);
});

function loadNotifications() {
    apiRequest('/api/notifications')
        .then(res => res && res.ok ? res.json() : Promise.reject())
        .then(data => renderNotifications(data))
        .catch(() => {
            document.getElementById('notifList').innerHTML = `
                <div class="notif-empty-wrap">
                    <svg class="notif-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    <p class="notif-empty-title">Failed to load notifications</p>
                    <p class="notif-empty-sub">Please try refreshing the page.</p>
                </div>`;
        });
}

function markAllRead() {
    apiRequest('/api/notifications/mark-read', { method: 'POST' })
        .then(() => {
            document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
            const badge = document.getElementById('notifBadge');
            if (badge) badge.hidden = true;
        })
        .catch(err => console.error('Failed to mark notifications read:', err));
}

function clearAll() {
    if (!confirm('Delete all notifications? This cannot be undone.')) return;
    apiRequest('/api/notifications', { method: 'DELETE' })
        .then(res => {
            if (res && res.ok) {
                document.getElementById('notifList').innerHTML = EMPTY_STATE_HTML;
                const badge = document.getElementById('notifBadge');
                if (badge) badge.hidden = true;
            }
        })
        .catch(err => console.error('Failed to clear notifications:', err));
}

function renderNotifications(notifications) {
    const container = document.getElementById('notifList');

    if (!notifications || notifications.length === 0) {
        container.innerHTML = EMPTY_STATE_HTML;
        return;
    }

    container.innerHTML = notifications.map(n => buildNotifHtml(n)).join('');

    // Bind per-item delete buttons
    container.querySelectorAll('.notif-delete-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault(); // don't navigate
            e.stopPropagation();
            deleteOne(btn.dataset.id, btn.closest('.notif-item'));
        });
    });

    // Auto-mark all read once the page is viewed
    markAllRead();
}

function deleteOne(notifId, itemEl) {
    apiRequest(`/api/notifications/${notifId}`, { method: 'DELETE' })
        .then(res => {
            if (res && res.ok) {
                itemEl.remove();
                // If no items left, show empty state
                if (!document.querySelector('.notif-item')) {
                    document.getElementById('notifList').innerHTML = EMPTY_STATE_HTML;
                }
            }
        })
        .catch(err => console.error('Failed to delete notification:', err));
}

// Build notification card HTML
function buildNotifHtml(n) {
    const unreadClass = n.read ? '' : 'unread';
    const href = n.spaceId ? `/space.html?id=${n.spaceId}` : '#';
    const text = buildNotifText(n);
    const timeStr = formatRelativeTime(n.createdAt);

    const avatarHtml = n.actorAvatar
        ? `<img src="${n.actorAvatar}" alt="${escapeHtml(n.actorUsername)}" />`
        : `<span>${n.actorUsername ? n.actorUsername.charAt(0).toUpperCase() : '?'}</span>`;

    return `
        <a class="notif-item ${unreadClass}" href="${href}" data-id="${n.id}">
            <div class="notif-dot"></div>
            <div class="notif-avatar">${avatarHtml}</div>
            <div class="notif-body">
                <p class="notif-text">${text}</p>
                <span class="notif-time">${timeStr}</span>
            </div>
            <button class="notif-delete-btn" data-id="${n.id}" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                </svg>
            </button>
        </a>`;
}

function buildNotifText(n) {
    const actor = `<strong>${escapeHtml(n.actorUsername || 'Someone')}</strong>`;
    const space = n.spaceName ? `<strong>${escapeHtml(n.spaceName)}</strong>` : 'a space';

    if (n.type === 'NEW_POST') return `${actor} posted in ${space}`;
    if (n.type === 'NEW_COMMENT') return `${actor} commented on your post in ${space}`;
    return `New activity in ${space}`;
}

// escapeHtml is defined in api.js (loaded before this file)

function formatRelativeTime(isoString) {
    if (!isoString) return '';
    const dt = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');
    const diffMs = Date.now() - dt.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return dt.toLocaleDateString();
}
