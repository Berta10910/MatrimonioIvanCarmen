require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const fs = require('fs')

const app = express()

const PORT = process.env.PORT || 3001
const PASSWORD = process.env.PASSWORD || 'IvanCarmen2026'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminCarmen'
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret'

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')))
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' }
  })
)

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next()
  return res.redirect('/login')
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next()
  return res.redirect('/')
}

app.get('/', requireAuth, (req, res) => {
  res.render('index', { 
    couple: 'Carmen & Ivan',
    isAdmin: req.session.isAdmin || false
  })
})

app.get('/login', (req, res) => {
  // Rimosso il redirect automatico se già autenticato per permettere il cambio utente/admin
  res.render('login', { error: null, couple: 'Carmen & Ivan' })
})

app.post('/login', (req, res) => {
  const password = (req.body.password || '').trim()

  req.session.regenerate((err) => {
    if (err) {
      console.error('Errore sessione:', err)
      return res.redirect('/login')
    }

    if (password === ADMIN_PASSWORD) {
      req.session.authenticated = true
      req.session.isAdmin = true
      console.log('Login ADMIN OK')
      return res.redirect('/')
    }

    if (password === PASSWORD) {
      req.session.authenticated = true
      req.session.isAdmin = false
      console.log('Login USER OK')
      return res.redirect('/')
    }

    res.status(401).render('login', { 
      error: 'Password non corretta', 
      couple: 'Carmen & Ivan' 
    })
  })
})

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid')
    res.redirect('/login')
  })
})

app.get('/invitati', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM rsvps 
      ORDER BY created_at DESC
    `);

    res.render('invitati', { 
      rsvps: result.rows, 
      couple: 'Carmen & Ivan' 
    });

  } catch (err) {
    console.error("Errore DB:", err);
    res.render('invitati', { 
      rsvps: [], 
      couple: 'Carmen & Ivan' 
    });
  }
});

app.post('/rsvp', requireAuth, async (req, res) => {
  const { 
    nome, 
    presenza, 
    partecipanti_num, 
    partecipanti_nomi, 
    allergie, 
    bambini_eta, 
    messaggio 
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO rsvps 
      (nome, presenza, partecipanti_num, partecipanti_nomi, allergie, bambini_eta, messaggio)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [nome, presenza, partecipanti_num, partecipanti_nomi, allergie, bambini_eta, messaggio]
    );

    res.send('<script>alert("Grazie! Conferma inviata."); window.location.href="/";</script>');
  } catch (err) {
    console.error("Errore DB:", err);
    res.status(500).send("Errore database");
  }
})

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});