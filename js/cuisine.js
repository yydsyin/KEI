/* ============================================================
   PAGE CUISINE  --  Restaurant KEI
   ------------------------------------------------------------
   Les commandes arrivent en direct depuis Firebase.
   A chaque nouvelle commande : un son, une vibration et une
   notification, pour que le chef ne la rate pas.
   ============================================================ */

/* Les deux icones du bouton de son. Dessinees, pas des emoji :
   meme trait, meme taille, elles suivent la couleur du texte. */
const ICONE_SON_ACTIF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

const ICONE_SON_COUPE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M16 9.5l5 5"/><path d="M21 9.5l-5 5"/></svg>';

const APOS       = String.fromCharCode(39);   /* une apostrophe */
const SAUT_LIGNE = String.fromCharCode(10);   /* un retour a la ligne */

const commandesAffichees = {};   /* { idFirebase : element HTML } */
const donneesCommandes   = {};   /* { idFirebase : la commande } */
let sonActif      = true;
let premierChargement = true;    /* on ne sonne pas pour l'historique */

/* ============================================================
   1. L'ALARME
   ------------------------------------------------------------
   Le son est fabrique par le navigateur lui-meme (Web Audio),
   ce qui evite d'avoir a heberger un fichier audio.
   ============================================================ */
let contexteAudio = null;

function preparerSon(){
  if (contexteAudio) return;
  const Contexte = window.AudioContext || window.webkitAudioContext;
  if (Contexte) contexteAudio = new Contexte();
}

/* Trois "bip" montants, assez forts pour une cuisine */
function jouerAlarme(){
  if (!sonActif || !contexteAudio) return;

  /* certains navigateurs mettent l'audio en pause : on le relance */
  if (contexteAudio.state === "suspended") contexteAudio.resume();

  const notes = [880, 1108, 1318];   /* la, do diese, mi */
  notes.forEach(function(frequence, i){
    const debut = contexteAudio.currentTime + i * 0.18;

    const oscillateur = contexteAudio.createOscillator();
    const volume      = contexteAudio.createGain();

    oscillateur.type = "sine";
    oscillateur.frequency.value = frequence;

    /* montee puis descente du volume, pour eviter le "clic" */
    volume.gain.setValueAtTime(0.0001, debut);
    volume.gain.exponentialRampToValueAtTime(0.35, debut + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, debut + 0.16);

    oscillateur.connect(volume);
    volume.connect(contexteAudio.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + 0.18);
  });
}

function vibrer(){
  if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 500]);
}

function notifier(commande){
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const n = new Notification("Nouvelle commande " + commande.numero, {
    body : commande.client + " - " + commande.mode,
    tag  : commande.numero,      /* evite les doublons */
    renotify : true
  });
  n.onclick = function(){ window.focus(); n.close(); };
}

/* ------------------------------------------------------------
   LA SONNERIE INSISTANTE
   Tant qu'il reste une commande a traiter, on resonne. Comme un
   telephone : ca s'arrete quand on repond, c'est-a-dire quand le
   chef appuie sur "Marquer comme vue".
   Ne marche que si cette page est ouverte : une page fermee ne
   peut rien faire sonner.
   ------------------------------------------------------------ */
let minuterieAlarme = null;

function gererSonnerieContinue(){
  const intervalle = (typeof CONFIG.secondesEntreRappels === "number")
                     ? CONFIG.secondesEntreRappels : 0;
  if (intervalle <= 0) return;

  const restantes = document.querySelectorAll(".carte-commande.statut-nouvelle").length;

  /* plus rien a traiter : on se tait */
  if (restantes === 0) {
    if (minuterieAlarme) { clearInterval(minuterieAlarme); minuterieAlarme = null; }
    document.title = "Cuisine - " + CONFIG.nomRestaurant;
    return;
  }

  /* deja en train de sonner : on ne lance pas une deuxieme minuterie */
  if (minuterieAlarme) return;

  minuterieAlarme = setInterval(function(){
    if (document.querySelectorAll(".carte-commande.statut-nouvelle").length === 0) {
      clearInterval(minuterieAlarme);
      minuterieAlarme = null;
      return;
    }
    jouerAlarme();
    vibrer();
  }, intervalle * 1000);
}

function alerter(commande){
  jouerAlarme();
  vibrer();
  notifier(commande);
  document.title = "(!) Nouvelle commande - Cuisine";
}

/* ============================================================
   2. AFFICHAGE D'UNE COMMANDE
   ============================================================ */
/* Depuis combien de temps cette commande attend-elle ?
   C'est l'information la plus utile en plein service : une
   commande de 2 minutes et une de 20 ne se traitent pas pareil. */
function attenteEnTexte(commande){
  const minutes = Math.floor((Date.now() - dateCommande(commande)) / 60000);
  if (minutes < 1)  return "a l'instant";
  if (minutes === 1) return "il y a 1 min";
  if (minutes < 60) return "il y a " + minutes + " min";
  const heures = Math.floor(minutes / 60);
  return "il y a " + heures + "h" + String(minutes % 60).padStart(2, "0");
}

/* Toutes les 30 secondes, on rafraichit les durees affichees */
function rafraichirAttentes(){
  for (const id in donneesCommandes) {
    const carte = commandesAffichees[id];
    if (!carte) continue;
    const zone = carte.querySelector(".heure-commande");
    if (!zone) continue;

    const commande = donneesCommandes[id];
    zone.textContent = heureCourte(commande.date) + "  ·  " + attenteEnTexte(commande);

    /* au-dela de 10 minutes sans etre vue, la commande s'impatiente */
    const enRetard = (commande.statut || "nouvelle") === "nouvelle" &&
                     (Date.now() - dateCommande(commande)) > 10 * 60 * 1000;
    carte.classList.toggle("en-retard", enRetard);
  }
}

function heureCourte(iso){
  try {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + "h" +
           String(d.getMinutes()).padStart(2, "0");
  } catch (e) { return ""; }
}

function fabriquerCarte(id, commande){
  const carte = document.createElement("article");
  carte.className = "carte-commande statut-" + (commande.statut || "nouvelle");
  carte.dataset.id = id;

  /* --- entete : numero, heure, statut --- */
  const entete = document.createElement("div");
  entete.className = "entete-commande";
  entete.innerHTML =
    '<div>' +
      '<span class="num-commande"></span>' +
      '<span class="heure-commande"></span>' +
    '</div>' +
    '<span class="etiquette-statut"></span>';
  entete.querySelector(".num-commande").textContent   = commande.numero || "?";
  entete.querySelector(".heure-commande").textContent =
    heureCourte(commande.date) + "  ·  " + attenteEnTexte(commande);
  carte.appendChild(entete);

  /* --- qui commande --- */
  const client = document.createElement("div");
  client.className = "client-commande";
  const bouts = [];
  if (commande.client)    bouts.push(commande.client);
  if (commande.telephone) bouts.push(commande.telephone);
  if (commande.mode)      bouts.push(commande.mode);
  client.textContent = bouts.join("  -  ");
  carte.appendChild(client);

  if (commande.adresse) {
    const adr = document.createElement("div");
    adr.className = "adresse-commande";
    adr.textContent = "Livraison : " + commande.adresse;
    carte.appendChild(adr);
  }
  if (commande.heure) {
    const h = document.createElement("div");
    h.className = "adresse-commande";
    h.textContent = "Pour : " + commande.heure;
    carte.appendChild(h);
  }

  /* --- le detail de la commande, tel qu'il a ete redige --- */
  const detail = document.createElement("pre");
  detail.className = "detail-commande";
  detail.textContent = extraireDetail(commande.message || "");
  carte.appendChild(detail);

  /* --- le bouton de validation --- */
  const actions = document.createElement("div");
  actions.className = "actions-commande";

  const bouton = document.createElement("button");
  bouton.dataset.statut = "vue";
  bouton.textContent = "Marquer comme vue";
  bouton.onclick = function(){
    changerStatut(id, "vue");
    document.title = "Cuisine - KEI";
  };
  actions.appendChild(bouton);

  carte.appendChild(actions);
  majEtiquette(carte, commande.statut || "nouvelle");
  return carte;
}

/* Ce que la cuisine doit voir : les plats et les precisions.
   PAS LES MONTANTS : le chef prepare des plats, pas des additions.
   Les prix restent dans la base, ils ne sont juste pas affiches ici. */
function extraireDetail(message){
  const lignes = message.split(String.fromCharCode(10));
  const garde  = [];
  let dedans = false;

  lignes.forEach(function(ligne){
    let l = ligne;

    /* les titres de rubrique */
    if (l.indexOf("*Commande :*") === 0 || l.indexOf("*Hors menu") === 0) {
      dedans = true;
      if (garde.length > 0) garde.push("");     /* une ligne vide entre les rubriques */
      /* "Hors menu (prix a confirmer) :" n'a plus de sens sans les prix */
      garde.push(l.indexOf("*Hors menu") === 0 ? "Hors menu :" : l.split("*").join(""));
      return;
    }

    if (l.indexOf("*TOTAL") === 0) { dedans = false; return; }

    /* les frais de livraison ne concernent pas la cuisine */
    if (l.indexOf("- Frais de livraison") === 0) return;

    if (dedans && l.trim() !== "") {
      /* on coupe le montant : "- 2 x Poulet roti  ...  36 000 Ar" */
      const coupe = l.indexOf("  ...  ");
      if (coupe !== -1) l = l.slice(0, coupe);
      garde.push(l);
    }

    if (ligne.indexOf("Remarque :") === 0) garde.push("", ligne);
  });

  return garde.join(String.fromCharCode(10)) || message;
}

function majEtiquette(carte, statut){
  carte.className = "carte-commande statut-" + statut;
  carte.querySelector(".etiquette-statut").textContent = STATUTS[statut] || statut;

  /* une fois vue, le bouton se transforme en confirmation */
  const bouton = carte.querySelector(".actions-commande button");
  if (bouton) {
    const vue = (statut === "vue");
    bouton.classList.toggle("actif", vue);
    bouton.textContent = vue ? "Vue" : "Marquer comme vue";
    bouton.disabled = vue;
  }
}

/* ------------------------------------------------------------
   L'ordre d'affichage : d'abord ce qui reste a traiter, de la
   plus ancienne a la plus recente — on sert dans l'ordre
   d'arrivee. Les commandes deja vues descendent en dessous.
   ------------------------------------------------------------ */
function reordonner(){
  const liste = document.getElementById("liste-commandes");
  const ids = Object.keys(donneesCommandes);

  ids.sort(function(a, b){
    const ca = donneesCommandes[a], cb = donneesCommandes[b];
    const na = (ca.statut || "nouvelle") === "nouvelle" ? 0 : 1;
    const nb = (cb.statut || "nouvelle") === "nouvelle" ? 0 : 1;
    if (na !== nb) return na - nb;                 /* a traiter d'abord */
    if (na === 0) return dateCommande(ca) - dateCommande(cb);  /* la plus ancienne devant */
    return dateCommande(cb) - dateCommande(ca);    /* les vues : la plus recente devant */
  });

  ids.forEach(function(id){
    const carte = commandesAffichees[id];
    if (carte) liste.appendChild(carte);
  });
}

/* ============================================================
   3. LE COMPTEUR DE COMMANDES EN ATTENTE
   ============================================================ */
function majCompteur(){
  let attente = 0;
  document.querySelectorAll(".carte-commande").forEach(function(c){
    if (c.classList.contains("statut-nouvelle")) attente++;
  });

  const badge = document.getElementById("compteur-attente");
  badge.textContent = attente;
  badge.classList.toggle("zero", attente === 0);

  reordonner();
  rafraichirAttentes();
  gererSonnerieContinue();
  document.getElementById("message-vide").hidden =
    document.querySelectorAll(".carte-commande").length > 0;
}

/* ============================================================
   4. RECEPTION DES COMMANDES
   ============================================================ */
function commandeArrivee(id, commande){
  if (commandesAffichees[id]) return;

  const carte = fabriquerCarte(id, commande);
  const liste = document.getElementById("liste-commandes");
  liste.insertBefore(carte, liste.firstChild);   /* la plus recente en haut */
  commandesAffichees[id] = carte;
  donneesCommandes[id]   = commande;

  /* on ne sonne pas pour les commandes deja passees au chargement */
  if (!premierChargement && (commande.statut || "nouvelle") === "nouvelle") {
    alerter(commande);
    carte.classList.add("surlignee");
    setTimeout(function(){ carte.classList.remove("surlignee"); }, 4000);
  }

  majCompteur();
}

function commandeModifiee(id, commande){
  const carte = commandesAffichees[id];
  if (!carte) return;
  donneesCommandes[id] = commande;
  majEtiquette(carte, commande.statut || "nouvelle");
  majCompteur();
}

/* ============================================================
   5. LE MENAGE
   ------------------------------------------------------------
   Une commande n'a plus d'utilite passe quelques heures. On
   l'efface de la base pour deux raisons : garder l'ecran lisible,
   et ne pas conserver le nom, le telephone et l'adresse des
   clients plus longtemps que necessaire.

   Le menage se fait depuis cet ecran, quand il est ouvert : sans
   serveur, il n'y a personne d'autre pour le faire. Si l'ecran
   reste ferme plusieurs jours, les commandes attendent, et sont
   effacees a la prochaine ouverture.
   ============================================================ */
function heuresDeVie(){
  const h = (typeof CONFIG.heuresAvantSuppression === "number")
            ? CONFIG.heuresAvantSuppression : 3;
  return h * 60 * 60 * 1000;
}

/* La date d'une commande : l'horodatage du serveur si on l'a,
   sinon la date envoyee par le navigateur du client. */
function dateCommande(commande){
  if (typeof commande.horodatage === "number") return commande.horodatage;
  const t = new Date(commande.date).getTime();
  return isNaN(t) ? Date.now() : t;
}

function fairLeMenage(){
  const limite = Date.now() - heuresDeVie();
  let effacees = 0;

  for (const id in donneesCommandes) {
    if (dateCommande(donneesCommandes[id]) < limite) {
      supprimerCommandeEnLigne(id);
      effacees++;
    }
  }

  if (effacees > 0) console.log(effacees + " commande(s) ancienne(s) effacee(s).");
}

/* Retire une carte de l'ecran : appele quand la commande
   disparait de la base, d'ou qu'elle vienne. */
function commandeRetiree(id){
  const carte = commandesAffichees[id];
  if (carte && carte.parentNode) carte.parentNode.removeChild(carte);
  delete commandesAffichees[id];
  delete donneesCommandes[id];
  majCompteur();
}

/* Se deconnecter, depuis le tableau de bord ou l'ecran d'attente */
function deconnexionCuisine(){
  const question = "Se deconnecter ?" + SAUT_LIGNE + SAUT_LIGNE +
                   "Les commandes n'arriveront plus sur cet ecran, " +
                   "et le telephone ne sonnera plus tant que personne " +
                   "ne se reconnecte.";
  if (!confirm(question)) return;
  deconnecterCompte().then(function(){ location.href = "connexion.html"; });
}

/* ============================================================
   6. DEMARRAGE
   ============================================================ */
function ouvrirService(){
  document.getElementById("ecran-attente").hidden   = true;
  document.getElementById("tableau-cuisine").hidden = false;

  preparerSon();

  /* le bandeau des notifications, si elles ne sont pas encore accordees */
  if ("Notification" in window && Notification.permission === "default") {
    document.getElementById("bandeau-notif").hidden = false;
  }

  /* on empeche l'ecran de s'eteindre pendant le service, si possible */
  if ("wakeLock" in navigator) {
    navigator.wakeLock.request("screen").catch(function(){ /* pas grave */ });
  }

  ecouterCommandes(commandeArrivee, commandeModifiee, commandeRetiree, function(){
    /* lecture refusee : ce compte n'a pas le role "chef" */
    document.getElementById("liste-commandes").innerHTML =
      "<p class='vide'>Ce compte n" + APOS + "a pas les droits de la cuisine.<br>" +
      "<span>Son UID doit etre declare dans les regles de securite. " +
      "Voir le README, section Firebase.</span></p>";
  });

  /* apres le chargement initial, les prochaines commandes sonnent */
  setTimeout(function(){ premierChargement = false; }, 2500);

  /* les durees d'attente se rafraichissent toutes les 30 secondes */
  setInterval(rafraichirAttentes, 30 * 1000);

  /* le menage : une fois au demarrage, puis toutes les 10 minutes */
  setTimeout(fairLeMenage, 4000);
  setInterval(fairLeMenage, 10 * 60 * 1000);
}

document.addEventListener("DOMContentLoaded", function(){

  /* Le service worker rend la page installable sur l'ecran d'accueil.
     Il ne marche qu'en https (ou en localhost pendant les tests). */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function(e){
      console.warn("Service worker non enregistre :", e.message);
    });
  }

  document.getElementById("sous-cuisine").textContent = CONFIG.nomRestaurant;

  if (!demarrerFirebase()) {
    document.getElementById("message-attente").innerHTML =
      "<strong>Firebase n" + APOS + "est pas configure.</strong><br>" +
      "Voir le README, section Firebase.";
    return;
  }

  /* Il faut etre connecte ET avoir le role "chef" */
  surConnexion(async function(utilisateur){
    if (!utilisateur) { location.href = "connexion.html"; return; }

    document.getElementById("compte-cuisine").textContent = identifiantCourt(utilisateur.email);
    document.getElementById("btn-deconnexion-attente").hidden = false;

    const role = await lireMonRole();
    if (role !== "chef") {
      document.getElementById("message-attente").innerHTML =
        "<strong>Ce compte n" + APOS + "a pas les droits de la cuisine.</strong><br>" +
        "Connectez-vous avec le compte du chef.";
      return;
    }

    /* le son a besoin d'un geste de l'utilisateur : le premier clic
       sur la page l'autorisera */
    document.addEventListener("click", preparerSon, { once: true });

    ouvrirService();
  });

  /* --- les boutons de l'entete --- */
  document.getElementById("btn-son").onclick = function(){
    sonActif = !sonActif;
    if (!sonActif && minuterieAlarme) { clearInterval(minuterieAlarme); minuterieAlarme = null; }
    if (sonActif) gererSonnerieContinue();
    this.innerHTML = sonActif ? ICONE_SON_ACTIF : ICONE_SON_COUPE;
    this.title = sonActif ? "Couper le son" : "Remettre le son";
    this.setAttribute("aria-label", this.title);
    if (sonActif) jouerAlarme();
  };

  document.getElementById("btn-plein").onclick = function(){
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function(){});
  };

  document.getElementById("btn-quitter").onclick = deconnexionCuisine;
  document.getElementById("btn-deconnexion-attente").onclick = deconnexionCuisine;

  document.getElementById("btn-autoriser-notif").onclick = function(){
    Notification.requestPermission().then(function(){
      document.getElementById("bandeau-notif").hidden = true;
    });
  };

  /* remettre le titre normal quand le chef revient sur la page */
  window.addEventListener("focus", function(){ document.title = "Cuisine - KEI"; });
});
