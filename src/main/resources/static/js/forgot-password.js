const step1Form = document.getElementById('step1Form');
const step2Form = document.getElementById('step2Form');
const errStep1  = document.getElementById('err-step1');
const errStep2  = document.getElementById('err-step2');
const resendBtn = document.getElementById('resendBtn');

let savedUsername = '';
let savedEmail    = '';
let resendTimer   = null;

function sendCode(username, email) {
    return fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
    }).then(res => res.text());
}

function startResendCooldown(seconds) {
    resendBtn.disabled = true;
    let remaining = seconds;
    resendBtn.textContent = `Resend (${remaining}s)`;
    resendTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(resendTimer);
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend';
        } else {
            resendBtn.textContent = `Resend (${remaining}s)`;
        }
    }, 1000);
}

// Step 1: Send code
step1Form.addEventListener('submit', e => {
    e.preventDefault();
    errStep1.textContent = '';

    const username = document.getElementById('username').value.trim();
    const email    = document.getElementById('email').value.trim();
    savedUsername  = username;
    savedEmail     = email;

    const submitBtn = step1Form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    sendCode(username, email)
        .then(message => {
            if (message === 'Code sent') {
                step1Form.hidden = true;
                step2Form.hidden = false;
                document.getElementById('codeSentMsg').textContent =
                    `A 6-digit code was sent to ${email}. It expires in 10 minutes.`;
                startResendCooldown(60);
            } else {
                errStep1.textContent = message;
            }
        })
        .catch(() => {
            errStep1.textContent = 'Failed to send code. Please try again.';
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Code';
        });
});

// Resend code
resendBtn.addEventListener('click', () => {
    errStep2.textContent = '';
    resendBtn.disabled = true;

    sendCode(savedUsername, savedEmail)
        .then(message => {
            if (message === 'Code sent') {
                document.getElementById('code').value = '';
                document.getElementById('codeSentMsg').textContent =
                    `Code resent to ${savedEmail}. It expires in 10 minutes.`;
                startResendCooldown(60);
            } else {
                errStep2.textContent = message;
                resendBtn.disabled = false;
            }
        })
        .catch(() => {
            errStep2.textContent = 'Failed to resend code. Please try again.';
            resendBtn.disabled = false;
        });
});

// Step 2: Reset password
step2Form.addEventListener('submit', e => {
    e.preventDefault();
    errStep2.textContent = '';

    const code            = document.getElementById('code').value.trim();
    const newPassword     = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmPassword) {
        errStep2.textContent = 'Passwords do not match.';
        return;
    }

    const submitBtn = step2Form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';

    fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: savedUsername, code, newPassword })
    })
    .then(res => res.text())
    .then(message => {
        if (message === 'Password reset successful') {
            window.location.href = '/login.html';
        } else {
            errStep2.textContent = message;
        }
    })
    .catch(() => {
        errStep2.textContent = 'Reset failed. Please try again.';
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password';
    });
});
