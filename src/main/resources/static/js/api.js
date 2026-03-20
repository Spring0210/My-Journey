// API request utilities
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
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
                // Token expired or invalid, redirect to login
                localStorage.clear();
                window.location.href = 'login.html';
                return;
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
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }
        return response;
    });
}
