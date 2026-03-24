require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const fs = require('fs')

const app = express()

const PORT = process.env.PORT || 3001
const PASSWORD = process.env.PASSWORD || 'IvanCarmen2026'
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret'

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
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

app.get('/', requireAuth, (req, res) => {
  res.render('index', { couple: 'Carmen & Ivan' })
})

app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/')
  res.render('login', { error: null, couple: 'Carmen & Ivan' })
})

app.post('/login', (req, res) => {
  const { password } = req.body
  if (password && password === PASSWORD) {
    req.session.authenticated = true
    return res.redirect('/')
  }
  res.status(401).render('login', { error: 'Password non corretta', couple: ' Carmen& Ivan' })
})

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid')
    res.redirect('/login')
  })
})

app.get('/invitati', requireAuth, (req, res) => {
  const dataPath = path.join(__dirname, 'data', 'invitati.json')
  let invitati = []
  try {
    const json = fs.readFileSync(dataPath, 'utf8')
    invitati = JSON.parse(json)
  } catch (e) {}
  res.render('invitati', { invitati, couple: 'Carmen & Ivan' })
})

app.post('/rsvp', requireAuth, (req, res) => {
  const rsvpPath = path.join(__dirname, 'data', 'rsvp.json')
  const { nome, presenza, intolleranze, canzone, messaggio } = req.body
  
  const newRsvp = {
    nome,
    presenza,
    intolleranze,
    canzone,
    messaggio,
    timestamp: new Date().toISOString()
  }

  let rsvps = []
  try {
    if (fs.existsSync(rsvpPath)) {
      const data = fs.readFileSync(rsvpPath, 'utf8')
      rsvps = JSON.parse(data)
    }
  } catch (e) {
    console.error('Errore lettura RSVP:', e)
  }

  rsvps.push(newRsvp)

  try {
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'))
    }
    fs.writeFileSync(rsvpPath, JSON.stringify(rsvps, null, 2))
    res.send('<script>alert("Grazie! La tua conferma è stata inviata."); window.location.href="/";</script>')
  } catch (e) {
    console.error('Errore scrittura RSVP:', e)
    res.status(500).send('Errore nel salvataggio. Riprova più tardi.')
  }
})

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});