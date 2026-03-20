// Common layout functionality shared across all authenticated pages
class LayoutManager {
    constructor() {
        this.sidebar = null;
        this.sidebarToggle = null;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.renderSidebar();   // inject sidebar HTML before setting up events
        this.setupSidebar();
        this.setupUserInfo();
        this.setupSignOut();
        this.setupTheme();
        this.setCurrentPageActive();
    }

    // Verify user is logged in; redirect to login if not
    checkAuth() {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        const userId = localStorage.getItem('userId');

        if (!token || !username || !userId) {
            window.location.href = '/login.html';
            return false;
        }

        this.currentUser = { token, username, userId, avatar: localStorage.getItem('avatar') };
        return true;
    }

    // Inject sidebar HTML into the #sidebar placeholder element
    // Centralising the HTML here means every page automatically gets
    // any future nav changes without editing each file individually
    renderSidebar() {
        const el = document.getElementById('sidebar');
        if (!el) return;
        el.innerHTML = `
            <div class="sidebar-header">
                <a href="/dashboard.html" class="sidebar-brand">
                    <div class="logo">J</div>
                    Journey
                </a>
            </div>
            <nav class="sidebar-nav">
                <div class="nav-section">
                    <div class="nav-section-title">Main</div>
                    <a href="/dashboard.html" class="nav-item">Dashboard</a>
                    <a href="/journals.html" class="nav-item">My Journals</a>
                    <a href="/calendar.html" class="nav-item">Calendar View</a>
                </div>
                <div class="nav-section">
                    <div class="nav-section-title">Spaces</div>
                    <a href="/spaces.html" class="nav-item">My Spaces</a>
                </div>
                <div class="nav-section">
                    <div class="nav-section-title">Account</div>
                    <a href="/profile.html" class="nav-item">Profile</a>
                </div>
            </nav>
            <div class="sidebar-footer">
                <!-- Clicking the user info block navigates to profile page -->
                <a href="/profile.html" class="user-info" style="text-decoration:none;cursor:pointer;">
                    <div class="user-avatar" id="sidebarAvatar"></div>
                    <div class="user-details">
                        <h4 id="sidebarUsername"></h4>
                        <p>View profile</p>
                    </div>
                </a>
                <div class="sidebar-footer-actions">
                    <button class="theme-toggle" id="themeToggle" title="Toggle theme">Dark</button>
                    <button class="signout-btn">Sign Out</button>
                </div>
            </div>`;
    }

    // Apply saved or system-preferred theme on load, and wire up the toggle button
    setupTheme() {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        this.applyTheme(theme);

        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.addEventListener('click', () => {
                const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                this.applyTheme(current === 'dark' ? 'light' : 'dark');
            });
        }
    }

    applyTheme(theme) {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        localStorage.setItem('theme', theme);

        const btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
    }

    // Wire up sidebar toggle button and overlay (used on mobile)
    setupSidebar() {
        this.sidebar = document.querySelector('.sidebar');
        this.sidebarToggle = document.querySelector('.sidebar-toggle');
        this.overlay = document.getElementById('sidebarOverlay');

        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeSidebar());
        }
        // Auto-close sidebar when resizing to desktop width
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) this.closeSidebarMobile();
        });
    }

    toggleSidebar() {
        if (this.sidebar) {
            const isOpen = this.sidebar.classList.toggle('open');
            if (this.overlay) this.overlay.classList.toggle('active', isOpen);
        }
    }

    closeSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.remove('open');
            if (this.overlay) this.overlay.classList.remove('active');
        }
    }

    closeSidebarMobile() {
        if (window.innerWidth <= 1024) this.closeSidebar();
    }

    // Populate the sidebar footer with the current user's avatar and username
    setupUserInfo() {
        if (!this.currentUser) return;

        const avatarEl = document.getElementById('sidebarAvatar');
        const usernameEl = document.getElementById('sidebarUsername');

        if (avatarEl) {
            if (this.currentUser.avatar) {
                // Show avatar image if available
                avatarEl.innerHTML = `<img src="${this.currentUser.avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                // Fall back to first letter of username
                avatarEl.textContent = this.currentUser.username.charAt(0).toUpperCase();
            }
        }
        if (usernameEl) usernameEl.textContent = this.currentUser.username;
    }

    setupSignOut() {
        const signOutBtn = document.querySelector('.signout-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.signOut());
        }
    }

    // Clear all auth data from localStorage and return to login
    signOut() {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        localStorage.removeItem('avatar');
        window.location.href = '/login.html';
    }

    // Highlight the nav item matching the current page path
    setActiveNavItem(path) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === path) {
                item.classList.add('active');
            }
        });
    }

    setCurrentPageActive() {
        this.setActiveNavItem(window.location.pathname);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.layoutManager = new LayoutManager();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayoutManager;
}
