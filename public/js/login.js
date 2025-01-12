document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (!data.username || !data.password) {
        alert('Please fill in both fields');
        return;
    }

    if (data.username.length < 3 || data.password.length < 8) {
        alert('Username must be at least 3 characters and password at least 8 characters');
        return;
    }

    const loginButton = e.target.querySelector('button[type="submit"]');
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            alert(`Error: ${response.statusText}`);
            return;
        }

        const result = await response.json();
        if (result.message === 'Login successful') {
            window.location.href = '/dashboard';
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred while logging in. Please try again.');
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});