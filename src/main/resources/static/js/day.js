const API_BASE = "";
const IMAGE_BASE = "";

// Read ?date=YYYY-MM-DD
function getDateParam() {
  const url = new URL(window.location.href);
  return url.searchParams.get("date");
}

// Render all entries of the day
function renderDayEntries(entries) {
  const list = document.getElementById("list");
  list.innerHTML = "";

  if (!entries || entries.length === 0) {
    list.innerHTML = `<p>No journal entries for this day.</p>`;
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement("div");
    card.className = "card";
    
    // Handle multiple images display
    let imagesHtml = '';
    if (entry.imagePaths) {
      const imagePaths = entry.imagePaths.split(',').filter(path => path.trim());
      if (imagePaths.length > 0) {
        imagesHtml = '<div class="entry-images">';
        imagePaths.forEach(path => {
          const trimmedPath = path.trim();
          // Check if it's already a full URL (Cloudinary) or needs localhost prefix
          const imageSrc = trimmedPath.startsWith('http') ? trimmedPath : `${IMAGE_BASE}${trimmedPath}`;
          imagesHtml += `<img src="${imageSrc}" alt="entry image">`;
        });
        imagesHtml += '</div>';
      }
    }
    
    card.innerHTML = `
      <h3><a class="title" href="detail.html?id=${entry.id}">${escapeHtml(entry.title)}</a></h3>
      <div class="meta">${escapeHtml(entry.entryDate)}</div>
      <p>${escapeHtml(entry.content ?? "")}</p>
      ${imagesHtml}
    `;
    
    // Add click event for the entire card
    card.addEventListener('click', (e) => {
      if(!e.target.closest('a') && e.target.tagName !== 'IMG'){
        window.location.href = `detail.html?id=${entry.id}`;
      }
    });
    
    // Add click events for images
    addImageClickEvents(card);
    
    list.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Get user info from layout manager
  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");
  
  const dateStr = getDateParam();
  document.getElementById("dayText").textContent = dateStr || "";

  if (!dateStr) {
    showToast("Missing date parameter.");
    window.location.href = "calendar.html";
    return;
  }

  // Fetch entries for the given user and date
  apiRequest(`${API_BASE}/api/entries/user/${userId}/entries/date/${dateStr}`)
    .then(res => res.json())
    .then(renderDayEntries)
    .catch(err => {
      console.error("Failed to load day entries:", err);
      renderDayEntries([]);
    });
});
