const API_BASE = "http://localhost:8080";
const IMAGE_BASE = "http://localhost:8080";

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
    card.innerHTML = `
      <h3><a class="title" href="detail.html?id=${entry.id}">${entry.title}</a></h3>
      <div class="meta">${entry.entryDate}</div>
      <p>${entry.content ?? ""}</p>
      ${entry.imagePath ? `<img src="${IMAGE_BASE}${entry.imagePath}" alt="entry image">` : ""}
    `;
    list.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("backBtn").addEventListener("click", () => {
    if (document.referrer) history.back();
    else window.location.href = "calendar.html";
  });

  const userId = localStorage.getItem("userId");
  const dateStr = getDateParam();
  document.getElementById("dayText").textContent = dateStr || "";

  if (!dateStr) {
    alert("Missing date parameter.");
    window.location.href = "calendar.html";
    return;
  }

  // Fetch entries for the given user and date
  fetch(`${API_BASE}/api/entries/user/${userId}/entries/date/${dateStr}`)
    .then(res => res.json())
    .then(renderDayEntries)
    .catch(err => {
      console.error("Failed to load day entries:", err);
      renderDayEntries([]);
    });
});
