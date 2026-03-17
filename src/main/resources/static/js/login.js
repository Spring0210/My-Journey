document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(result => {
            if (result.message === 'Login successful') {
                // store login information including JWT token
                localStorage.setItem('username', result.username);
                localStorage.setItem('userId', result.userId);
                localStorage.setItem('token', result.token);
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
