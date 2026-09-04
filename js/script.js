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
   { identifiantDeLigne : "sans oignon" } */
const precisions = {};

/* Ce que le client a coche devant chaque plat a options :
   { "k12" : ["Poulet"] }, un element par groupe de choix.
   Tant qu'un groupe n'a pas de reponse, le bouton + reste
   desactive : mieux vaut bloquer que deviner a sa place. */
const choixEnCours = {};

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

/* ------------------------------------------------------------
   LES LIGNES DU PANIER

   Un plat peut avoir des choix (Poulet / Boeuf...). "Panini
   poulet" et "Panini jambon" doivent alors compter comme deux
   lignes differentes. On identifie donc une ligne par le plat
   ET par ses options :

       "k12#Poulet"   Panini poulet
       "k3"           Frite + poulet frit (aucun choix)

   Le panier est range par ces identifiants de ligne.
   ------------------------------------------------------------ */
function idLigne(platId, options){
  return (options && options.length) ? platId + "#" + options.join("|") : platId;
}

function platDeLaLigne(idL){
  return idL.split("#")[0];
}

function optionsDeLaLigne(idL){
  const morceaux = idL.split("#");
  return (morceaux.length > 1 && morceaux[1] !== "") ? morceaux[1].split("|") : [];
}

/* Retrouver un plat a partir d'un identifiant de ligne */
function trouverPlat(idL){
  const platId = platDeLaLigne(idL);
  for (const categorie of menuActuel) {
    for (const plat of categorie.plats) {
      if (plat.id === platId) return plat;
    }
  }
  return null;
}

/* Le nom a afficher : "Panini (Poulet)" */
function nomDeLaLigne(idL){
  const plat = trouverPlat(idL);
  if (!plat) return "";
  const options = optionsDeLaLigne(idL);
  return options.length ? plat.nom + " (" + options.join(", ") + ")" : plat.nom;
}

/* Le prix : celui du plat, plus les supplements des options choisies */
function prixDeLaLigne(idL){
  const plat = trouverPlat(idL);
  if (!plat) return 0;

  let prix = plat.prix;
  optionsDeLaLigne(idL).forEach(function(nomOption){
    (plat.choix || []).forEach(function(groupe){
      (groupe.options || []).forEach(function(option){
        if (option.nom === nomOption) prix += (option.supplement || 0);
      });
    });
  });
  return prix;
}

/* Les groupes de choix reellement utilisables.

   Dans la page admin, un choix se cree vide : on tape son nom,
   puis celui de ses options. Entre-temps le menu contient des
   groupes a moitie remplis. Un groupe sans option nommee ne peut
   recevoir aucune reponse : il rendrait le plat impossible a
   commander. On l'ignore donc jusqu'a ce qu'il soit pret. */
function groupesDuPlat(plat){
  return (plat.choix || [])
    .map(function(groupe){
      return {
        nom : groupe.nom,
        options : (groupe.options || []).filter(function(option){
          return option.nom && option.nom.trim() !== "";
        })
      };
    })
    .filter(function(groupe){ return groupe.options.length > 0; });
}

/* Cette ligne est-elle encore commandable ? Le plat doit exister,
   et chacune de ses options doit toujours figurer au menu. Sert
   quand on refait une commande passee : la carte a pu changer. */
function ligneEncoreValide(idL){
  const plat = trouverPlat(idL);
  if (!plat) return false;

  const groupes = groupesDuPlat(plat);
  const options = optionsDeLaLigne(idL);
  if (options.length !== groupes.length) return false;

  return groupes.every(function(groupe, i){
    return (groupe.options || []).some(function(o){ return o.nom === options[i]; });
  });
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

  /* Tant que le restaurant n'a qu'une seule categorie, son titre
     et son bouton de navigation n'apprennent rien au client : on
     ne les affiche pas. Des qu'il y en a deux, ils reviennent. */
  const uneSeuleCategorie = (menuActuel.length === 1);

  menuActuel.forEach(function(categorie, numero){
    const ancre = "cat" + numero;

    /* --- le bouton dans la barre du haut --- */
    if (!uneSeuleCategorie) {
      const lien = document.createElement("a");
      lien.href = "#" + ancre;
      lien.textContent = categorie.categorie;
      zoneNav.appendChild(lien);
    }

    /* --- la section de la categorie --- */
    const section = document.createElement("section");
    section.className = "categorie";
    section.id = ancre;

    if (!uneSeuleCategorie) {
      const titre = document.createElement("h2");
      titre.textContent = categorie.categorie;
      section.appendChild(titre);
    }

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

      /* --- les choix du plat, quand il en a --- */
      if (groupesDuPlat(plat).length) {
        choixEnCours[plat.id] = choixEnCours[plat.id] || [];
        /* les choix passent sous toute la carte, pas dans la
           colonne du nom : les options tiennent alors sur une
           seule ligne au lieu de s'empiler */
        ligne.appendChild(construireChoix(plat));
      }

      /* Les boutons + et - agissent sur la combinaison choisie */
      ligne.querySelector(".plus").onclick  = function(){ ajusterPlat(plat, +1); };
      ligne.querySelector(".moins").onclick = function(){ ajusterPlat(plat, -1); };

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

/* ------------------------------------------------------------
   Les boutons de choix affiches sous le nom d'un plat.
   Un groupe = une question ("Garniture :"), une reponse a la fois.
   ------------------------------------------------------------ */
function construireChoix(plat){
  const zone = document.createElement("div");
  zone.className = "plat-choix";

  groupesDuPlat(plat).forEach(function(groupe, iGroupe){
    const bloc = document.createElement("div");
    bloc.className = "groupe-choix";
    bloc.dataset.groupe = iGroupe;

    const etiquette = document.createElement("span");
    etiquette.className = "nom-choix";
    etiquette.textContent = groupe.nom;
    bloc.appendChild(etiquette);

    (groupe.options || []).forEach(function(option){
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "option-choix";
      bouton.textContent = option.nom +
        (option.supplement ? " +" + prixEnTexte(option.supplement) : "");
      bouton.dataset.groupe = iGroupe;
      bouton.dataset.option = option.nom;
      bouton.onclick = function(){
        choixEnCours[plat.id][iGroupe] = option.nom;
        rafraichirAffichage();
      };
      bloc.appendChild(bouton);
    });

    zone.appendChild(bloc);
  });

  return zone;
}

/* Toutes les questions du plat ont-elles une reponse ? */
function choixComplet(plat){
  const groupes = groupesDuPlat(plat);
  if (!groupes.length) return true;
  const faits = choixEnCours[plat.id] || [];
  return groupes.every(function(groupe, i){ return !!faits[i]; });
}

/* La ligne de panier qui correspond a ce qui est coche maintenant */
function ligneChoisie(plat){
  const groupes = groupesDuPlat(plat);
  if (!groupes.length) return plat.id;
  return idLigne(plat.id, (choixEnCours[plat.id] || []).slice(0, groupes.length));
}

/* Le + et le - places a cote d'un plat du menu */
function ajusterPlat(plat, variation){
  if (!choixComplet(plat)) return;   /* le + est deja desactive : ceinture et bretelles */
  modifierQuantite(ligneChoisie(plat), variation);
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
    somme    += panier[id] * prixDeLaLigne(id);
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
    const plat = trouverPlat(ligne.dataset.id);
    if (!plat) return;

    /* on souligne l'option cochee dans chaque groupe */
    ligne.querySelectorAll(".option-choix").forEach(function(bouton){
      const coche = (choixEnCours[plat.id] || [])[Number(bouton.dataset.groupe)];
      bouton.classList.toggle("choisi", coche === bouton.dataset.option);
    });

    /* une question sans reponse s'annonce : son intitule passe en
       vermillon, sinon le client ne comprend pas pourquoi le +
       reste eteint */
    ligne.querySelectorAll(".groupe-choix").forEach(function(groupe){
      const coche = (choixEnCours[plat.id] || [])[Number(groupe.dataset.groupe)];
      groupe.classList.toggle("sans-reponse", !coche);
    });

    /* tant que le choix n'est pas fait, on ne peut pas ajouter */
    const complet = choixComplet(plat);
    const plus = ligne.querySelector(".plus");
    plus.disabled = !complet;
    plus.title    = complet ? "" : "Faites votre choix d'abord";

    /* le compteur montre la quantite de la combinaison cochee */
    const quantite = complet ? (panier[ligneChoisie(plat)] || 0) : 0;
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
    ligne.querySelector(".txt").textContent = panier[id] + " x " + nomDeLaLigne(id);
    ligne.querySelector(".pr").textContent  = prixEnTexte(panier[id] * prixDeLaLigne(id));
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
    const sousTotal = panier[id] * prixDeLaLigne(id);
    total += sousTotal;
    lignesPlats.push("- " + panier[id] + " x " + nomDeLaLigne(id) + "  ...  " + prixEnTexte(sousTotal));
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
  /* on attend l'ecriture : l'ecran de confirmation relit
     l'historique dans la foulee, et lirait sinon une liste sans
     la commande qui vient de partir */
  await ajouterAHistorique({
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

   Elle vit sous le compte, dans Firebase (/historiques/{uid}),
   et non dans le navigateur : elle suit donc le client d'un
   appareil a l'autre. Chacun ne lit que la sienne, et elle
   survit a l'effacement des commandes de la cuisine, qui a lieu
   au bout de quelques heures.
   ============================================================ */

/* La date du jour, sous la forme "2026-09-01" */
function jourActuel(date){
  const d = date ? new Date(date) : new Date();
  return d.getFullYear() + "-" +
         String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0");
}

/* ------------------------------------------------------------
   Traduction entre le panier et la base.

   Une cle Firebase ne peut pas contenir . $ # [ ] / . Or une
   ligne de panier s'appelle "k12#Poulet". Les lignes voyagent
   donc dans une LISTE d'objets, et redeviennent un panier a la
   lecture : recommander() n'a ainsi rien a savoir de tout ca.
   ------------------------------------------------------------ */
function historiqueVersEnLigne(commande){
  const lignes = [];
  for (const id in (commande.plats || {})) {
    const ligne = { ligne: id, quantite: commande.plats[id] };
    if (commande.precisions && commande.precisions[id]) {
      ligne.precision = commande.precisions[id];
    }
    lignes.push(ligne);
  }

  const entree = {
    numero : commande.numero,
    date   : commande.date,
    total  : commande.total || 0
  };
  if (commande.idEnLigne) entree.idEnLigne = commande.idEnLigne;
  if (lignes.length)      entree.lignes    = lignes;

  if (commande.horsMenu && commande.horsMenu.length) {
    entree.horsMenu = commande.horsMenu.map(function(d){
      const demande = { texte: d.texte, quantite: d.quantite };
      if (d.precision) demande.precision = d.precision;
      return demande;
    });
  }
  return entree;
}

function historiqueDepuisEnLigne(entree){
  const plats = {}, precisionsLues = {};

  (entree.lignes || []).forEach(function(l){
    plats[l.ligne] = l.quantite;
    if (l.precision) precisionsLues[l.ligne] = l.precision;
  });

  return {
    cle        : entree.cle,
    numero     : entree.numero,
    date       : entree.date,
    total      : entree.total || 0,
    idEnLigne  : entree.idEnLigne || "",
    plats      : plats,
    precisions : precisionsLues,
    horsMenu   : (entree.horsMenu || []).map(function(d){
      return { texte:d.texte, quantite:d.quantite, precision:d.precision || "" };
    })
  };
}

/* Lit l'historique du compte en ne gardant que les commandes
   d'aujourd'hui. C'est la lecture qui fait la remise a zero :
   inutile de guetter minuit, il suffit de comparer les dates.

   Il est range sous le compte, dans Firebase, et non dans le
   navigateur : c'est ce qui le fait suivre d'un appareil a
   l'autre des qu'on se connecte. */
function lireHistorique(){
  /* Un navigateur peut garder en cache un vieux kei-firebase.js
     sans ces fonctions, le temps qu'il se rafraichisse. Mieux vaut
     un historique vide qu'une erreur en pleine page. */
  if (typeof lireHistoriqueEnLigne !== "function") {
    console.warn("Historique indisponible : rechargez la page.");
    return Promise.resolve([]);
  }

  return lireHistoriqueEnLigne().then(function(brut){
    const aujourdhui = jourActuel();
    const dujour   = [];
    const perimees = [];

    brut.forEach(function(entree){
      if (jourActuel(entree.date) === aujourdhui) dujour.push(historiqueDepuisEnLigne(entree));
      else perimees.push(entree.cle);
    });

    /* les commandes d'hier ne servent plus a personne */
    if (perimees.length) supprimerHistoriqueEnLigne(perimees);

    return dujour.slice(0, 20);
  });
}

function ajouterAHistorique(commande){
  const cle = commande.idEnLigne || commande.numero;
  return ecrireHistoriqueEnLigne(cle, historiqueVersEnLigne(commande));
}

/* Affiche la liste, et suit en direct le statut de chaque commande */
async function afficherHistorique(){
  const zone  = document.getElementById("historique");
  const liste = document.getElementById("liste-historique");
  if (!zone || !liste) return;

  const commandes = await lireHistorique();

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
    if (ligneEncoreValide(id)) {
      panier[id] = commande.plats[id];

      /* on recoche les options de cette ligne, pour que le compteur
         du menu corresponde a ce qui vient d'etre remis au panier */
      const options = optionsDeLaLigne(id);
      if (options.length) choixEnCours[platDeLaLigne(id)] = options;

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
