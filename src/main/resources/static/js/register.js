const form = document.getElementById('registerForm');

//Handle from submission
form.addEventListener('submit', (e) => {
    e.preventDefault();// Prevent the default form submission

    //retrieve form data
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    //Basic validation
    if(password != confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    //send POST request to backend API for user registration
    fetch('http://localhost:8080/api/register', {
        method: 'POST',
        headers: {'Content-Type' : 'application/json' },
        body: JSON.stringify({username, password})
    })
    .then(res => res.text())//Parse response as text
    .then(message => {
        alert(message); // Show the response message
        if(message.includes("successful")) {
            // Redirect to login page on successful registration
            window.location.href = 'login.html';
        }
    })
    .catch(error => {
        //Handle errors
        console.error('Registration failed:', error);
        alert('Registration failed. Please try again.');
    });
})