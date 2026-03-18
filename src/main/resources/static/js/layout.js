// Common layout functionality for all pages
class LayoutManager {
    constructor() {
        this.sidebar = null;
        this.sidebarToggle = null;
        this.currentUser = null;
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupSidebar();
        this.setupUserInfo();
        this.setupSignOut();
        this.setupTheme();
        this.setCurrentPageActive();
    }

    // Check if user is authenticated
    checkAuth() {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        const userId = localStorage.getItem('userId');

        if (!token || !username || !userId) {
            // Redirect to login if not authenticated
            window.location.href = '/login.html';
            return false;
        }

        this.currentUser = { token, username, userId };
        return true;
    }

    // Setup theme toggle (light/dark)
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
        if (btn) {
            btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
        }
    }

    // Setup sidebar functionality
    setupSidebar() {
        this.sidebar = document.querySelector('.sidebar');
        this.sidebarToggle = document.querySelector('.sidebar-toggle');
        this.overlay = document.getElementById('sidebarOverlay');

        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Close sidebar when clicking overlay
        if (this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.closeSidebar();
            });
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) {
                this.closeSidebarMobile();
            }
        });
    }

    // Toggle sidebar visibility (mobile)
    toggleSidebar() {
        if (this.sidebar) {
            const isOpen = this.sidebar.classList.toggle('open');
            if (this.overlay) this.overlay.classList.toggle('active', isOpen);
        }
    }

    // Close sidebar and overlay (mobile)
    closeSidebar() {
        if (this.sidebar) {
            this.sidebar.classList.remove('open');
            if (this.overlay) this.overlay.classList.remove('active');
        }
    }

    // Close sidebar only on mobile (no-op on desktop)
    closeSidebarMobile() {
        if (window.innerWidth <= 1024) {
            this.closeSidebar();
        }
    }

    // Setup user information display
    setupUserInfo() {
        if (this.currentUser) {
            // Update username in header if element exists
            const userElement = document.getElementById('user');
            if (userElement) {
                userElement.textContent = this.currentUser.username;
            }

            // Update user info in sidebar
            const userAvatar = document.querySelector('.user-avatar');
            const userName = document.querySelector('.user-details h4');
            const userEmail = document.querySelector('.user-details p');

            if (userAvatar) {
                userAvatar.textContent = this.currentUser.username.charAt(0).toUpperCase();
            }
            if (userName) {
                userName.textContent = this.currentUser.username;
            }
            if (userEmail) {
                userEmail.textContent = `ID: ${this.currentUser.userId}`;
            }
        }
    }

    // Setup sign out functionality
    setupSignOut() {
        const signOutBtn = document.querySelector('.signout-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                this.signOut();
            });
        }
    }

    // Sign out user
    signOut() {
        // Clear stored authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');

        // Redirect to login page
        window.location.href = '/login.html';
    }

    // Set active navigation item
    setActiveNavItem(path) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === path) {
                item.classList.add('active');
            }
        });
    }

    // Auto-detect current page and set active nav item
    setCurrentPageActive() {
        const currentPath = window.location.pathname;
        this.setActiveNavItem(currentPath);
    }

    // Show loading state
    showLoading(element) {
        if (element) {
            element.innerHTML = '<div class="loading">Loading...</div>';
        }
    }

    // Hide loading state
    hideLoading(element, content) {
        if (element) {
            element.innerHTML = content;
        }
    }
}

// Initialize layout when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.layoutManager = new LayoutManager();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayoutManager;
}
