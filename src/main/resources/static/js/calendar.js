const imageBaseUrl = "http://localhost:8080";

// Run after the entire DOM content is loaded
document.addEventListener('DOMContentLoaded', function () {
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('userId');
    document.getElementById('user').textContent = username;

    // Fetch all journal entries for the current user from the backend
    fetch(`http://localhost:8080/api/entries/${userId}`)
        .then(res => res.json())
        .then(entries => {
            // Convert each journal entry to an event object for FullCalendar
            const events = entries.map(entry => ({
                title: entry.title,
                start: entry.entryDate,
                id: entry.id
            }));
            console.log("Events loaded:", events);


            const calendarEl = document.getElementById('calendar');

            // Create a FullCalendar instance and configure it
            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,listWeek'
                },
                events: events,

                // When a date is clicked, open a new window with journal entries for that day
                dateClick: (info) => {
                    fetch(`http://localhost:8080/api/entries/user/${userId}/entries/date/${info.dateStr}`)
                        .then(res => res.json())
                        .then(entries => {
                            let content = '';

                            if (entries.length === 0) {
                                content = '<p>No journal entries for this day.</p>';
                            } else {
                                entries.forEach(entry => {
                                    content += `
                                        <h3>${entry.title}</h3>
                                        <p>${entry.content}</p>
                                        ${entry.imagePath ? `<img src="${imageBaseUrl}${entry.imagePath}" width="300"><br>` : ""}
                                        <small>${entry.entryDate}</small>
                                        <hr/>
                                    `;
                                });
                            }

                            //TODO：Do not pop-up a new window
                            // Open a popup window to show entry details
                            const detailWindow = window.open('', '_blank', 'width=600,height=500');
                            detailWindow.document.write(`<html><head><title>${info.dateStr} Journals</title></head><body><h2>Journal Entries for ${info.dateStr}</h2>${content}</body></html>`);
                        });
                }
            });

            // Render the calendar
            calendar.render();
        });
});
