const form = document.getElementById('registerForm');

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    })
    .then(res => res.text())
    .then(message => {
        alert(message);
        if (message.includes("successful")) {
            window.location.href = 'login.html';
        }
    })
    .catch(error => {
        console.error('Registration failed:', error);
        alert('Registration failed. Please try again.');
    });
});
