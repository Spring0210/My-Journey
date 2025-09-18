const imageBaseUrl = "http://localhost:8080";

// Get user info from layout manager
const username = localStorage.getItem('username');
const userId = localStorage.getItem('userId');

// Load all entries for current user
function loadAllEntries() {
    apiRequest(`http://localhost:8080/api/entries/${userId}`)
        .then(res => res.json())
        .then(entries => {
            renderEntryList(entries);
        });
}

// Render entries in journalList div
function renderEntryList(entries) {
    const list = document.getElementById('journalList');
    list.innerHTML = ''; // clear old content

    entries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'card card-entry'; 
        
        // Handle multiple images display - show max 2 images in card
        let imagesHtml = '';
        if (entry.imagePaths) {
            const imagePaths = entry.imagePaths.split(',').filter(path => path.trim());
            if (imagePaths.length > 0) {
                imagesHtml = '<div class="entry-images">';
                // Show only first 2 images in card
                const displayImages = imagePaths.slice(0, 2);
                displayImages.forEach(path => {
                    imagesHtml += `<img src="http://localhost:8080${path.trim()}" alt="Entry image">`;
                });
                // Show count if there are more images
                if (imagePaths.length > 2) {
                    imagesHtml += `<div class="more-images-count">+${imagePaths.length - 2}</div>`;
                }
                imagesHtml += '</div>';
            }
        }
        
        div.innerHTML = `
      <h3>${entry.title}</h3>
      <p>${entry.content}</p>
      <small>${entry.entryDate}</small>
      ${imagesHtml}
      <hr/>
    `;
        
        // Add click events for images
        addImageClickEvents(div);
        
        div.addEventListener('click', (e) => {
            if(!e.target.closest('button') && e.target.tagName !== 'IMG'){
                window.location.href = `detail.html?id=${entry.id}`;
            }
        })
        list.appendChild(div);
    });
}


// Toggle the visibility of the entry form
document.getElementById('toggleFormBtn').addEventListener('click', () => {
    const form = document.getElementById('entryForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
});

// Image preview functionality
document.getElementById('images').addEventListener('change', function(e) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.margin = '5px';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    }
});


// Submit new journal entry to backend, if editingEntryId is not null, means editing journal.
document.getElementById('submitEntry').addEventListener('click', () => {
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const entryDate = document.getElementById('entryDate').value;
    const images = document.getElementById('images').files;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    formData.append("entryDate", entryDate);
    
    // Add multiple images
    for (let i = 0; i < images.length; i++) {
        formData.append("images", images[i]);
    }

    const url = editingEntryId
        ? `http://localhost:8080/api/entries/edit/${editingEntryId}`
        : `http://localhost:8080/api/entries/${userId}`;

    apiRequestWithFile(url, formData)
        .then(res => res.json())
        .then(() => {
            alert(editingEntryId ? "Entry updated." : "Entry created.");

            // Reset form after submission
            editingEntryId = null;
            document.getElementById('title').value = '';
            document.getElementById('content').value = '';
            document.getElementById('entryDate').value = '';
            document.getElementById('images').value = '';
            document.getElementById('imagePreview').innerHTML = '';

            location.reload();
        })
        .catch(err => {
            alert("Upload failed.");
            console.error(err);
        });
});

//Edit entry
let editingEntryId = null; // track editing mode

// Update form UI for editing
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('edit-btn')) {
        editingEntryId = e.target.getAttribute('data-id');
        document.getElementById('title').value = e.target.getAttribute('data-title');
        document.getElementById('content').value = e.target.getAttribute('data-content');
        document.getElementById('entryDate').value = e.target.getAttribute('data-date');

        document.getElementById('entryForm').style.display = 'block';
        document.getElementById('submitEntry').textContent = 'Save';
    }
});


//Delete entry
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-btn')) {
        const entryId = e.target.getAttribute('data-id');

        // Confirm before deleting
        const confirmDelete = confirm("Are you sure you want to delete this journal entry?");
        if (!confirmDelete) return;

        apiRequest(`http://localhost:8080/api/entries/${entryId}`, {
            method: 'DELETE'
        })
            .then(res => {
                if (res.ok) {
                    alert("Entry deleted.");
                    location.reload(); // Refresh the page after deletion
                } else {
                    alert("Failed to delete entry.");
                }
            })
            .catch(err => {
                alert("Error deleting entry.");
                console.error(err);
            });
    }
});

// Handle search
document.getElementById('searchBtn').addEventListener('click', () => {
    const keyword = document.getElementById('searchKeyword').value;
    const date = document.getElementById('searchDate').value;

    const params = new URLSearchParams();
    params.append("userId", userId);
    if (keyword) params.append("keyword", keyword);
    if (date) params.append("date", date);

    apiRequest(`http://localhost:8080/api/entries/search?${params.toString()}`)
        .then(res => res.json())
        .then(entries => {
            renderEntryList(entries); // render filtered results
        });
});

// Clear search and reload full list
document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchDate').value = '';
    loadAllEntries(); // reload all
});

document.addEventListener('DOMContentLoaded', loadAllEntries);

