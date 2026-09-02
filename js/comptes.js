/* ============================================================
   LE COMPTE DU CLIENT  --  Restaurant KEI
   ------------------------------------------------------------
   Connexion, deconnexion, et page "Mes informations".

   Les comptes sont geres par Firebase Authentication : ils ne
   sont plus ecrits dans un fichier du site. C'est Google qui
   verifie le mot de passe, donc la protection est reelle, et le
   client peut changer ses informations lui-meme, sur n'importe
   quel appareil.

   Il n'y a pas d'inscription : les comptes sont crees par le
   restaurant dans la console Firebase.
   ============================================================ */

/* Le profil du client connecte, garde en memoire pendant la
   visite pour ne pas le redemander a chaque commande. */
let profilClient = null;

function compteActuel(){
  const u = utilisateurActuel();
  if (!u) return null;

  const p = profilClient || {};
  return {
    identifiant : identifiantCourt(u.email),
    nom         : p.nom || "",
    telephone   : p.telephone || "",
    adresse     : p.adresse || ""
  };
}

/* Enregistre le profil : en memoire ET dans Firebase */
function majProfil(champs){
  profilClient = Object.assign(profilClient || {}, champs);
  return ecrireProfilEnLigne(profilClient);
}

/* ============================================================
   MES INFORMATIONS
   ============================================================ */
function ouvrirMesInfos(){
  const compte = compteActuel();
  if (!compte) return;

  document.getElementById("mi-identifiant").textContent = compte.identifiant;
  document.getElementById("mi-nom").value       = compte.nom;
  document.getElementById("mi-telephone").value = compte.telephone;
  document.getElementById("mi-adresse").value   = compte.adresse;

  document.getElementById("mi-ancien").value = "";
  document.getElementById("mi-nouveau").value = "";
  document.getElementById("mi-nouveau2").value = "";

  message("mi-message-profil", "");
  message("mi-message-mdp", "");

  document.getElementById("voile-infos").classList.add("ouvert");
  document.body.style.overflow = "hidden";
}

function fermerMesInfos(){
  document.getElementById("voile-infos").classList.remove("ouvert");
  document.body.style.overflow = "";
}

/* Affiche un message sous un formulaire, en vert ou en rouge */
function message(id, texte, succes){
  const zone = document.getElementById(id);
  zone.textContent = texte;
  zone.className = "message-info" + (texte ? (succes ? " succes" : " erreur") : "");
}

async function enregistrerMesInfos(){
  const nom = document.getElementById("mi-nom").value.trim();
  if (nom === "") { message("mi-message-profil", "Indiquez votre nom."); return; }

  const bouton = document.getElementById("btn-enregistrer-infos");
  bouton.disabled = true;

  const ok = await majProfil({
    nom       : nom,
    telephone : document.getElementById("mi-telephone").value.trim(),
    adresse   : document.getElementById("mi-adresse").value.trim()
  });

  bouton.disabled = false;

  if (ok) {
    message("mi-message-profil", "Informations enregistrees.", true);
    if (typeof remplirClient === "function") remplirClient();
  } else {
    message("mi-message-profil", "Enregistrement impossible. Verifiez votre connexion.");
  }
}

async function changerMonMotDePasse(){
  const ancien   = document.getElementById("mi-ancien").value;
  const nouveau  = document.getElementById("mi-nouveau").value;
  const nouveau2 = document.getElementById("mi-nouveau2").value;

  if (ancien === "")            { message("mi-message-mdp", "Tapez votre mot de passe actuel."); return; }
  if (nouveau !== nouveau2)     { message("mi-message-mdp", "Les deux nouveaux mots de passe ne sont pas identiques."); return; }

  const bouton = document.getElementById("btn-changer-mdp");
  bouton.disabled = true;
  const r = await changerMotDePasse(ancien, nouveau);
  bouton.disabled = false;

  if (r.ok) {
    message("mi-message-mdp", "Mot de passe change. Il vaut sur tous vos appareils.", true);
    document.getElementById("mi-ancien").value   = "";
    document.getElementById("mi-nouveau").value  = "";
    document.getElementById("mi-nouveau2").value = "";
  } else {
    message("mi-message-mdp", r.erreur);
  }
}

/* ============================================================
   DEMARRAGE
   ============================================================ */
document.addEventListener("DOMContentLoaded", function(){

  /* Pas de Firebase, pas de site : on renvoie a la page de connexion,
     qui saura expliquer ce qui manque. */
  if (!demarrerFirebase()) { location.href = "connexion.html"; return; }

  /* Personne de connecte ? On renvoie a la page de connexion.
     Sinon on charge son profil et on ouvre le site. */
  surConnexion(async function(utilisateur){
    if (!utilisateur) { location.href = "connexion.html"; return; }

    profilClient = await lireProfilEnLigne();

    document.getElementById("barre-compte").hidden = false;
    document.getElementById("compte-nom").textContent = identifiantCourt(utilisateur.email);
    document.body.classList.remove("verrouille");

    if (typeof remplirClient === "function")     remplirClient();
    if (typeof afficherHistorique === "function") afficherHistorique();
  });

  /* --- mes informations --- */
  document.getElementById("btn-mes-infos").onclick         = ouvrirMesInfos;
  document.getElementById("btn-fermer-infos").onclick      = fermerMesInfos;
  document.getElementById("btn-enregistrer-infos").onclick = enregistrerMesInfos;
  document.getElementById("btn-changer-mdp").onclick       = changerMonMotDePasse;

  document.getElementById("voile-infos").onclick = function(e){
    if (e.target.id === "voile-infos") fermerMesInfos();
  };

  document.getElementById("btn-deconnexion-client").onclick = function(){
    deconnecterCompte().then(function(){ location.href = "connexion.html"; });
  };
});
