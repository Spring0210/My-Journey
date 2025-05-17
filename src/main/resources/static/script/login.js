document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('http://localhost:8080/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(result => {
            if (result.message === 'Login successful') {
                // store login information
                localStorage.setItem('username', result.username);
                localStorage.setItem('userId', result.userId);
                window.location.href = 'journals.html';
            } else {
                alert('Login failed');
            }
        });

});
