const express = require('express');
const nunjucks = require('nunjucks');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const notifier = require('node-notifier');
const session = require("express-session");


const app = express();

const db = new sqlite3.Database('./db/database.sqlite', (err) => {
  if (err) console.error(err.message);
  else console.log('Connecté à la base SQLite.');
});

nunjucks.configure('views', {
  autoescape: true,
  express: app
});

app.use(
  session({
    secret : "secretkey3476",
    resave : false,
    saveUninitialized : true,
    cookie: { maxAge: 3000000 },
  })
);



// rendre le répertoire public statique (pour les assets)
app.use(express.static('public'))
 
// Chemins
app.get('/', (req, res) => res.render('index.njk', { title: 'Accueil' }));
app.get('/inscription', (req, res) => res.render('inscription.njk', { title: 'Inscription' }));
app.get('/connexion', (req, res) => res.render('connexion.njk', { title: 'Connexion' }));
app.get('/vins', (req, res) => res.render('vins.njk', { title: 'Vins' }));


// Créer un compte
app.get('/formins', (req, res) => {
  if (Number(req.query.password.length) > 5){
    db.all(`SELECT pseudo, mail FROM users WHERE pseudo=? OR mail=?`, [req.query.pseudo, req.query.email], (err, rows) => {
    if (err) throw err;
    if (""==rows && req.query.pseudo!="" && req.query.email!="" && req.query.password!="") { 

      bcrypt.hash(req.query.password, 10, (err, hash) =>{
        if (err){
          notifier.notify({
            title: 'Echec du hash',
            message: 'Echec du hash du mot de passe. Veuillez réessayer de créer un compte et contacter le support si le problème persiste.',
            sound: true,
            wait: true});
          throw err;}
        else{db.run(`INSERT INTO users (pseudo, mail, mdp) VALUES (?, ?,?)`, [req.query.pseudo, req.query.email, hash]);
          notifier.notify({
            title: 'Compté créé',
            message: 'Votre compte a bien été créé. Vous pouvez maintenant vous authentifier.',
            sound: true,
            wait: true});}
      });}

      else {
        notifier.notify({
          title: 'Echec de la création de compte',
          message: "Votre compte n'a pas pu être crée car il existe déjà un compte utilisant ce pseudo ou cet email.",
          sound: true,
          wait: true});
        console.log("Veillez également à remplir tous les champs");}
    });
  }

  else {notifier.notify({
          title: 'Mot de passe trop court',
          message: "Votre compte n'a pas pu être crée car votre mot de passe doit être composé d'au minimum 6 caractères.",
          sound: true,
          wait: true});}
});



// Se connecter
app.get('/formco', (req, res) => {
  db.all(`SELECT mail, mdp FROM users WHERE mail=?`, [req.query.email], (err, rows) => {
    if (""==rows){
      notifier.notify({
        title: 'Pas de compte correspondant',
        message: "Il n'existe aucun compte enregistré avec cet email.",
        sound: true,
        wait: true});}
    
    else{
      bcrypt.compare(req.query.password, rows[0]["mdp"], (err, result) => {
        if (err) {
            console.error('Error comparing passwords:', err);
            notifier.notify({
              title: 'Validation du mot de passe impossible',
              message: "Une erreur est survenue lors de la vérification du mot de passe. Veuillez réessayer et contacter le support si le problème persiste.",
              sound: true,
              wait: true});
            return;}
        if (result) {
        // Passwords match, authentication successful
          req.session.isAuth = true;
          console.log(req.session.id);
          console.log('Mot de passe valide! Utilisateur authentifié.');
          db.run(`UPDATE users SET idsession = ? , expiresession = DATETIME(substring(?, 1, 10), 'unixepoch') WHERE mail = ?`, [req.session.id, req.session.cookie._expires, req.query.email]);
          notifier.notify({
            title: 'Connexion effectuée',
            message: "Vous avez bien été connecté(e) sur votre compte !",
            sound: true,
            wait: true});} 
        
        
        else {
        // Passwords don't match, authentication failed
          console.log('Mot de passe invalide! Authentication échouée.');
          notifier.notify({
            title: 'Mot de passe invalide',
            message: "Connexion impossible, le mot de passe est erroné",
            sound: true,
            wait: true});
      }});
    };
  });
});


// Poster une note et un commentaire
app.get('/vins/:id/formnote', (req, res) => {
  if (req.query.note != ""){
    db.all(`SELECT iduser, idsession, timediff(U.expiresession, CURRENT_TIMESTAMP) AS diff, fvin, expiresession
      FROM users U LEFT JOIN notes N on U.iduser=N.fuser
      WHERE U.idsession=?`, [req.session.id], async (err, rows) => {
        if (err) throw err;
        var r=rows
        console.log(rows);
        console.log(req.session.cookie._expires);
        console.log(req.session.id);
        if (""==rows ||  rows[0]["diff"][0]!="+") {
          notifier.notify({
            title: "Echec de l'envoi de l'avis",
            message: "Votre avis n'a pas pu être envoyé car vous n'êtes pas connecté(e). Veuillez vous reconnecter.",
            sound: true,
            wait: true});
          console.log("Echec de l'envoi de l'avis car non connecté");
    }

      else {
          if (err) throw err;
          console.log(r);
          console.log(r.length);
         async function VerifAbs (currentvalue) {currentvalue["fvin"]!=req.query.id}
          if (await r.every(VerifAbs)) {
            console.log([req.query.note, req.query.comments, req.query.id, r[0]["iduser"]])
                await db.run(`INSERT INTO notes (note, commentaire, fvin, fuser) VALUES (?, ?,?,?)`, [req.query.note, req.query.comments, req.params.id, r[0]["iduser"]]);
                notifier.notify({
                  title: "Avis envoyé",
                  message: "Votre avis a bien été envoyé !",
                  sound: true,
                  wait: true});
                console.log("Avis envoyé");}
          else  {
          notifier.notify({
            title: "Echec de l'envoi de l'avis",
            message: "Votre avis n'a pas pu être envoyé car vous avez déjà soumis un avis concernant ce vin.",
            sound: true,
            wait: true});
          console.log("Echec de l'envoi de l'avis car avis déjà présent");}
      }});}

  else  {
        notifier.notify({
          title: "Echec de l'envoi de l'avis",
          message: "Votre avis n'a pas pu être envoyé car il ne comportait pas de note, veuillez en sélectionner une.",
          sound: true,
          wait: true});
          console.log("Echec de l'envoi de l'avis car pas de note saisie dans le formulaire");}
});



// Afficher vins
app.get('/formvin', (req, res) => {
  db.all(`SELECT idvin, vinlibelle, millenaire, vigneron, AVG(note) AS 'note'
    FROM ((((vins V JOIN vinslibelle VL ON VL.idvinlibelle=V.fvinlibelle)
    JOIN millenaires M ON M.idmillenaire=V.fmillenaire) 
    JOIN vignerons VV ON VV.idvigneron=V.fvigneron)
    LEFT JOIN notes N ON N.fvin=V.idvin)
    GROUP BY V.idvin
    HAVING VL.vinlibelle LIKE ? AND VV.vigneron LIKE ? AND M.millenaire LIKE ?`, ["%"+req.query.libelle+"%", "%"+req.query.vigneron+"%", "%"+req.query.millesime+"%"], (err, rows) => {
      if (err) throw err;
      console.log(rows)
      console.log("%"+req.query.libelle+"%")
      res.render('vinsres.njk', { vins: rows });

   });
 });


// Afficher notes et commentaires pour un vin spécifique

app.get('/vins/:id', (req, res) => {
  db.all(`SELECT idvin, vinlibelle, millenaire, vigneron, note, commentaire, datenote, pseudo
    FROM (((((vins V JOIN vinslibelle VL ON VL.idvinlibelle=V.fvinlibelle)
    JOIN millenaires M ON M.idmillenaire=V.fmillenaire) 
    JOIN vignerons VV ON VV.idvigneron=V.fvigneron)
    LEFT JOIN notes N ON N.fvin=V.idvin)
    LEFT JOIN users U ON U.iduser=N.fuser)
    WHERE V.idvin=?`, [req.params.id], (err, rows) => {

        res.render('vinspe.njk', { notes : rows,  monurl : req.url});
        console.log(rows)

    });
});






app.listen(3000, () => console.log('Serveur démarré sur http://localhost:3000'));


db.run(`CREATE TABLE IF NOT EXISTS users (
  iduser INTEGER PRIMARY KEY AUTOINCREMENT,
  pseudo TEXT UNIQUE,
  mail TEXT UNIQUE,
  mdp TEXT NOT NULL,
  role TEXT DEFAULT use,
  idsession VARCHAR,
  expiresession DATETIME
)`);

db.run(`CREATE TABLE IF NOT EXISTS notes (
  idnote INTEGER PRIMARY KEY AUTOINCREMENT,
  note SMALLINT,
  commentaire TEXT,
  datenote DATETIME DEFAULT CURRENT_TIMESTAMP,
  fvin INT,
  fuser INT
)`);


db.run(`CREATE TABLE IF NOT EXISTS vinslibelle (
  idvinlibelle INTEGER PRIMARY KEY AUTOINCREMENT,
  vinlibelle TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS millenaires (
  idmillenaire INTEGER PRIMARY KEY AUTOINCREMENT,
  millenaire SMALLINT
)`);

db.run(`CREATE TABLE IF NOT EXISTS vignerons (
  idvigneron INTEGER PRIMARY KEY AUTOINCREMENT,
  vigneron TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS vins (
  idvin INTEGER PRIMARY KEY AUTOINCREMENT,
  fvinlibelle INT,
  fmillenaire INT,
  fvigneron INT
)`);

