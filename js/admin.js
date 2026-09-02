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

      /* juste sous le plat : ses choix (Poulet / Boeuf...) */
      bloc.appendChild(editeurDeChoix(iCat, iPlat));
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
   4 bis. LES CHOIX D'UN PLAT  (les "sous-options")

   Un plat peut poser une ou plusieurs questions au client :
   "Garniture : Poulet ou Jambon", "Sauce : Ketchup ou Mayonnaise".
   Chaque question est un groupe, chaque reponse une option.

   Une option peut couter un supplement (0 la plupart du temps) :
   il s'ajoute au prix du plat au moment de la commande.
   ------------------------------------------------------------ */
function editeurDeChoix(iCat, iPlat){
  const plat = brouillon[iCat].plats[iPlat];
  const zone = document.createElement("div");
  zone.className = "choix-edit";

  (plat.choix || []).forEach(function(groupe, iGroupe){

    const blocGroupe = document.createElement("div");
    blocGroupe.className = "groupe-edit";

    /* --- l'entete : le nom de la question --- */
    const entete = document.createElement("div");
    entete.className = "groupe-entete";

    const nomGroupe = document.createElement("input");
    nomGroupe.type = "text";
    nomGroupe.value = groupe.nom || "";
    nomGroupe.placeholder = "Nom du choix : Garniture, Sauce, Viande...";
    nomGroupe.oninput = function(){ groupe.nom = this.value; };

    const supGroupe = document.createElement("button");
    supGroupe.className = "sup-btn";
    supGroupe.style.padding = "8px 12px";
    supGroupe.textContent = "Supprimer ce choix";
    supGroupe.onclick = function(){
      plat.choix.splice(iGroupe, 1);
      if (plat.choix.length === 0) delete plat.choix;
      afficherFormulaireMenu();
    };

    entete.appendChild(nomGroupe);
    entete.appendChild(supGroupe);
    blocGroupe.appendChild(entete);

    /* --- les reponses possibles --- */
    if (groupe.options && groupe.options.length) {
      const titres = document.createElement("div");
      titres.className = "entetes-choix";
      titres.innerHTML = "<span>Option</span><span>Supplement</span><span></span>";
      blocGroupe.appendChild(titres);
    }

    (groupe.options || []).forEach(function(option, iOption){
      const ligneOption = document.createElement("div");
      ligneOption.className = "option-edit";

      const nomOption = document.createElement("input");
      nomOption.type = "text";
      nomOption.value = option.nom || "";
      nomOption.placeholder = "Poulet";
      nomOption.oninput = function(){ option.nom = this.value; };

      const supplement = document.createElement("input");
      supplement.type = "number"; supplement.step = "500"; supplement.min = "0";
      supplement.value = option.supplement || 0;
      supplement.placeholder = "0";
      supplement.title = "Supplement de prix, 0 si l'option ne coute rien de plus";
      supplement.oninput = function(){
        const valeur = parseFloat(this.value) || 0;
        if (valeur === 0) delete option.supplement;
        else option.supplement = valeur;
      };

      const supOption = document.createElement("button");
      supOption.className = "sup-btn";
      supOption.innerHTML = "&#10005;";
      supOption.title = "Supprimer cette option";
      supOption.onclick = function(){
        groupe.options.splice(iOption, 1);
        afficherFormulaireMenu();
      };

      ligneOption.appendChild(nomOption);
      ligneOption.appendChild(supplement);
      ligneOption.appendChild(supOption);
      blocGroupe.appendChild(ligneOption);
    });

    /* Un groupe sans option ne peut recevoir aucune reponse : le
       site l'ignore. On le dit ici plutot que de laisser croire
       que le plat est pret. */
    const nommees = (groupe.options || []).filter(function(o){
      return o.nom && o.nom.trim() !== "";
    });
    if (nommees.length === 0) {
      const note = document.createElement("p");
      note.className = "note-choix";
      note.textContent = "Ce choix n'a encore aucune option nommee : le site ne l'affichera pas.";
      blocGroupe.appendChild(note);
    }

    const ajoutOption = document.createElement("button");
    ajoutOption.className = "lien-choix";
    ajoutOption.textContent = "+ Ajouter une option";
    ajoutOption.onclick = function(){
      groupe.options = groupe.options || [];
      groupe.options.push({ nom: "" });
      afficherFormulaireMenu();
    };
    blocGroupe.appendChild(ajoutOption);

    zone.appendChild(blocGroupe);
  });

  /* --- ajouter une question a ce plat --- */
  const ajoutGroupe = document.createElement("button");
  ajoutGroupe.className = "lien-choix fort";
  ajoutGroupe.textContent = "+ Ajouter un choix a ce plat";
  ajoutGroupe.onclick = function(){
    plat.choix = plat.choix || [];
    plat.choix.push({ nom: "Choix", options: [ { nom: "" }, { nom: "" } ] });
    afficherFormulaireMenu();
  };
  zone.appendChild(ajoutGroupe);

  return zone;
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
