// API请求工具函数
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
                // Token过期或无效，重定向到登录页
                localStorage.clear();
                window.location.href = 'login.html';
                return;
            }
            return response;
        });
}

// 用于文件上传的API请求
function apiRequestWithFile(url, formData) {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(url, {
        method: 'POST',
        headers: headers,
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
