const step1Form = document.getElementById('step1Form');
const step2Form = document.getElementById('step2Form');
const errStep1 = document.getElementById('err-step1');
const errStep2 = document.getElementById('err-step2');
const backBtn = document.getElementById('backBtn');

let savedUsername = '';

// Step 1: Send code
step1Form.addEventListener('submit', e => {
    e.preventDefault();
    errStep1.hidden = true;

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    savedUsername = username;

    fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
    })
    .then(res => res.text())
    .then(message => {
        if (message === 'Code sent') {
            step1Form.hidden = true;
            step2Form.hidden = false;
        } else {
            errStep1.textContent = message;
            errStep1.hidden = false;
        }
    })
    .catch(() => {
        errStep1.textContent = 'Failed to send code. Please try again.';
        errStep1.hidden = false;
    });
});

// Step 2: Verify code and reset password
step2Form.addEventListener('submit', e => {
    e.preventDefault();
    errStep2.hidden = true;

    const code = document.getElementById('code').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
        errStep2.textContent = 'Passwords do not match.';
        errStep2.hidden = false;
        return;
    }

    fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: savedUsername, code, newPassword })
    })
    .then(res => res.text())
    .then(message => {
        if (message === 'Password reset successful') {
            alert('Password reset successfully! Please log in.');
            window.location.href = 'login.html';
        } else {
            errStep2.textContent = message;
            errStep2.hidden = false;
        }
    })
    .catch(() => {
        errStep2.textContent = 'Reset failed. Please try again.';
        errStep2.hidden = false;
    });
});

// Back to step 1
backBtn.addEventListener('click', () => {
    step2Form.hidden = true;
    step1Form.hidden = false;
    errStep1.hidden = true;
});
