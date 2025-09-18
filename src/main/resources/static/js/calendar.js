const API_BASE = "http://localhost:8080";

// Get user info from layout manager
const username = localStorage.getItem('username');
const userId = localStorage.getItem('userId');

document.addEventListener('DOMContentLoaded', function () {

    // Load all entries to render events on the calendar
    apiRequest(`${API_BASE}/api/entries/${userId}`)
        .then(res => res.json())
        .then(entries => {
            const events = entries.map(e => ({
                title: e.title,
                start: e.entryDate,
                id: e.id
            }));

            const calendarEl = document.getElementById('calendar');
            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listWeek' },
                events,

                // Navigate to a dedicated day page
                dateClick: (info) => {
                    // Open a new page for that day
                    window.location.href = `day.html?date=${info.dateStr}`;
                },

                // Open detail page for a specific entry
                eventClick: (info) => {
                    info.jsEvent.preventDefault();
                    window.location.href = `detail.html?id=${info.event.id}`;
                }
            });

            calendar.render();
        });
});

