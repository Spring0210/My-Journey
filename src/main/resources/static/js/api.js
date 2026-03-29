// ── Shared utilities ────────────────────────────────────────────────────────

// Escape user-supplied strings before inserting into innerHTML to prevent XSS
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Toast notification — replaces alert() for non-blocking feedback
// type: 'error' (default) | 'success' | 'info'
(function injectToastStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .toast {
            position: fixed;
            bottom: 28px;
            left: 50%;
            transform: translateX(-50%) translateY(12px);
            background: #1C1C1E;
            color: #fff;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
            opacity: 0;
            transition: opacity 0.22s, transform 0.22s;
            z-index: 99999;
            max-width: calc(100vw - 48px);
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.35);
            pointer-events: none;
        }
        .toast--visible { opacity: 1; transform: translateX(-50%) translateY(0); }
        .toast--error   { background: #FF3B30; }
        .toast--success { background: #34C759; color: #fff; }
        .toast--info    { background: #007AFF; }
        @media (prefers-color-scheme: dark) {
            .toast { background: #2C2C2E; }
        }
    `;
    document.head.appendChild(style);
})();

function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
        toast.classList.remove('toast--visible');
        setTimeout(() => toast.remove(), 280);
    }, 3000);
}

// ── API request utilities ────────────────────────────────────────────────────
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// Attempt to get a new access token using the stored refresh token.
// Returns true on success (localStorage updated), false if refresh failed.
async function tryRefreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
        const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        });
        if (!res.ok) return false;

        const data = await res.json();
        localStorage.setItem('token',        data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('username',     data.username);
        localStorage.setItem('userId',       String(data.userId));
        if (data.avatar) localStorage.setItem('avatar', data.avatar);
        return true;
    } catch {
        return false;
    }
}

// On 401: try silent refresh, retry the original request once, then redirect to login
async function handleUnauthorized(url, options) {
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
        localStorage.clear();
        window.location.href = 'login.html';
        return;
    }
    // Rebuild auth header with the new token and retry once
    const retryOptions = {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };
    const retryRes = await fetch(url, retryOptions);
    if (retryRes.status === 401) {
        // Refresh token was accepted but new access token is also invalid — force logout
        localStorage.clear();
        window.location.href = 'login.html';
        return;
    }
    return retryRes;
}

function apiRequest(url, options = {}) {
    const defaultOptions = {
        headers: getAuthHeaders()
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    return fetch(url, finalOptions)
        .then(response => {
            if (response.status === 401) {
                return handleUnauthorized(url, finalOptions);
            }
            return response;
        });
}

// API request for file uploads (multipart/form-data)
// method defaults to POST but can be overridden (e.g. PUT for profile updates)
function apiRequestWithFile(url, formData, method = 'POST') {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, {
        method,
        headers,
        body: formData
    })
    .then(response => {
        if (response.status === 401) {
            return handleUnauthorized(url, { method, headers, body: formData });
        }
        return response;
    });
}
