/* ============================================================
   ESPACE RESTAURANT  --  connexion + modification du menu
   ------------------------------------------------------------
   IMPORTANT (a expliquer dans le rapport de projet) :
   la verification du mot de passe se fait dans le NAVIGATEUR.
   C'est suffisant pour empecher un client de tomber par hasard
   sur cette page, mais ce n'est PAS une vraie securite :
   quelqu'un qui lit le code source peut la contourner.
   Une vraie protection demanderait un serveur.
   ============================================================ */

/* ------------------------------------------------------------
   1. ACCES
   La connexion se fait sur connexion.html. Ici on verifie
   seulement que le compte connecte a bien le role "admin".
   ------------------------------------------------------------ */
let adminConnecte = null;

function seDeconnecter(){
  deconnecterCompte().then(function(){ location.href = "connexion.html"; });
}

function afficherAdmin(){
  document.getElementById("ecran-attente").hidden = true;
  document.getElementById("ecran-admin").hidden   = false;

  document.getElementById("admin-connecte").textContent =
    adminConnecte ? (adminConnecte.identifiant + " - " + adminConnecte.role) : "";

  /* on charge le menu a modifier AVANT de l'afficher : sans cette
     ligne, brouillon reste vide et l'affichage plante */
  brouillon = chargerBrouillon();
  afficherFormulaireMenu();
}

/* ------------------------------------------------------------
   3. LE MENU EN COURS D'EDITION
   ------------------------------------------------------------ */
let brouillon;

function chargerBrouillon(){
  const sauvegarde = localStorage.getItem("kei_menu");
  if (sauvegarde) {
    try { return JSON.parse(sauvegarde); } catch (e) {}
  }
  /* copie profonde du menu d'origine, pour ne pas le modifier par erreur */
  return JSON.parse(JSON.stringify(MENU));
}

/* Fabrique un identifiant unique pour un nouveau plat */
function nouvelId(){
  return "x" + Date.now().toString(36) + Math.floor(Math.random() * 1000);
}

/* ------------------------------------------------------------
   4. AFFICHAGE DU FORMULAIRE
   ------------------------------------------------------------ */
function afficherFormulaireMenu(){
  const zone = document.getElementById("zone-categories");
  zone.innerHTML = "";

  brouillon.forEach(function(categorie, iCat){

    const bloc = document.createElement("div");
    bloc.className = "bloc-cat";

    /* --- entete : nom de la categorie + bouton supprimer --- */
    const entete = document.createElement("div");
    entete.className = "entete";

    const champNom = document.createElement("input");
    champNom.type  = "text";
    champNom.value = categorie.categorie;
    champNom.oninput = function(){ brouillon[iCat].categorie = this.value; };

    const supCat = document.createElement("button");
    supCat.className = "sup-btn";
    supCat.style.padding = "9px 14px";
    supCat.textContent = "Supprimer";
    supCat.onclick = function(){
      if (confirm("Supprimer la categorie \"" + brouillon[iCat].categorie + "\" et tous ses plats ?")) {
        brouillon.splice(iCat, 1);
        afficherFormulaireMenu();
      }
    };

    entete.appendChild(champNom);
    entete.appendChild(supCat);
    bloc.appendChild(entete);

    /* --- titres des colonnes --- */
    const titres = document.createElement("div");
    titres.className = "entetes-colonnes";
    titres.innerHTML = "<span>Nom du plat</span><span>Description</span><span>Prix</span><span></span>";
    bloc.appendChild(titres);

    /* --- une ligne par plat --- */
    categorie.plats.forEach(function(plat, iPlat){
      const ligne = document.createElement("div");
      ligne.className = "ligne-edit";

      const cNom = document.createElement("input");
      cNom.type = "text"; cNom.value = plat.nom;
      cNom.oninput = function(){ brouillon[iCat].plats[iPlat].nom = this.value; };

      const cDesc = document.createElement("input");
      cDesc.type = "text"; cDesc.value = plat.desc || "";
      cDesc.oninput = function(){ brouillon[iCat].plats[iPlat].desc = this.value; };

      const cPrix = document.createElement("input");
      cPrix.type = "number"; cPrix.step = "500"; cPrix.min = "0"; cPrix.value = plat.prix;   /* pas de 500 Ar */
      cPrix.oninput = function(){
        brouillon[iCat].plats[iPlat].prix = parseFloat(this.value) || 0;
      };

      const sup = document.createElement("button");
      sup.className = "sup-btn";
      sup.innerHTML = "&#10005;";
      sup.title = "Supprimer ce plat";
      sup.onclick = function(){
        brouillon[iCat].plats.splice(iPlat, 1);
        afficherFormulaireMenu();
      };

      ligne.appendChild(cNom); ligne.appendChild(cDesc);
      ligne.appendChild(cPrix); ligne.appendChild(sup);
      bloc.appendChild(ligne);
    });

    /* --- bouton "ajouter un plat" --- */
    const ajout = document.createElement("button");
    ajout.className = "btn petit secondaire";
    ajout.style.marginTop = "8px";
    ajout.textContent = "+ Ajouter un plat";
    ajout.onclick = function(){
      brouillon[iCat].plats.push({ id: nouvelId(), nom: "Nouveau plat", desc: "", prix: 0 });
      afficherFormulaireMenu();
    };
    bloc.appendChild(ajout);

    zone.appendChild(bloc);
  });
}

/* ------------------------------------------------------------
   5. ENREGISTRER / TELECHARGER / REINITIALISER
   ------------------------------------------------------------ */
function enregistrer(){
  localStorage.setItem("kei_menu", JSON.stringify(brouillon));
  alert("Menu enregistre.\n\nIl est visible sur ce navigateur.\nPour le mettre en ligne pour tout le monde,\ncliquez sur \"Telecharger menu.js\".");
}

function telechargerMenuJs(){
  const contenu =
    "/* Menu du restaurant " + CONFIG.nomRestaurant + "\n" +
    "   Genere depuis l'espace restaurant le " + new Date().toLocaleString("fr-FR") + "\n" +
    "   Remplacez le fichier js/menu.js par celui-ci sur GitHub. */\n\n" +
    "const MENU = " + JSON.stringify(brouillon, null, 2) + ";\n";

  const fichier = new Blob([contenu], { type: "text/javascript" });
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(fichier);
  lien.download = "menu.js";
  lien.click();
  URL.revokeObjectURL(lien.href);
}

function reinitialiser(){
  if (confirm("Revenir au menu d'origine ? Vos modifications enregistrees seront perdues.")) {
    localStorage.removeItem("kei_menu");
    brouillon = JSON.parse(JSON.stringify(MENU));
    afficherFormulaireMenu();
  }
}

/* ------------------------------------------------------------
   6. DEMARRAGE
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", function(){

  if (!demarrerFirebase()) {
    document.getElementById("message-attente").textContent =
      "Firebase n'est pas configure. Voir le README, section Firebase.";
    return;
  }

  /* Il faut etre connecte ET avoir le role "admin" */
  surConnexion(async function(utilisateur){
    if (!utilisateur) { location.href = "connexion.html"; return; }

    if (await lireMonRole() !== "admin") {
      document.getElementById("message-attente").textContent =
        "Ce compte n'est pas administrateur.";
      return;
    }

    adminConnecte = {
      identifiant : identifiantCourt(utilisateur.email),
      role        : "Administrateur"
    };
    afficherAdmin();
  });

  document.getElementById("btn-deconnexion").onclick    = seDeconnecter;
  document.getElementById("btn-enregistrer").onclick    = enregistrer;
  document.getElementById("btn-telecharger").onclick    = telechargerMenuJs;
  document.getElementById("btn-reinitialiser").onclick  = reinitialiser;

  document.getElementById("btn-ajout-categorie").onclick = function(){
    brouillon.push({ categorie: "Nouvelle categorie", icone: "", plats: [] });
    afficherFormulaireMenu();
  };

});
