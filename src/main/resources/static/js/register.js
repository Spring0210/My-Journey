const form = document.getElementById('registerForm');

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const errEl = document.getElementById('err-password');

    const emailPattern = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailPattern.test(email)) {
        document.getElementById('err-email').textContent = 'Please enter a valid email address.';
        document.getElementById('err-email').removeAttribute('hidden');
        return;
    }

    if (password !== confirmPassword) {
        errEl.textContent = 'Passwords do not match.';
        errEl.removeAttribute('hidden');
        return;
    }

    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    })
    .then(res => res.text())
    .then(message => {
        if (message.includes('successful')) {
            window.location.href = 'login.html';
        } else {
            errEl.textContent = message;
            errEl.removeAttribute('hidden');
        }
    })
    .catch(() => {
        errEl.textContent = 'Registration failed. Please try again.';
        errEl.removeAttribute('hidden');
    });
});
