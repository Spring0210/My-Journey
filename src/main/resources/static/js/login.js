document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
    })
        .then(res => res.json())
        .then(result => {
            if (result.message === 'Login successful') {
                localStorage.setItem('username', result.username);
                localStorage.setItem('userId', result.userId);
                localStorage.setItem('token', result.token);
                if (result.avatar) localStorage.setItem('avatar', result.avatar);
                window.location.href = 'dashboard.html';
            } else {
                alert(result.error || 'Login failed');
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            alert('Login failed');
        });
});
