// Profile page — handles avatar/username update and change password flow

document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');

    // ── View 1: Profile ─────────────────────────────────────────
    const avatarInput   = document.getElementById('avatarInput');
    const avatarPreview = document.getElementById('avatarPreview');
    const usernameInput = document.getElementById('usernameInput');
    const saveBtn       = document.getElementById('saveBtn');
    const statusMsg     = document.getElementById('statusMsg');

    usernameInput.value = localStorage.getItem('username') || '';
    renderAvatarPreview(localStorage.getItem('avatar'));

    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => renderAvatarPreview(e.target.result);
        reader.readAsDataURL(file);
    });

    saveBtn.addEventListener('click', async () => {
        const newUsername = usernameInput.value.trim();
        const avatarFile  = avatarInput.files[0];

        if (!newUsername && !avatarFile) {
            showStatus('Nothing to update.', false);
            return;
        }

        const formData = new FormData();
        if (newUsername) formData.append('username', newUsername);
        if (avatarFile)  formData.append('avatar', avatarFile);

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            const res  = await apiRequestWithFile(`/api/profile/${userId}`, formData, 'PUT');
            const data = await res.json();
            if (data.error) {
                showStatus(data.error, false);
            } else {
                if (data.username) localStorage.setItem('username', data.username);
                if (data.avatar)   localStorage.setItem('avatar', data.avatar);
                if (!data.avatar)  localStorage.removeItem('avatar');
                if (window.layoutManager) window.layoutManager.setupUserInfo();
                showStatus('Profile updated!', true);
            }
        } catch (err) {
            showStatus('Failed to save changes.', false);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });

    function renderAvatarPreview(src) {
        if (src) {
            avatarPreview.innerHTML = `<img src="${src}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            avatarPreview.innerHTML = '';
            avatarPreview.textContent = (localStorage.getItem('username') || '?').charAt(0).toUpperCase();
        }
    }

    function showStatus(msg, success) {
        statusMsg.textContent = msg;
        statusMsg.style.color = success ? 'var(--success)' : 'var(--danger)';
        statusMsg.style.display = 'block';
    }

    // ── View 2: Change Password ──────────────────────────────────
    const viewProfile        = document.getElementById('viewProfile');
    const viewChangePassword = document.getElementById('viewChangePassword');
    const sendCodeBtn        = document.getElementById('sendCodeBtn');
    const confirmPwBtn       = document.getElementById('confirmPwBtn');
    const cancelPwBtn        = document.getElementById('cancelPwBtn');
    const pwStep1            = document.getElementById('pwStep1');
    const pwStep2            = document.getElementById('pwStep2');
    const pwStatusMsg        = document.getElementById('pwStatusMsg');

    function showPwStatus(msg, success) {
        pwStatusMsg.textContent = msg;
        pwStatusMsg.style.color = success ? 'var(--success)' : 'var(--danger)';
        pwStatusMsg.style.display = 'block';
    }

    function resetChangePasswordView() {
        pwStep1.hidden = false;
        pwStep2.hidden = true;
        document.getElementById('pwCode').value    = '';
        document.getElementById('pwNew').value     = '';
        document.getElementById('pwConfirm').value = '';
        pwStatusMsg.style.display = 'none';
    }

    document.getElementById('openChangePwBtn').addEventListener('click', () => {
        resetChangePasswordView();
        viewProfile.hidden        = true;
        viewChangePassword.hidden = false;
    });

    cancelPwBtn.addEventListener('click', () => {
        viewChangePassword.hidden = true;
        viewProfile.hidden        = false;
        statusMsg.style.display   = 'none';
    });

    sendCodeBtn.addEventListener('click', async () => {
        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = 'Sending...';
        pwStatusMsg.style.display = 'none';
        try {
            const res = await apiRequest('/api/change-password/send-code', { method: 'POST' });
            if (res && res.ok) {
                pwStep1.hidden = true;
                pwStep2.hidden = false;
                showPwStatus('Code sent! Check your email.', true);
            } else {
                const data = await res.json();
                showPwStatus(data.error || 'Failed to send code.', false);
            }
        } catch (e) {
            showPwStatus('Failed to send code.', false);
        } finally {
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = 'Send Verification Code';
        }
    });

    confirmPwBtn.addEventListener('click', async () => {
        const code      = document.getElementById('pwCode').value.trim();
        const newPw     = document.getElementById('pwNew').value;
        const confirmPw = document.getElementById('pwConfirm').value;

        if (!code)              { showPwStatus('Please enter the verification code.', false); return; }
        if (newPw.length < 6)   { showPwStatus('New password must be at least 6 characters.', false); return; }
        if (newPw !== confirmPw) { showPwStatus('Passwords do not match.', false); return; }

        confirmPwBtn.disabled = true;
        confirmPwBtn.textContent = 'Confirming...';
        try {
            const res = await apiRequest('/api/change-password', {
                method: 'PUT',
                body: JSON.stringify({ code, newPassword: newPw })
            });
            if (res && res.ok) {
                // Success — switch back to profile view
                viewChangePassword.hidden = true;
                viewProfile.hidden        = false;
                showStatus('Password changed successfully!', true);
            } else {
                const data = await res.json();
                showPwStatus(data.error || 'Failed to change password.', false);
            }
        } catch (e) {
            showPwStatus('Failed to change password.', false);
        } finally {
            confirmPwBtn.disabled = false;
            confirmPwBtn.textContent = 'Confirm Change';
        }
    });
});
