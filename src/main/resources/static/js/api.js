// API request utilities
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
