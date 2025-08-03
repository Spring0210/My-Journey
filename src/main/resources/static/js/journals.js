const username = localStorage.getItem('username');
const userId = localStorage.getItem('userId');
const imageBaseUrl = "http://localhost:8080";

document.getElementById('user').textContent = username;

// Load all entries for current user
function loadAllEntries() {
    fetch(`http://localhost:8080/api/entries/${userId}`)
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
        div.innerHTML = `
      <h3>${entry.title}</h3>
      <p>${entry.content}</p>
      <small>${entry.entryDate}</small>
      ${entry.imagePath ? `<img src="http://localhost:8080${entry.imagePath}" width="300"><br>` : ''}
      <button class="edit-btn" data-id="${entry.id}" 
              data-title="${entry.title}" 
              data-content="${entry.content}" 
              data-date="${entry.entryDate}" 
              data-image="${entry.imagePath || ''}">✏ Edit</button>
      <button class="delete-btn" data-id="${entry.id}">🗑 Delete</button>
      <hr/>
    `;
        list.appendChild(div);
    });
}


// Toggle the visibility of the entry form
document.getElementById('toggleFormBtn').addEventListener('click', () => {
    const form = document.getElementById('entryForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
});


// Submit new journal entry to backend, if editingEntryId is not null, means editing journal.
document.getElementById('submitEntry').addEventListener('click', () => {
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const entryDate = document.getElementById('entryDate').value;
    const image = document.getElementById('image').files[0];

    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    formData.append("entryDate", entryDate);
    if (image) formData.append("image", image);

    const url = editingEntryId
        ? `http://localhost:8080/api/entries/edit/${editingEntryId}`
        : `http://localhost:8080/api/entries/${userId}`;


    fetch(url, {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(() => {
            alert(editingEntryId ? "Entry updated." : "Entry created.");

            // Reset form after submission
            editingEntryId = null;
            // document.getElementById('submitEntry').textContent = 'Submit';
            document.getElementById('title').value = '';
            document.getElementById('content').value = '';
            document.getElementById('entryDate').value = '';

            location.reload();
        })
        .catch(err => {
            alert("Upload failed.");
            console.error(err);
        });


});

// Load all entries for the current user
fetch(`http://localhost:8080/api/entries/${userId}`)
    .then(res => res.json())
    .then(entries => {
        const list = document.getElementById('journalList');
        entries.forEach(entry => {
            const div = document.createElement('div');
            div.innerHTML = `
        <h3>${entry.title}</h3>
        <p>${entry.content}</p>
        <small>${entry.entryDate}</small>
        ${entry.imagePath ? `<img src="${imageBaseUrl}${entry.imagePath}" width="300"><br>` : ""}
        <button class="edit-btn" data-id="${entry.id}" 
            data-title="${entry.title}" 
            data-content="${entry.content}" 
            data-date="${entry.entryDate}">✏ Edit</button>
        <button class="delete-btn" data-id="${entry.id}">🗑 Delete</button>
        <hr/>
      `;

            list.appendChild(div);
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

        fetch(`http://localhost:8080/api/entries/${entryId}`, {
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

    fetch(`http://localhost:8080/api/entries/search?${params.toString()}`)
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


