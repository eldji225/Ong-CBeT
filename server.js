require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // Reverting back to standard pg pool for Supabase Postgres
const basicAuth = require('express-basic-auth');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup PostgreSQL Connection using Supabase Connection String
// Make sure you copy the "Connection String" (URI) from Supabase > Settings > Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables on server start (standard Postgres queries for Supabase)
const initDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            nom TEXT,
            prenom TEXT,
            email TEXT,
            sujet TEXT,
            message TEXT,
            date TEXT
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS sentinelles (
            id SERIAL PRIMARY KEY,
            prenom TEXT,
            nom TEXT,
            email TEXT,
            telephone TEXT,
            date_signature TEXT
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS recoltes (
            id SERIAL PRIMARY KEY,
            sentinelle_id INTEGER,
            plante TEXT,
            date_heure TEXT,
            latitude REAL,
            longitude REAL,
            photo_url TEXT,
            etat_plante TEXT,
            commentaire TEXT
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS lab_tests (
            id SERIAL PRIMARY KEY,
            lot_id TEXT,
            ph_value REAL,
            jour_maceration INTEGER,
            temperature REAL,
            date_test TEXT,
            technicien TEXT
        )`);
        console.log("Connecté à la base de données Supabase Postgres !");
    } catch (err) {
        console.error("Erreur d'initialisation de la DB Supabase :", err.message);
    }
};

initDB();

// Basic Authentication configuration for Laboratory
const labAuth = basicAuth({
    users: { 'admin': process.env.LAB_PASSWORD || 'secret123' },
    challenge: true,
    realm: 'Laboratoire Central CBeT'
});

// APIs for Contact Form
app.post('/api/contact', async (req, res) => {
    const { nom, prenom, email, sujet, message } = req.body;
    const date = new Date().toISOString();
    try {
        const result = await pool.query(
            `INSERT INTO contacts (nom, prenom, email, sujet, message, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [nom, prenom, email, sujet, message, date]
        );
        res.json({ id: result.rows[0].id, message: "Message envoyé avec succès" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// APIs for Sentinelles Engagement
app.post('/api/sentinelles', async (req, res) => {
    const { prenom, nom, email, telephone } = req.body;
    const date_signature = new Date().toISOString();
    try {
        const result = await pool.query(
            `INSERT INTO sentinelles (prenom, nom, email, telephone, date_signature) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [prenom, nom, email, telephone, date_signature]
        );
        res.json({ id: result.rows[0].id, message: "Engagement validé." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// The Lab dashboard fetches sentinelles, so it needs auth
app.get('/api/sentinelles', labAuth, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM sentinelles ORDER BY id DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// APIs for Recoltes
app.post('/api/recoltes', async (req, res) => {
    const { sentinelle_id, plante, date_heure, latitude, longitude, photo_url, etat_plante, commentaire } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO recoltes (sentinelle_id, plante, date_heure, latitude, longitude, photo_url, etat_plante, commentaire) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [sentinelle_id, plante, date_heure, latitude, longitude, photo_url, etat_plante, commentaire]
        );
        res.json({ id: result.rows[0].id, message: "Récolte enregistrée avec succès." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard visualizes recoltes, protect it
app.get('/api/recoltes', labAuth, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM recoltes ORDER BY id DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// APIs for Lab Tests
app.post('/api/lab-tests', labAuth, async (req, res) => {
    const { lot_id, ph_value, jour_maceration, temperature, technicien } = req.body;
    const date_test = new Date().toISOString();
    try {
        const result = await pool.query(
            `INSERT INTO lab_tests (lot_id, ph_value, jour_maceration, temperature, date_test, technicien) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [lot_id, ph_value, jour_maceration, temperature, date_test, technicien]
        );
        res.json({ id: result.rows[0].id, message: "Test de laboratoire enregistré avec succès." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/lab-tests', labAuth, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM lab_tests ORDER BY date_test ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend paths explicitly because of the Vercel rewrite 

app.get('/dashboard.html', labAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Other files don't need authentication
app.use(express.static(__dirname));

// Default to index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Export the app for Vercel
module.exports = app;

// Listen only if not in Vercel Serverless mode
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Serveur demarré sur http://localhost:${port}`);
    });
}
