const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const { debug } = require('console');
const User = require('./models/User'); 
const flash = require('connect-flash');
const multer = require('multer'); //upload
const fs = require('fs'); //auto folder
const ejs = require('ejs'); //file ejs auto
const expressLayouts = require('express-ejs-layouts');

dotenv.config();

const app = express();
const port = 3000;

// Set EJS as the template engine dan yang lain ya
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Tentukan folder tempat template EJS berada
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);
app.set('layout', 'layout'); // Mengacu pada views/layout.ejs
 

// Rute dinamis untuk Anime
app.get('/anime/:folderName/:fileName', (req, res) => {
    const { folderName, fileName } = req.params;

    // Pastikan fileName tidak mengandung ekstensi, hanya nama file
    res.render(`anime/${folderName}/${fileName}`, { 
        title: fileName, 
        user: req.user 
    });
});

// Rute dinamis untuk Manhwa
app.get('/manhwa/:folderName/:fileName', (req, res) => {
    const { folderName, fileName } = req.params;

    // Pastikan fileName tidak mengandung ekstensi
    res.render(`manhwa/${folderName}/${fileName}`, { 
        title: fileName, 
        user: req.user 
    });
});

// Middleware session dan flash
app.use(session({
    secret: 'your-secret-key', // Ganti dengan key yang aman
    resave: false,
    saveUninitialized: true
}));

app.use(flash());


// Middleware untuk body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Menambahkan middleware untuk file statis (CSS, JS, gambar, dll.)


// Middleware session
app.use(session({
    secret: 'your-secret-key', // Gantilah dengan kunci yang lebih kuat
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set ke true jika menggunakan HTTPS
        httpOnly: true, // Melindungi cookie agar tidak diakses oleh JavaScript
        maxAge: 1000 * 60 * 60 // 1 jam
    }
}));

// Middleware untuk menangani session expired
app.use((req, res, next) => {
    if (req.session.user) {
        // Cek jika session user ada dan sudah expired
        const sessionExpiresAt = req.session.cookie.expires; // Waktu kedaluwarsa session
        if (sessionExpiresAt && new Date(sessionExpiresAt) < new Date()) {
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).json({ message: 'Session destroy failed' });
                }
                res.redirect('/login'); // Jika session habis, redirect ke halaman login
            });
        } else {
            next(); // Jika session belum expired, lanjutkan ke middleware berikutnya
        }
    } else {
        next(); // Jika tidak ada session user, lanjutkan
    }

});

// Middleware untuk menambahkan user ke semua view
app.use((req, res, next) => {
    res.locals.user = req.user; // Memastikan user tersedia di semua view
    next();
});

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Route untuk login
app.post('/api/login', 
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').trim().notEmpty().withMessage('Password is required'),
    (req, res) => {
        // Validasi input dari user
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.render('login', {
                errors: errors.array(), // Kirimkan errors ke halaman login.ejs
                message: 'Please check your input.' // Kirimkan pesan error secara umum jika perlu
            });
        }

        const { username, password } = req.body;

        // Query untuk mencari user berdasarkan username
        const query = 'SELECT * FROM users WHERE username = ?';
        db.query(query, [username], (err, result) => {
            if (err) {
                console.error('Error during login:', err);
                // Tampilkan pesan error internal ke pengguna dengan aman
                return res.status(500).render('login', {
                    message: 'Internal server error. Please try again later.'
                });
            }

            // Jika username tidak ditemukan
            if (result.length === 0) {
                console.log('Login failed: Username not found');
                return res.render('login', {
                    message: 'Invalid username. Please register first or try again.',
                    redirectToRegister: true // Arahkan ke halaman pendaftaran
                });
            }

            const user = result[0];

            // Validasi password
            const isPasswordCorrect = bcrypt.compareSync(password, user.password);

            if (!isPasswordCorrect) {
                console.log('Login failed: Incorrect password for user:', username);
                return res.render('login', {
                    message: 'Invalid password. Please try again.',
                    redirectToRegister: false // Tidak perlu mengarahkan ke halaman pendaftaran
                });
            }

            // Login berhasil: Set session user
            req.session.user = { id: user.id, username: user.username };
            console.log('Login successful for user:', username);
            res.redirect('/dashboard');
        });
    }
);

// Route untuk halaman dashboard (auth required)
app.get('/dashboard', checkAuth, (req, res) => {
    res.render('dashboard', { user: req.session.user }); // Merender halaman dashboard.ejs dengan data user dari session
});

// Route untuk menampilkan halaman register
app.get('/register', (req, res) => {
    res.render('register', { message: null }); // Render halaman register.ejs
});

// Route untuk registrasi user
app.post('/api/users', 
    // Validasi input
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').trim().notEmpty().withMessage('Password is required'),
    body('email').trim().notEmpty().isEmail().withMessage('Valid email is required'),
    async (req, res) => {
        // Log data untuk debugging
        console.log('Request Body:', req.body);

        // Cek validasi input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({
                message: 'Validation failed',
                errors: errors.array(),
            });
        }

        const { username, password, email } = req.body;

        try {
            // Cek apakah username sudah ada di database
            const [rows] = await db.promise().query('SELECT * FROM users WHERE username = ?', [username]);

            if (rows.length > 0) {
                return res.status(400).json({
                    message: 'Username already exists. Please choose a different one.',
                });
            }

            // Enkripsi password sebelum disimpan
            const hashedPassword = await bcrypt.hash(password, 10);

            // Menyimpan user baru ke database
            const [result] = await db.promise().query(
                'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
                [username, hashedPassword, email]
            );

            console.log('User registered successfully:', result);

             // Set flash message
             req.flash('success', 'Registration successful! You can now log in.');

            // Redirect ke halaman index.ejs setelah registrasi berhasil
            return res.redirect('/login'); // Mengarahkan ke halaman Login (login.ejs)
        } catch (err) {
            console.error('Error handling registration:', err);

            // Pastikan hanya satu respons yang dikirim
            if (!res.headersSent) {
                return res.status(500).json({ message: 'Internal server error' });
            }
        }
    }
);


// Route untuk halaman login (GET)
app.get('/login', (req, res) => {
    res.render('login', {
        message: req.query.message || null, // Menyertakan query message jika ada
        messages: req.flash('success') // Menyertakan flash messages
    });
});

// Route untuk logout
app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        console.log('User logged out, session destroyed'); // Log out message
        res.redirect('/'); // Redirect to home page
    });
});

// Route search
app.get('/api/search', checkAuth, (req, res) => {
    const query = req.query.query;
    const searchQuery = 'SELECT * FROM your_table WHERE your_column LIKE ?';
    db.query(searchQuery, [`%${query}%`], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error searching data' });
        }
        res.json(results);
    });
});

// Route search manga
app.get('/search', (req, res) => {
    const query = req.query.query.toLowerCase();
    const results = featuredManga.filter((manga) => manga.title.toLowerCase().includes(query));
    res.render('search-results', { results });
});

// Route utama
app.get('/', (req, res) => {
    const featuredManga = [
        { id: 1, title: 'One Piece', image: '/images/one_piece.jpg', description: 'A story about pirates...', author: 'Eiichiro Oda' },
        { id: 2, title: 'Naruto', image: '/images/naruto.jpg', description: 'A ninja’s journey...', author: 'Masashi Kishimoto' },
        { id: 3, title: 'Attack on Titan', image: '/images/attack_on_titan.jpg', description: 'A tale of survival...', author: 'Hajime Isayama' }
    ];
    
    // manga detail
    app.get('/manga/:id', (req, res) => {
        const mangaId = parseInt(req.params.id, 10);
        const manga = featuredManga.find((item) => item.id === mangaId);
        if (!manga) {
            return res.status(404).render('404'); // Halaman 404 jika manga tidak ditemukan
        }
        res.render('manga-detail', { manga });
    });

    // Kirim featuredManga dan user dari session ke template
    res.render('index', { 
        title: 'Welcome to Manhware',
        user: req.user,
        layout: true
    });
});

// Route untuk menampilkan halaman profil
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    const userId = req.session.user.id; // Ambil ID user dari session

    // Ambil data user dari database, termasuk foto profil
    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, result) => {
        if (err) {
            console.error('Error fetching user data:', err);
            return res.status(500).send('Internal server error');
        }

        const user = result[0]; // Ambil data pengguna pertama

        res.render('profile', { user }); // Kirim data user ke halaman profile.ejs
    });
});

// Route untuk menangani update profil
app.post('/update-profile', (req, res) => {
    const { name, email, password } = req.body;
    const userId = req.session.user.id; // Ambil ID user dari session

    let query = 'UPDATE Users SET username = ?, email = ?';
    let params = [name, email];

    if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10); // Hash password baru
        query += ', password = ?';
        params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(userId);

    db.execute(query, params, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).render('profile', { message: 'Something went wrong' });
        }
        req.session.user.username = name; // Update nama user di session
        req.session.user.email = email;   // Update email user di session
        return res.redirect('/profile');
    });
});

// Middleware untuk cek apakah user sudah login
function checkAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).send('Unauthorized');
    }
    next();
}

//Route uploads main folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Konfigurasi multer untuk menyimpan file di folder 'uploads'
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Menambahkan timestamp agar nama file unik
    }
});

const upload = multer({ storage: storage });


// Halaman Index  Anime dan Manhwa
app.get('/anime', (req, res) => {
    console.log('User:', req.session.user);  // Debugging untuk melihat apakah user tersedia
    
    const animeFolder = path.join(__dirname, 'views', 'anime');
    
    fs.readdir(animeFolder, (err, files) => {
        if (err) {
            console.log('Error reading anime folder:', err);
            return res.status(500).send('Something went wrong while reading the anime folder.');
        }

        // Menyaring folder yang valid (hanya folder)
        const folders = files.filter(file => fs.lstatSync(path.join(animeFolder, file)).isDirectory());

        // Render halaman dengan data folder dan user, termasuk kategori anime
        res.render('anime/index', { 
            folders, 
            user: req.session.user,  // Menggunakan req.session.user untuk memastikan session user dikirim
            category: 'anime'  // Mengirim kategori anime
        });
    });
});

//Route Index manwha
app.get('/manhwa', (req, res) => {
    const manhwaFolder = path.join(__dirname, 'views', 'manhwa');
    
    fs.readdir(manhwaFolder, (err, files) => {
        if (err) {
            console.log('Error reading manhwa folder:', err);
            return res.status(500).send('Something went wrong while reading the manhwa folder.');
        }

        // Menyaring folder yang valid (hanya folder)
        const folders = files.filter(file => fs.lstatSync(path.join(manhwaFolder, file)).isDirectory());

        // Render halaman dengan data folder dan user, termasuk kategori manhwa
        res.render('manhwa/index', { 
            folders, 
            user: req.session.user,  // Menggunakan req.session.user untuk memastikan session user dikirim
            category: 'manhwa'  // Mengirim kategori manhwa
        });
    });
});

// Konten EJS berdasarkan kategori
app.post('/upload/:category', checkAuth, checkAdmin, upload.single('file'), (req, res) => {
    const { category } = req.params;
    const { folderName } = req.body;
    const pageTitle = req.body.pageTitle || '$Uploadedfile.filename';
    const uploadedFile = req.file;
    

    // Validasi input
    if (!folderName || !pageTitle || !uploadedFile) {
        console.error('Input tidak valid:', { folderName, pageTitle, uploadedFile });
        return res.status(400).render('error', { message: 'Semua input harus diisi dengan benar.', user: req.user });
    }

    const folderPath = path.join(__dirname, 'views', category, folderName);

    // Membuat folder jika belum ada
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    // Lokasi file EJS
    const ejsFilePath = path.join(folderPath, `${folderName}.ejs`);

    // Konten EJS
    const ejsContent = `
        <div class="content">
    <h1>${pageTitle}</h1>
    ${
        category === 'anime'
            ? `<div class="video-container">
            <video id="video-player" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto">
        <source src="/uploads/${uploadedFile.filename}" type="video/mp4">
        Your browser does not support the video tag.
    </video>
        </div>
                    <div class="video-actions">
                        <button id="fullscreen-btn" class="btn btn-primary">Fullscreen</button>
                    </div>
               </div>`
            : `<img src="/uploads/${uploadedFile.filename}" alt="${pageTitle}" class="img-fluid">`
    }
</div>
    `;

    // Menyimpan file EJS
    fs.writeFile(ejsFilePath, ejsContent, (err) => {
        if (err) {
            console.error('Error saving EJS file:', err);
            return res.status(500).send('Terjadi kesalahan saat menyimpan file.');
        }

        console.log(`File ${folderName}.ejs created in ${folderPath}`);

        // Redirect ke halaman baru
        res.redirect(`/${category}/${folderName}`);
    });
});

// Route Dinamis
app.get('/:category/:folderName', (req, res) => {
    const { category, folderName } = req.params;
    const filePath = path.join(__dirname, 'views', category, folderName, `${folderName}.ejs`);

    // Periksa apakah file .ejs ada
    if (fs.existsSync(filePath)) {
        // Render file .ejs yang sudah dibuat sebelumnya
        res.render(path.join(category, folderName, folderName), { title: folderName });
    } else {
        console.log('File tidak ditemukan:', filePath);
        // Kembalikan halaman 404 jika file tidak ditemukan
        res.status(404).send('Page not found');
    }
});

// Route Anime Manhwa Index
app.get('/anime', (req, res) => {
    res.render('anime/index', { 
        user: req.user, 
        category: 'anime', 
        title: 'Anime - Manhware' // Menambahkan title
    });
});

app.get('/manhwa', (req, res) => {
    res.render('manhwa/index', { 
        user: req.user, 
        category: 'manhwa', 
        title: 'Manhwa - Manhware' // Menambahkan title
    });
});



// Route untuk upload foto profil
app.post('/profile/upload', upload.single('profilePhoto'), (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Pastikan user sudah login
    }

    const userId = req.session.user.id; // Ambil ID user dari session
    const profilePhotoPath = '/uploads/' + req.file.filename; // Path foto yang telah di-upload

    // Update foto profil di database
    db.query('UPDATE users SET profile_photo = ? WHERE id = ?', [profilePhotoPath, userId], (err, result) => {
        if (err) {
            console.error('Error updating profile photo:', err);
            return res.status(500).send('Internal server error');
        }

        // Setelah update berhasil, redirect ke halaman profil
        res.redirect('/profile');
    });
});

// Middleware untuk mengecek admin
function checkAdmin(req, res, next) {
    // Pastikan user sudah login dan memiliki username 'admin'
    if (req.session.user && req.session.user.username === 'admin') {
        return next(); // Lanjutkan ke route berikutnya
    } else {
        return res.status(403).send('Access denied. Only admin can create new folders and pages.'); // Akses ditolak jika bukan admin
    }
}

// Middleware untuk mengecek login
function checkAuth(req, res, next) {
    // Pastikan user sudah login
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect ke halaman login jika user belum login
    }
    next(); // Lanjutkan ke route berikutnya jika sudah login
}

// Index Folder anime
app.get('/anime', (req, res) => {
    const animeFolder = path.join(__dirname, 'views', 'anime');
    
    // Membaca folder anime
    fs.readdir(animeFolder, (err, files) => {
        if (err) {
            console.log('Error reading anime folder:', err);
            return res.status(500).send('Something went wrong while reading the anime folder.');
        }

        // Menyaring folder yang valid (hanya folder)
        const folders = files.filter(file => {
            const filePath = path.join(animeFolder, file);
            return fs.lstatSync(filePath).isDirectory(); // Hanya folder yang diambil
        });

        // Render halaman 'anime/index.ejs' dengan data folder dan user
        res.render('anime/index', { 
            folders: folders, 
            user: req.session.user // Mengirim data user yang disimpan di session
        });
    });
});

//Route untuk Manhwa di index folder manhwa
app.get('/manhwa', (req, res) => {
    const manhwaFolder = path.join(__dirname, 'views', 'manhwa');
    
    // Membaca folder manhwa
    fs.readdir(manhwaFolder, (err, files) => {
        if (err) {
            console.log('Error reading manhwa folder:', err);
            return res.status(500).send('Something went wrong while reading the manhwa folder.');
        }

        // Menyaring folder yang valid (hanya folder)
        const folders = files.filter(file => {
            const filePath = path.join(manhwaFolder, file);
            return fs.lstatSync(filePath).isDirectory(); // Hanya folder yang diambil
        });

        // Render halaman 'manhwa/index.ejs' dengan data folder dan user
        res.render('manhwa/index', { 
            folders: folders, 
            user: req.session.user // Mengirim data user yang disimpan di session
        });
    });
});




// Middleware untuk menangani error dan menampilkan detail error
app.use((err, req, res, next) => {
    console.error('Error occurred:', err); // Menampilkan detail error di terminal
    res.status(500).send('Something went wrong!'); // Mengirimkan pesan error
});



// Mulai server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});