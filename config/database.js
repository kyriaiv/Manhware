// config/database.js

const mysql = require('mysql2');

// Membuat koneksi ke MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Ganti dengan username MySQL Anda
    password: '@Blackhaze123',      // Ganti dengan password MySQL Anda
    database: 'manhware' // Ganti dengan nama database Anda
});

// Menyambungkan ke MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database: ', err);
        return;
    }
    console.log('Connected to the MySQL database');
});

module.exports = db;