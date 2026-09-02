/* ============================================================
   LOGIQUE DU SITE  --  Restaurant KEI
   1. On affiche le menu
   2. Le client ajoute des plats dans un "panier"
   3. On envoie la commande a la cuisine (Firebase)
   4. On suit son statut en direct
   ============================================================ */

/* ------------------------------------------------------------
   ETAPE 0 : quel menu utiliser ?
   Si le restaurant a modifie le menu depuis la page admin,
   la version modifiee est enregistree dans le navigateur
   (localStorage). Sinon on prend celui du fichier menu.js.
   ------------------------------------------------------------ */
function chargerMenu(){
  const sauvegarde = localStorage.getItem("kei_menu");
  if (sauvegarde) {
    try { return JSON.parse(sauvegarde); }
    catch (e) { console.warn("Menu sauvegarde illisible, on reprend le menu par defaut."); }
  }
  return MENU;
}

const menuActuel = chargerMenu();

/* Le panier : un objet { identifiantDuPlat : quantite } */
const panier = {};

/* Les precisions demandees pour chaque plat :
   { identifiantDuPlat : "sans oignon" } */
const precisions = {};

/* Les demandes qui ne figurent pas au menu :
   une liste d'objets { texte, quantite, precision }.
   Leur prix n'est pas connu : c'est la cuisine qui le confirmera. */
const horsMenu = [];

/* Identifiant de la commande en cours dans la base en ligne */
let idCommandeEnLigne = "";

/* Un retour a la ligne, pour les textes sur plusieurs lignes */
const SAUT      = String.fromCharCode(10);
const APOSTROPHE = String.fromCharCode(39);

/* ------------------------------------------------------------
   OUTIL : mettre un prix en forme
   En ariary on n'ecrit pas de centimes et on separe les
   milliers par une espace :  18000  ->  "18 000 Ar"
   (le reglage CONFIG.decimales permet de changer ca)
   ------------------------------------------------------------ */
function prixEnTexte(nombre){
  const d = CONFIG.decimales;
  let texte;

  if (d === 0) {
    /* on arrondit, puis on place une espace tous les 3 chiffres */
    texte = Math.round(nombre).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  } else {
    texte = nombre.toFixed(d).replace(".", ",");
  }

  return texte + " " + CONFIG.devise;
}

/* Retrouver un plat a partir de son identifiant */
function trouverPlat(id){
  for (const categorie of menuActuel) {
    for (const plat of categorie.plats) {
      if (plat.id === id) return plat;
    }
  }
  return null;
}

/* ============================================================
   LE PROFIL DU CLIENT CONNECTE
   ------------------------------------------------------------
   Le nom, le telephone et l'adresse viennent du compte cree
   dans comptes.js. Le client n'a donc rien a retaper.
   ============================================================ */
function remplirClient(){
  const compte = compteActuel();
  if (!compte) return;

  document.getElementById("nom").value       = compte.nom || "";
  document.getElementById("telephone").value = compte.telephone || "";
  document.getElementById("adresse").value   = compte.adresse || "";
}

/* ============================================================
   1. AFFICHAGE DU MENU
   ============================================================ */
function afficherMenu(){
  const zoneMenu = document.getElementById("menu");
  const zoneNav  = document.getElementById("nav-categories");
  zoneMenu.innerHTML = "";
  zoneNav.innerHTML  = "";

  /* Un menu vide arrive vraiment : le restaurant n'a pas encore
     rempli js/menu.js. Mieux vaut le dire que d'afficher du blanc. */
  const nbPlats = menuActuel.reduce(function(n, c){
    return n + (c.plats ? c.plats.length : 0);
  }, 0);

  if (nbPlats === 0) {
    zoneMenu.innerHTML =
      '<p class="menu-vide">Le menu n' + APOSTROPHE + 'est pas encore en ligne.<br>' +
      '<span>Vous pouvez quand meme faire une demande dans ' +
      '« Une envie qui n' + APOSTROPHE + 'est pas au menu ? », plus bas.</span></p>';
    return;
  }

  menuActuel.forEach(function(categorie, numero){
    const ancre = "cat" + numero;

    /* --- le bouton dans la barre du haut --- */
    const lien = document.createElement("a");
    lien.href = "#" + ancre;
    lien.textContent = categorie.categorie;
    zoneNav.appendChild(lien);

    /* --- la section de la categorie --- */
    const section = document.createElement("section");
    section.className = "categorie";
    section.id = ancre;

    const titre = document.createElement("h2");
    titre.textContent = categorie.categorie;
    section.appendChild(titre);

    /* --- chaque plat --- */
    categorie.plats.forEach(function(plat){
      const ligne = document.createElement("div");
      ligne.className = "plat";
      ligne.innerHTML =
        '<div class="plat-infos">' +
          '<div class="plat-nom"></div>' +
          '<div class="plat-desc"></div>' +
        '</div>' +
        '<div class="plat-prix"></div>' +
        '<div class="compteur">' +
          '<button class="moins" hidden>&minus;</button>' +
          '<span class="qte" hidden>0</span>' +
          '<button class="plus">+</button>' +
        '</div>';

      /* On ecrit les textes avec textContent : plus sur que innerHTML */
      ligne.querySelector(".plat-nom").textContent  = plat.nom;
      ligne.querySelector(".plat-desc").textContent = plat.desc || "";
      ligne.querySelector(".plat-prix").textContent = prixEnTexte(plat.prix);

      /* Les deux boutons + et - */
      ligne.querySelector(".plus").onclick  = function(){ modifierQuantite(plat.id, +1); };
      ligne.querySelector(".moins").onclick = function(){ modifierQuantite(plat.id, -1); };

      /* On garde l'identifiant pour pouvoir mettre a jour l'affichage */
      ligne.dataset.id = plat.id;
      section.appendChild(ligne);
    });

    zoneMenu.appendChild(section);
  });

  /* dernier bouton de la barre : la zone "hors menu" */
  const lienHM = document.createElement("a");
  lienHM.href = "#hors-menu";
  lienHM.className = "chip-hm";
  lienHM.textContent = "Hors menu";
  zoneNav.appendChild(lienHM);
}

/* ============================================================
   2. GESTION DU PANIER
   ============================================================ */
function modifierQuantite(id, variation){
  const actuelle = panier[id] || 0;
  const nouvelle = actuelle + variation;

  if (nouvelle <= 0) {
    delete panier[id];
    delete precisions[id];        /* le plat part, sa precision aussi */
  } else {
    panier[id] = nouvelle;
  }

  rafraichirAffichage();
}

/* Calcule le nombre d'articles et le prix total */
function calculerTotaux(){
  let articles = 0;
  let somme    = 0;
  for (const id in panier) {
    const plat = trouverPlat(id);
    if (!plat) continue;
    articles += panier[id];
    somme    += panier[id] * plat.prix;
  }
  return { articles: articles, somme: somme };
}

/* Combien d'articles hors menu au total */
function nbHorsMenu(){
  let n = 0;
  horsMenu.forEach(function(d){ n += d.quantite; });
  return n;
}

/* Met a jour tout ce qui s'affiche a l'ecran */
function rafraichirAffichage(){
  const t = calculerTotaux();

  /* --- les compteurs a cote de chaque plat --- */
  document.querySelectorAll(".plat").forEach(function(ligne){
    const quantite = panier[ligne.dataset.id] || 0;
    const moins = ligne.querySelector(".moins");
    const qte   = ligne.querySelector(".qte");
    moins.hidden = (quantite === 0);
    qte.hidden   = (quantite === 0);
    qte.textContent = quantite;
  });

  /* --- la barre du bas --- */
  const totalArticles = t.articles + nbHorsMenu();
  const barre = document.getElementById("barre-panier");
  barre.classList.toggle("visible", totalArticles > 0);
  document.getElementById("nb-articles").textContent =
    totalArticles + (totalArticles > 1 ? " articles" : " article");
  /* si la commande ne contient que du hors menu, le total n'est pas connu */
  document.getElementById("total-barre").textContent =
    (t.somme === 0 && horsMenu.length > 0) ? "a confirmer" : prixEnTexte(t.somme);

  /* --- le detail dans la fenetre du panier --- */
  const zone = document.getElementById("lignes-panier");
  zone.innerHTML = "";

  for (const id in panier) {
    const plat = trouverPlat(id);
    if (!plat) continue;

    /* un bloc par plat : la ligne de prix + la case "precisions" */
    const bloc = document.createElement("div");
    bloc.className = "bloc-panier";

    /* --- la ligne : "2 x Salade ....... 12 000 Ar  X" --- */
    const ligne = document.createElement("div");
    ligne.className = "ligne-panier";
    ligne.innerHTML = '<span class="txt"></span><span><span class="pr"></span> ' +
                      '<button class="sup" title="Retirer">&#10005;</button></span>';
    ligne.querySelector(".txt").textContent = panier[id] + " x " + plat.nom;
    ligne.querySelector(".pr").textContent  = prixEnTexte(panier[id] * plat.prix);
    ligne.querySelector(".sup").onclick = function(){
      delete panier[id];
      delete precisions[id];
      rafraichirAffichage();
      if (calculerTotaux().articles === 0) fermerPanier();
    };
    bloc.appendChild(ligne);

    /* --- la case "precisions" propre a ce plat --- */
    const champ = document.createElement("input");
    champ.type        = "text";
    champ.className   = "champ-precision";
    champ.placeholder = "Precisions : sans oignon, bien cuit, peu de piment...";
    champ.value       = precisions[id] || "";
    champ.oninput     = function(){
      if (this.value.trim() === "") delete precisions[id];
      else precisions[id] = this.value;
    };
    bloc.appendChild(champ);

    zone.appendChild(bloc);
  }

  /* --- les demandes hors menu --- */
  horsMenu.forEach(function(demande, i){
    const bloc = document.createElement("div");
    bloc.className = "bloc-panier hors-menu";

    const ligne = document.createElement("div");
    ligne.className = "ligne-panier";
    ligne.innerHTML = '<span class="txt"></span><span><span class="pr a-confirmer">prix a confirmer</span> ' +
                      '<button class="sup" title="Retirer">&#10005;</button></span>';
    ligne.querySelector(".txt").textContent = demande.quantite + " x " + demande.texte;
    ligne.querySelector(".sup").onclick = function(){
      horsMenu.splice(i, 1);
      rafraichirAffichage();
      if (calculerTotaux().articles === 0 && horsMenu.length === 0) fermerPanier();
    };
    bloc.appendChild(ligne);

    const champ = document.createElement("input");
    champ.type        = "text";
    champ.className   = "champ-precision";
    champ.placeholder = "Precisions sur cette demande...";
    champ.value       = demande.precision || "";
    champ.oninput     = function(){ horsMenu[i].precision = this.value; };
    bloc.appendChild(champ);

    zone.appendChild(bloc);
  });

  /* la note sous le total n'apparait que s'il y a du hors menu */
  document.getElementById("note-hors-menu").hidden = (horsMenu.length === 0);

  /* --- frais de livraison affiches seulement si besoin --- */
  let total = t.somme;
  if (document.getElementById("mode").value === "Livraison" && CONFIG.fraisLivraison > 0 && totalArticles > 0) {
    const l = document.createElement("div");
    l.className = "ligne-panier";
    l.innerHTML = '<span class="txt"></span><span class="pr"></span>';
    l.querySelector(".txt").textContent = "Frais de livraison";
    l.querySelector(".pr").textContent  = prixEnTexte(CONFIG.fraisLivraison);
    zone.appendChild(l);
    total += CONFIG.fraisLivraison;
  }

  document.getElementById("total-modale").textContent =
    (total === 0 && horsMenu.length > 0) ? "a confirmer" : prixEnTexte(total);
}

/* ------------------------------------------------------------
   Ajouter un plat qui n'est pas au menu
   ------------------------------------------------------------ */
function ajouterHorsMenu(){
  const champTexte = document.getElementById("hm-texte");
  const champQte   = document.getElementById("hm-qte");

  const texte = champTexte.value.trim();
  if (texte === "") {
    alert("Ecrivez d'abord ce que vous souhaitez commander.");
    champTexte.focus();
    return;
  }

  const quantite = Math.max(1, parseInt(champQte.value, 10) || 1);
  horsMenu.push({ texte: texte, quantite: quantite, precision: "" });

  /* on vide le formulaire pour une eventuelle deuxieme demande */
  champTexte.value = "";
  champQte.value   = 1;

  rafraichirAffichage();
  ouvrirPanier();
}

/* ============================================================
   3. OUVRIR / FERMER LA FENETRE DU PANIER
   ============================================================ */
function ouvrirPanier(){
  document.getElementById("voile").classList.add("ouvert");
  document.body.style.overflow = "hidden";
}
function fermerPanier(){
  document.getElementById("voile").classList.remove("ouvert");
  document.body.style.overflow = "";
}

/* ============================================================
   4. LE NUMERO DE COMMANDE
   ------------------------------------------------------------
   Format :  KEI-JJMM-NNN
   - JJMM : le jour et le mois (pour s'y retrouver en cuisine)
   - NNN  : un compteur qui augmente a chaque commande passee
            depuis cet appareil, complete par un chiffre au
            hasard pour eviter que deux clients differents
            tombent sur le meme numero.
   ============================================================ */
function genererNumeroCommande(){
  const maintenant = new Date();
  const jour = String(maintenant.getDate()).padStart(2, "0");
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");

  /* compteur propre a cet appareil */
  let compteur = parseInt(localStorage.getItem("kei_compteur") || "0", 10) + 1;
  localStorage.setItem("kei_compteur", compteur);

  const hasard = Math.floor(Math.random() * 10);
  const suffixe = String(compteur % 100).padStart(2, "0") + hasard;

  return "KEI-" + jour + mois + "-" + suffixe;
}

/* ============================================================
   5. ENVOYER LA COMMANDE A LA CUISINE
   ------------------------------------------------------------
   La commande part directement dans la base Firebase. Rien ne
   s'ouvre, aucune application n'est necessaire.
   ============================================================ */
async function envoyerCommande(){
  const t = calculerTotaux();
  const bouton = document.getElementById("btn-envoyer");

  /* --- verifications --- */
  if (t.articles === 0 && horsMenu.length === 0) {
    alert("Votre commande est vide.");
    return;
  }

  const nom = document.getElementById("nom").value.trim();
  if (nom === "") {
    alert("Merci d'indiquer votre nom.");
    document.getElementById("nom").focus();
    return;
  }

  const telephone = document.getElementById("telephone").value.trim();
  if (telephone === "") {
    alert("Merci d'indiquer votre numero de telephone, pour que le restaurant puisse vous rappeler.");
    document.getElementById("telephone").focus();
    return;
  }

  const mode    = document.getElementById("mode").value;
  const adresse = document.getElementById("adresse").value.trim();
  if (mode === "Livraison" && adresse === "") {
    alert("Merci d'indiquer l'adresse de livraison.");
    document.getElementById("adresse").focus();
    return;
  }

  /* le site doit etre relie a la cuisine */
  if (!demarrerFirebase()) {
    alert(["Le site n'est pas encore relie a la cuisine.", "",
           "Il faut remplir js/firebase-config.js",
           "(voir le README, section Firebase)."].join(SAUT));
    return;
  }

  const heure    = document.getElementById("heure").value.trim();
  const remarque = document.getElementById("remarque").value.trim();
  const numero   = genererNumeroCommande();
  const compte   = compteActuel();

  /* on retient le telephone et l'adresse pour la prochaine fois */
  majProfil({ telephone: telephone, adresse: adresse });

  /* --- le recapitulatif, lisible tel quel en cuisine --- */
  const L = String.fromCharCode(10);
  const lignes = [];
  let total = 0;

  const lignesPlats = [];
  for (const id in panier) {
    const plat = trouverPlat(id);
    if (!plat) continue;
    const sousTotal = panier[id] * plat.prix;
    total += sousTotal;
    lignesPlats.push("- " + panier[id] + " x " + plat.nom + "  ...  " + prixEnTexte(sousTotal));
    if (precisions[id]) lignesPlats.push("   > " + precisions[id]);
  }

  if (lignesPlats.length > 0) {
    lignes.push("*Commande :*");
    lignesPlats.forEach(function(l){ lignes.push(l); });
  }

  if (mode === "Livraison" && CONFIG.fraisLivraison > 0) {
    lignes.push("- Frais de livraison  ...  " + prixEnTexte(CONFIG.fraisLivraison));
    total += CONFIG.fraisLivraison;
  }

  if (horsMenu.length > 0) {
    lignes.push("*Hors menu (prix a confirmer) :*");
    horsMenu.forEach(function(demande){
      lignes.push("- " + demande.quantite + " x " + demande.texte);
      if (demande.precision) lignes.push("   > " + demande.precision);
    });
  }

  lignes.push("*TOTAL : " + ((total === 0 && horsMenu.length > 0)
                             ? "a confirmer" : prixEnTexte(total)) + "*");
  if (remarque) lignes.push("Remarque : " + remarque);

  const message = lignes.join(L);

  /* --- envoi --- */
  bouton.disabled = true;
  bouton.textContent = "Envoi en cours...";

  const r = await envoyerCommandeEnLigne({
    numero    : numero,
    date      : new Date().toISOString(),
    client    : nom,
    compte    : compte ? compte.identifiant : "",
    telephone : telephone,
    mode      : mode,
    adresse   : adresse,
    heure     : heure,
    remarque  : remarque,
    total     : total,
    message   : message
  });

  bouton.disabled = false;
  bouton.textContent = "Envoyer la commande a la cuisine";

  if (!r.ok) {
    alert(["La commande n'est pas partie.", "",
           "Verifiez votre connexion internet et reessayez.",
           "Rien n'est perdu : votre panier est toujours la."].join(SAUT));
    return;
  }

  idCommandeEnLigne = r.id;

  /* la sonnette : reveille le telephone du chef, meme ecran eteint.
     On n'attend pas la reponse : la commande est deja enregistree. */
  prevenirLeChef({ numero: numero, mode: mode });

  /* on l'ajoute a "mes commandes du jour", avec son contenu :
     c'est ce qui permet de la refaire d'un seul geste. */
  ajouterAHistorique({
    numero     : numero,
    date       : new Date().toISOString(),
    total      : total,
    idEnLigne  : r.id,
    plats      : Object.assign({}, panier),
    precisions : Object.assign({}, precisions),
    horsMenu   : horsMenu.map(function(d){ return Object.assign({}, d); })
  });

  afficherConfirmation(numero);
  demarrerSuivi(r.id);
}

/* ============================================================
   6. L'ECRAN DE CONFIRMATION
   ============================================================ */
function afficherConfirmation(numero){
  document.getElementById("numero-commande").textContent = numero;
  document.getElementById("etape-commande").hidden     = true;
  document.getElementById("etape-confirmation").hidden = false;
  document.querySelector(".modale").scrollTop = 0;
  afficherHistorique();
}

/* ------------------------------------------------------------
   SUIVI EN DIRECT DU STATUT
   La cuisine clique sur "Marquer comme vue", et la
   ligne se met a jour toute seule sur l'ecran du client.
   ------------------------------------------------------------ */
function demarrerSuivi(id){
  const zone = document.getElementById("suivi-direct");
  if (!id || !zone) return;

  zone.hidden = false;
  afficherStatut("nouvelle");

  suivreStatut(id, afficherStatut);
}

function afficherStatut(statut){
  const zone     = document.getElementById("suivi-direct");
  const pastille = document.getElementById("pastille-statut");
  const texte    = document.getElementById("texte-statut");
  if (!zone) return;

  const libelles = {
    nouvelle : "Commande recue, en attente de la cuisine",
    vue      : "La cuisine a vu votre commande"
  };

  zone.className = "suivi-direct etat-" + statut;
  texte.textContent = libelles[statut] || statut;
  pastille.textContent = (statut === "vue") ? "✓" : "";
}

/* Reaffiche la derniere commande et reprend son suivi */
function rouvrirConfirmation(commande){
  afficherConfirmation(commande.numero);
  if (commande.idEnLigne) {
    idCommandeEnLigne = commande.idEnLigne;
    demarrerSuivi(commande.idEnLigne);
  }
  ouvrirPanier();
}

/* Remet la fenetre a zero pour une nouvelle commande */
function nouvelleCommande(){
  for (const id in panier)     delete panier[id];
  for (const id in precisions) delete precisions[id];
  horsMenu.length = 0;

  /* le nom, le telephone et l'adresse restent remplis : c'est le meme client */
  remplirClient();
  document.getElementById("heure").value    = "";
  document.getElementById("remarque").value = "";
  document.getElementById("mode").value     = "Sur place";
  document.getElementById("bloc-adresse").hidden = true;

  document.getElementById("etape-confirmation").hidden = true;
  document.getElementById("etape-commande").hidden     = false;
  document.getElementById("suivi-direct").hidden       = true;
  idCommandeEnLigne = "";

  rafraichirAffichage();
  fermerPanier();
}

/* ============================================================
   MES COMMANDES DU JOUR
   ------------------------------------------------------------
   Le site garde la liste des commandes passees depuis cet
   appareil, et la remet a zero a chaque nouveau jour.

   Elle vit dans le navigateur du client : le restaurant n'y a
   pas acces, et elle survit a l'effacement des commandes dans
   Firebase (qui a lieu au bout de quelques heures).
   ============================================================ */
const CLE_HISTORIQUE = "kei_historique";

/* La date du jour, sous la forme "2026-09-01" */
function jourActuel(date){
  const d = date ? new Date(date) : new Date();
  return d.getFullYear() + "-" +
         String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0");
}

/* Lit l'historique en ne gardant que les commandes d'aujourd'hui.
   C'est la lecture qui fait la remise a zero : inutile de guetter
   minuit, il suffit de comparer les dates. */
function lireHistorique(){
  let liste;
  try { liste = JSON.parse(localStorage.getItem(CLE_HISTORIQUE)) || []; }
  catch (e) { liste = []; }

  const aujourdhui = jourActuel();
  const dujour = liste.filter(function(c){ return jourActuel(c.date) === aujourdhui; });

  /* si des commandes d'hier trainaient, on nettoie le stockage */
  if (dujour.length !== liste.length) {
    localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(dujour));
  }
  return dujour;
}

function ajouterAHistorique(commande){
  const liste = lireHistorique();
  liste.unshift(commande);                    /* la plus recente en premier */
  localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(liste.slice(0, 20)));
}

/* Affiche la liste, et suit en direct le statut de chaque commande */
function afficherHistorique(){
  const zone  = document.getElementById("historique");
  const liste = document.getElementById("liste-historique");
  const commandes = lireHistorique();

  zone.hidden = (commandes.length === 0);
  liste.innerHTML = "";
  if (commandes.length === 0) return;

  commandes.forEach(function(commande){
    const item = document.createElement("li");
    item.innerHTML =
      '<div class="hist-gauche">' +
        '<span class="hist-num"></span>' +
        '<span class="hist-heure"></span>' +
      '</div>' +
      '<div class="hist-droite">' +
        '<span class="hist-total"></span>' +
        '<span class="hist-statut">&hellip;</span>' +
      '</div>';

    item.querySelector(".hist-num").textContent   = commande.numero;
    item.querySelector(".hist-heure").textContent = heureDe(commande.date);
    item.querySelector(".hist-total").textContent = prixEnTexte(commande.total);

    const etiquette = item.querySelector(".hist-statut");
    etiquette.textContent = "Terminee";
    item.className = "hist-terminee";

    /* si la commande existe encore dans la base, on suit son statut */
    if (commande.idEnLigne) {
      suivreStatut(commande.idEnLigne, function(statut){
        item.className = "hist-" + statut;
        etiquette.textContent = (statut === "vue")
          ? "Vue par la cuisine"
          : "En attente de la cuisine";
      });
    }

    /* un clic sur la ligne rouvre le suivi de cette commande */
    item.onclick = function(){ rouvrirConfirmation(commande); };

    /* et un bouton pour la refaire a l'identique */
    if (commande.plats && Object.keys(commande.plats).length > 0) {
      const refaire = document.createElement("button");
      refaire.className = "hist-refaire";
      refaire.textContent = "Recommander";
      refaire.title = "Remettre les memes plats dans le panier";
      refaire.onclick = function(e){
        e.stopPropagation();          /* sans ca, on ouvrirait le suivi */
        recommander(commande);
      };
      item.querySelector(".hist-droite").appendChild(refaire);
    }

    liste.appendChild(item);
  });
}

/* ------------------------------------------------------------
   Refaire une commande passee.
   On remplace le panier par celui de la commande choisie, en
   ignorant les plats qui ne sont plus au menu : les prix et la
   carte ont pu changer depuis.
   ------------------------------------------------------------ */
function recommander(commande){
  for (const id in panier)     delete panier[id];
  for (const id in precisions) delete precisions[id];
  horsMenu.length = 0;

  let repris = 0, disparus = 0;

  for (const id in (commande.plats || {})) {
    if (trouverPlat(id)) {
      panier[id] = commande.plats[id];
      if (commande.precisions && commande.precisions[id]) {
        precisions[id] = commande.precisions[id];
      }
      repris++;
    } else {
      disparus++;
    }
  }

  (commande.horsMenu || []).forEach(function(d){
    horsMenu.push({ texte:d.texte, quantite:d.quantite, precision:d.precision || "" });
  });

  rafraichirAffichage();
  ouvrirPanier();

  if (disparus > 0) {
    const phrase = (disparus > 1)
      ? disparus + " plats ne sont plus au menu et n'ont pas ete repris."
      : "1 plat n'est plus au menu et n'a pas ete repris.";
    alert([phrase, "", "Verifiez votre commande avant de l'envoyer."].join(SAUT));
  } else if (repris === 0 && horsMenu.length === 0) {
    alert("Aucun plat de cette commande n'est encore au menu.");
  }
}

/* "17h05" a partir d'une date ISO */
function heureDe(iso){
  try {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + "h" +
           String(d.getMinutes()).padStart(2, "0");
  } catch (e) { return ""; }
}

/* ============================================================
   7. DEMARRAGE : on branche tout au chargement de la page
   ============================================================ */
document.addEventListener("DOMContentLoaded", function(){

  /* textes venant du fichier de configuration */
  document.getElementById("logo").textContent           = CONFIG.nomRestaurant;
  document.getElementById("footer-nom").textContent     = CONFIG.nomRestaurant;
  document.getElementById("slogan").textContent         = CONFIG.slogan;
  document.getElementById("footer-horaires").innerHTML  = CONFIG.horaires;
  document.getElementById("footer-adresse").textContent = CONFIG.adresse;
  document.title = CONFIG.nomRestaurant + " - Commander en ligne";

  afficherMenu();
  remplirClient();      /* si le client etait deja connecte */
  rafraichirAffichage();
  afficherHistorique();

  /* boutons */
  document.getElementById("btn-ouvrir-panier").onclick    = ouvrirPanier;
  document.getElementById("btn-fermer").onclick           = fermerPanier;
  document.getElementById("btn-envoyer").onclick          = envoyerCommande;
  document.getElementById("btn-nouvelle-commande").onclick = nouvelleCommande;

  /* la zone "hors menu" */
  document.getElementById("hm-ajouter").onclick = ajouterHorsMenu;
  document.getElementById("hm-texte").addEventListener("keydown", function(e){
    if (e.key === "Enter") ajouterHorsMenu();
  });

  /* clic sur le fond sombre = fermeture */
  document.getElementById("voile").onclick = function(e){
    if (e.target.id === "voile") fermerPanier();
  };

  /* touche Echap = fermeture */
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape") fermerPanier();
  });

  /* le champ adresse n'apparait que pour la livraison */
  document.getElementById("mode").onchange = function(){
    document.getElementById("bloc-adresse").hidden = (this.value !== "Livraison");
    rafraichirAffichage();
  };
});
