// Wait for DOM to fully load

const form = document.getElementById('forgotPasswordForm');

form.addEventListener('submit', e => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    // Check if passwords match
    if (newPassword !== confirmNewPassword) {
        alert("Passwords do not match.");
        return;
    }

    // Send POST request to backend
    fetch('http://localhost:8080/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword })
    })
        .then(res => res.text())
        .then(message => {
            alert(message);
            if (message.includes("successful")) {
                window.location.href = 'login.html';
            }
        })
        .catch(error => {
            console.error('Password reset failed:', error);
            alert('Error during password reset');
        });
});
