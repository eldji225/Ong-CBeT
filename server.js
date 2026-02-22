require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sql } = require('@vercel/postgres');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database tables on server start
const initDB = async () => {
    try {
        await sql`CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            nom TEXT,
            prenom TEXT,
            email TEXT,
            sujet TEXT,
            message TEXT,
            date TEXT
        )`;

        await sql`CREATE TABLE IF NOT EXISTS sentinelles (
            id SERIAL PRIMARY KEY,
            prenom TEXT,
            nom TEXT,
            email TEXT,
            telephone TEXT,
            date_signature TEXT
        )`;

        console.log("Connecté à la base de données PostgreSQL !");
    } catch (err) {
        console.error("Erreur d'initialisation de la DB :", err.message);
    }
};

initDB();

// API: Contact Form
app.post('/api/contact', async (req, res) => {
    const { nom, prenom, email, sujet, message } = req.body;
    const date = new Date().toISOString();
    try {
        const result = await sql`INSERT INTO contacts (nom, prenom, email, sujet, message, date) VALUES (${nom}, ${prenom}, ${email}, ${sujet}, ${message}, ${date}) RETURNING id`;
        res.json({ id: result.rows[0].id, message: "Message envoyé avec succès" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Charte Sentinelle - Engagement
app.post('/api/sentinelles', async (req, res) => {
    const { prenom, nom, email, telephone } = req.body;
    const date_signature = new Date().toISOString();
    try {
        const result = await sql`INSERT INTO sentinelles (prenom, nom, email, telephone, date_signature) VALUES (${prenom}, ${nom}, ${email}, ${telephone}, ${date_signature}) RETURNING id`;
        res.json({ id: result.rows[0].id, message: "Engagement validé. Bienvenue, Sentinelle." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve static files (index.html, assets, etc.)
app.use(express.static(__dirname));

// Default to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Export the app for Vercel Serverless
module.exports = app;

// Listen locally if not in Vercel
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Serveur démarré sur http://localhost:${port}`);
    });
}
