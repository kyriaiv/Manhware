// models/User.js
const db = require('../config/database'); // Import koneksi database

// Fungsi untuk membuat pengguna baru
const createUser = (username, email, password, callback) => {
    const sql = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;

    connection.query(sql, [username, email, password], (err, results) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, results);
        }
    });
};

// Fungsi untuk mencari pengguna berdasarkan email
const findUserByEmail = (email, callback) => {
    const sql = `SELECT * FROM users WHERE email = ?`;

    connection.query(sql, [email], (err, results) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, results[0]); // Mengembalikan data pengguna pertama yang ditemukan
        }
    });
};

// Fungsi untuk menemukan pengguna berdasarkan ID
const findUserById = (id, callback) => {
    const sql = `SELECT * FROM users WHERE id = ?`;

    connection.query(sql, [id], (err, results) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, results[0]);
        }
    });
};

module.exports = db;