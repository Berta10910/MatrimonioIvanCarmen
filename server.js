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
const ExcelJS = require('exceljs');

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
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

app.get('/export-excel', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM rsvps ORDER BY created_at DESC");
    const rsvps = result.rows;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invitati');

    // Colonne
    worksheet.columns = [
      { header: 'Nome', key: 'nome', width: 25 },
      { header: 'Presenza', key: 'presenza', width: 15 },
      { header: 'Numero Persone', key: 'partecipanti_num', width: 18 },
      { header: 'Partecipanti', key: 'partecipanti_nomi', width: 30 },
      { header: 'Allergie', key: 'allergie', width: 25 },
      { header: 'Bambini', key: 'bambini_eta', width: 20 },
      { header: 'Messaggio', key: 'messaggio', width: 40 },
      { header: 'Data', key: 'created_at', width: 25 }
    ];

    // Dati
    rsvps.forEach(r => {
      worksheet.addRow({
        ...r,
        presenza: r.presenza === 'si' ? 'SÌ' : 'NO'
      });
    });

    // Header bold
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=invitati.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Errore export:", err);
    res.status(500).send("Errore export");
  }
});

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

    req.session.destroy(() => {
  res.send('<script>alert("Grazie! Conferma inviata."); window.location.href="/login";</script>');
  });
  } catch (err) {
    console.error("Errore DB:", err);
    res.status(500).send("Errore database");
  }
})

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
