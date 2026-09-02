/* ============================================================
   LIAISON AVEC FIREBASE  --  Restaurant KEI
   ------------------------------------------------------------
   Ce fichier est le seul a parler a Firebase.
   Il sert a deux pages :
   - index.html   : connexion du client, envoi des commandes,
                    suivi du statut, profil personnel
   - cuisine.html : connexion du chef, lecture des commandes

   TOUS les comptes, clients comme chef, sont geres par Firebase
   Authentication. C'est Google qui verifie les mots de passe,
   sur ses propres serveurs : c'est ce qui rend la protection
   reelle, contrairement a une verification faite dans le
   navigateur.

   Ce qui distingue le chef d'un client : son identifiant unique
   (UID) est ecrit dans les regles de securite de Firebase. Lui
   seul a le droit de lire la liste des commandes.
   ============================================================ */

/* Les deux etats possibles d'une commande */
const STATUTS = {
  nouvelle : "A traiter",
  vue      : "Vue par la cuisine"
};

let baseDeDonnees = null;
let firebasePret  = false;

/* ------------------------------------------------------------
   DEMARRAGE
   ------------------------------------------------------------ */
function demarrerFirebase(){
  if (firebasePret) return true;

  if (typeof FIREBASE_ACTIF === "undefined" || !FIREBASE_ACTIF) return false;
  if (typeof firebase === "undefined") {
    console.warn("Les bibliotheques Firebase ne sont pas chargees.");
    return false;
  }
  if (FIREBASE_CONFIG.apiKey === "A_REMPLIR") {
    console.warn("firebase-config.js n'est pas rempli.");
    return false;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    baseDeDonnees = firebase.database();
    firebasePret  = true;
    return true;
  } catch (e) {
    console.warn("Firebase n'a pas demarre :", e.message);
    return false;
  }
}

/* ============================================================
   LES COMPTES
   ------------------------------------------------------------
   Un client tape un identifiant court ("yin"). Le site y ajoute
   le domaine des comptes ("@kei.mg") pour obtenir l'adresse
   attendue par Firebase. Personne n'a donc a taper une adresse
   entiere.
   ============================================================ */
function adresseDuCompte(identifiant){
  const id = String(identifiant).trim().toLowerCase();
  if (id.indexOf("@") !== -1) return id;      /* deja une adresse complete */
  return id + "@" + (CONFIG.domaineComptes || "kei.mg");
}

/* Le nom court a afficher, a partir de l'adresse */
function identifiantCourt(adresse){
  return String(adresse || "").split("@")[0];
}

/* Traduit les codes d'erreur de Firebase en francais */
function messageErreurAuth(code){
  switch (code) {
    case "auth/invalid-email"          : return "Identifiant invalide.";
    case "auth/user-disabled"          : return "Ce compte a ete desactive.";
    case "auth/user-not-found"         :
    case "auth/wrong-password"         :
    case "auth/invalid-credential"     : return "Identifiant ou mot de passe incorrect.";
    case "auth/too-many-requests"      : return "Trop d'essais. Reessayez dans quelques minutes.";
    case "auth/network-request-failed" : return "Pas de connexion internet.";
    case "auth/weak-password"          : return "Mot de passe trop court (6 caracteres minimum).";
    case "auth/requires-recent-login"  : return "Reconnectez-vous avant de changer votre mot de passe.";
    default                            : return "Connexion impossible.";
  }
}

function connecterCompte(identifiant, motDePasse){
  if (!demarrerFirebase()) {
    return Promise.resolve({ ok:false, erreur:"Le site n'est pas relie a Firebase." });
  }
  return firebase.auth()
    .signInWithEmailAndPassword(adresseDuCompte(identifiant), motDePasse)
    .then(function(){ return { ok:true }; })
    .catch(function(e){ return { ok:false, erreur: messageErreurAuth(e.code) }; });
}

function deconnecterCompte(){
  if (!demarrerFirebase()) return Promise.resolve();
  return firebase.auth().signOut();
}

/* Previent a chaque changement d'etat de la connexion */
function surConnexion(rappel){
  if (!demarrerFirebase()) { rappel(null); return; }
  firebase.auth().onAuthStateChanged(rappel);
}

function utilisateurActuel(){
  if (!demarrerFirebase()) return null;
  return firebase.auth().currentUser;
}

/* ------------------------------------------------------------
   Changer son mot de passe.
   On se reconnecte d'abord avec l'ancien : Firebase l'exige si
   la connexion date un peu, et ca evite qu'un telephone laisse
   ouvert permette de changer le mot de passe sans le connaitre.
   ------------------------------------------------------------ */
function changerMotDePasse(ancien, nouveau){
  const u = utilisateurActuel();
  if (!u) return Promise.resolve({ ok:false, erreur:"Vous n'etes pas connectee." });
  if (String(nouveau).length < 6) {
    return Promise.resolve({ ok:false, erreur:"Le nouveau mot de passe doit faire 6 caracteres minimum." });
  }

  const preuve = firebase.auth.EmailAuthProvider.credential(u.email, ancien);

  return u.reauthenticateWithCredential(preuve)
    .then(function(){ return u.updatePassword(nouveau); })
    .then(function(){ return { ok:true }; })
    .catch(function(e){
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        return { ok:false, erreur:"Mot de passe actuel incorrect." };
      }
      return { ok:false, erreur: messageErreurAuth(e.code) };
    });
}

/* ============================================================
   LE ROLE
   ------------------------------------------------------------
   Firebase Authentication dit QUI vous etes. Il ne dit pas ce
   que vous avez le droit de faire. C'est la table /roles qui
   s'en charge :

       roles/{uid} = "chef"    -> ouvre l'ecran cuisine
       roles/{uid} = "admin"   -> ouvre l'espace restaurant
       pas d'entree            -> client ordinaire

   Chacun ne peut lire que SON role, et personne ne peut ecrire
   dans cette table depuis le site : elle se remplit uniquement
   depuis la console Firebase.
   ============================================================ */
function lireMonRole(){
  const u = utilisateurActuel();
  if (!u) return Promise.resolve(null);

  return baseDeDonnees.ref("roles/" + u.uid).once("value")
    .then(function(i){ return i.val() || "client"; })
    .catch(function(){ return "client"; });
}

/* ------------------------------------------------------------
   Un compte = un role = une seule page.

   Les comptes sont separes selon leur type : un compte chef ne
   sert qu'a la cuisine, un compte admin qu'a la carte, un compte
   client qu'a commander. Cette fonction est le seul endroit qui
   decide, et les quatre pages s'y referent : impossible qu'elles
   se contredisent.
   ------------------------------------------------------------ */
function pageDuRole(role){
  if (role === "chef")  return "cuisine.html";
  if (role === "admin") return "admin.html";
  return "index.html";          /* pas de role connu : compte client */
}

/* ============================================================
   LE PROFIL
   /profils/{uid} = { nom, telephone, adresse }
   Les regles n'autorisent chacun qu'a lire et ecrire le sien.
   ============================================================ */
function lireProfilEnLigne(){
  const u = utilisateurActuel();
  if (!u) return Promise.resolve(null);

  return baseDeDonnees.ref("profils/" + u.uid).once("value")
    .then(function(i){ return i.val() || {}; })
    .catch(function(e){ console.warn("Profil illisible :", e.message); return {}; });
}

function ecrireProfilEnLigne(profil){
  const u = utilisateurActuel();
  if (!u) return Promise.resolve(false);

  return baseDeDonnees.ref("profils/" + u.uid).update({
    nom       : profil.nom || "",
    telephone : profil.telephone || "",
    adresse   : profil.adresse || ""
  }).then(function(){ return true; })
    .catch(function(e){ console.warn("Profil non enregistre :", e.message); return false; });
}

/* ============================================================
   COTE CLIENT : ENVOYER ET SUIVRE
   ============================================================ */
function envoyerCommandeEnLigne(commande){
  if (!demarrerFirebase()) {
    return Promise.resolve({ ok:false, raison:"firebase-inactif" });
  }
  const u = utilisateurActuel();
  if (!u) return Promise.resolve({ ok:false, raison:"non-connecte" });

  const nouvelle = baseDeDonnees.ref("commandes").push();

  return nouvelle.set({
    uid       : u.uid,                /* exige par les regles : c'est le proprietaire */
    numero    : commande.numero,
    date      : commande.date,
    client    : commande.client,
    compte    : commande.compte || "",
    telephone : commande.telephone,
    mode      : commande.mode,
    adresse   : commande.adresse || "",
    heure     : commande.heure || "",
    remarque  : commande.remarque || "",
    total     : commande.total,
    message   : commande.message,
    statut    : "nouvelle",
    horodatage: firebase.database.ServerValue.TIMESTAMP
  }).then(function(){
    return { ok:true, id:nouvelle.key };
  }).catch(function(e){
    console.warn("Envoi impossible :", e.message);
    return { ok:false, raison:e.message };
  });
}

function suivreStatut(id, rappel){
  if (!demarrerFirebase() || !id) return null;

  const ref = baseDeDonnees.ref("commandes/" + id + "/statut");
  ref.on("value", function(instantane){
    const statut = instantane.val();
    if (statut) rappel(statut);
  }, function(){ /* commande effacee ou non autorisee : on ignore */ });
  return ref;
}

/* ============================================================
   COTE CUISINE
   Ces fonctions ne repondent qu'au compte chef : les regles
   refusent la lecture de la liste a tous les autres.
   ============================================================ */
function ecouterCommandes(rappelAjout, rappelChangement, rappelRetrait, rappelErreur){
  if (!demarrerFirebase()) return;

  const ref = baseDeDonnees.ref("commandes").limitToLast(60);

  ref.on("child_added",   function(i){ rappelAjout(i.key, i.val()); },
         function(e){ if (rappelErreur) rappelErreur(e); });
  ref.on("child_changed", function(i){ rappelChangement(i.key, i.val()); });
  ref.on("child_removed", function(i){ if (rappelRetrait) rappelRetrait(i.key); });
}

function changerStatut(id, statut){
  if (!demarrerFirebase()) return Promise.resolve(false);
  return baseDeDonnees.ref("commandes/" + id + "/statut")
    .set(statut)
    .then(function(){ return true; })
    .catch(function(e){ console.warn(e.message); return false; });
}

function supprimerCommandeEnLigne(id){
  if (!demarrerFirebase()) return Promise.resolve(false);
  return baseDeDonnees.ref("commandes/" + id)
    .remove()
    .then(function(){ return true; })
    .catch(function(e){ console.warn("Suppression impossible :", e.message); return false; });
}
