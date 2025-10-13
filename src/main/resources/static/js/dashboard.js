// Dashboard functionality
const API_BASE = "http://localhost:8080";

// Get user info from layout manager
const username = localStorage.getItem('username');
const userId = localStorage.getItem('userId');

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load all entries for statistics
        const response = await apiRequest(`${API_BASE}/api/entries/${userId}`);
        const entries = await response.json();
        
        // Calculate statistics
        const totalEntries = entries.length;
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        
        const thisMonthEntries = entries.filter(entry => {
            const entryDate = new Date(entry.entryDate);
            return entryDate.getMonth() === thisMonth && entryDate.getFullYear() === thisYear;
        }).length;
        
        // Count total images
        let totalImages = 0;
        entries.forEach(entry => {
            if (entry.imagePaths) {
                const imagePaths = entry.imagePaths.split(',').filter(path => path.trim());
                totalImages += imagePaths.length;
            }
        });
        
        // Calculate streak (simplified - consecutive days with entries)
        const streakDays = calculateStreak(entries);
        
        // Update statistics display
        document.getElementById('totalEntries').textContent = totalEntries;
        document.getElementById('thisMonthEntries').textContent = thisMonthEntries;
        document.getElementById('totalImages').textContent = totalImages;
        document.getElementById('streakDays').textContent = streakDays;
        
        // Load recent entries (last 5)
        loadRecentEntries(entries.slice(0, 5));
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        document.getElementById('recentEntries').innerHTML = '<p class="muted">Failed to load recent entries.</p>';
    }
}

// Calculate writing streak
function calculateStreak(entries) {
    if (entries.length === 0) return 0;
    
    // Sort entries by date (newest first)
    const sortedEntries = entries.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Get unique dates with entries
    const entryDates = [...new Set(sortedEntries.map(entry => entry.entryDate))];
    
    for (let i = 0; i < entryDates.length; i++) {
        const entryDate = new Date(entryDates[i]);
        entryDate.setHours(0, 0, 0, 0);
        
        const diffTime = currentDate - entryDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === i) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

// Load and display recent entries
function loadRecentEntries(entries) {
    const container = document.getElementById('recentEntries');
    
    if (entries.length === 0) {
        container.innerHTML = '<p class="muted">No entries yet. <a href="/journals.html">Create your first entry</a>!</p>';
        return;
    }
    
    let html = '';
    entries.forEach(entry => {
        const entryDate = new Date(entry.entryDate);
        const formattedDate = entryDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        // Handle multiple images display
        let imagesHtml = '';
        if (entry.imagePaths) {
            const imagePaths = entry.imagePaths.split(',').filter(path => path.trim());
            if (imagePaths.length > 0) {
                imagesHtml = '<div class="entry-images">';
                imagePaths.slice(0, 3).forEach(path => {
                    const trimmedPath = path.trim();
                    // Check if it's already a full URL (Cloudinary) or needs localhost prefix
                    const imageSrc = trimmedPath.startsWith('http') ? trimmedPath : `${API_BASE}${trimmedPath}`;
                    imagesHtml += `<img src="${imageSrc}" alt="Entry image">`;
                });
                if (imagePaths.length > 3) {
                    imagesHtml += `<span class="more-images">+${imagePaths.length - 3}</span>`;
                }
                imagesHtml += '</div>';
            }
        }
        
        html += `
            <div class="recent-entry" onclick="window.location.href='detail.html?id=${entry.id}'">
                <div class="recent-entry-content">
                    <h4>${entry.title}</h4>
                    <p class="recent-entry-preview">${entry.content ? entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '') : 'No content'}</p>
                    <div class="recent-entry-meta">
                        <span class="entry-date">${formattedDate}</span>
                        ${imagesHtml}
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
});
