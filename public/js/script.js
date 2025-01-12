document.addEventListener('DOMContentLoaded', function () {
    // Menampilkan pesan jika ada dari server
    const messageElement = document.getElementById('message');
    if (messageElement) {
        alert(messageElement.innerText); // Menampilkan pesan menggunakan alert
    }

    // 1. Event Listener untuk form login
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', function (event) {
            event.preventDefault(); // Mencegah form di-submit secara default

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            // Mengirim request login menggunakan fetch
            fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username, password: password }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.errors) {
                    loginMessage.innerHTML = data.errors.map(err => err.msg).join('<br>');
                } else {
                    window.location.href = '/dashboard'; // Redirect ke dashboard jika login berhasil
                }
            })
            .catch(error => {
                loginMessage.innerHTML = 'Terjadi kesalahan, coba lagi nanti!';
            });
        });
    }

    // 2. Mengambil dan menampilkan Featured Manga
    const featuredMangaContainer = document.getElementById('featuredManga');

    function displayFeaturedManga(manga) {
        const card = document.createElement('div');
        card.classList.add('col-md-4', 'mb-4');

        card.innerHTML = `
            <div class="card">
                <img src="${manga.image}" class="card-img-top" alt="${manga.title}">
                <div class="card-body">
                    <p class="card-text text-center">${manga.title}</p>
                </div>
            </div>
        `;
        
        featuredMangaContainer.appendChild(card);
    }

    // Mengambil data manga dari API atau server jika diperlukan
    if (featuredMangaContainer) {
        fetch('/api/featured-manga')
            .then(response => response.json())
            .then(data => {
                data.forEach(manga => displayFeaturedManga(manga)); // Tampilkan manga satu per satu
            })
            .catch(err => {
                console.log('Error fetching featured manga:', err);
            });
    }

    // 3. Event listener untuk tombol logout
    const logoutButton = document.getElementById('logoutButton');

    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            fetch('/api/logout')
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'You have been logged out.') {
                        window.location.href = '/'; // Redirect ke halaman utama setelah logout
                    }
                })
                .catch(err => {
                    console.log('Error during logout:', err);
                });
        });
    }
});