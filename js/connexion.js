/* ============================================================
   PAGE DE CONNEXION UNIQUE  --  Restaurant KEI
   ------------------------------------------------------------
   Une seule porte d'entree pour tout le site. On y choisit
   d'abord OU l'on veut aller, puis on se connecte.

   IMPORTANT : le choix ne dit pas quel TYPE de compte on a.
   Un compte n'est pas "client" ou "interne" : c'est le meme
   compte partout. Le choix indique seulement la destination.

   - "Commander"      -> index.html, ouvert a tous les comptes
   - "Espace interne" -> cuisine.html si le role est "chef",
                         admin.html   si le role est "admin"

   Un compte sans role peut donc commander, mais pas entrer dans
   l'espace interne. Et le chef, s'il le veut, peut tres bien
   commander comme n'importe qui.
   ============================================================ */

let porteChoisie = "client";

/* Ou mene un role, dans l'espace interne ? */
function pageInterne(role){
  if (role === "chef")  return "cuisine.html";
  if (role === "admin") return "admin.html";
  return null;
}

function erreur(texte){
  document.getElementById("erreur-connexion").textContent = texte;
}

/* ------------------------------------------------------------
   Le choix de la porte
   ------------------------------------------------------------ */
function choisirPorte(nom){
  porteChoisie = nom;
  document.getElementById("porte-client").classList.toggle("actif",  nom === "client");
  document.getElementById("porte-interne").classList.toggle("actif", nom === "interne");
  erreur("");
}

/* ------------------------------------------------------------
   Apres une connexion reussie : ou envoie-t-on la personne ?
   ------------------------------------------------------------ */
async function allerAuBonEndroit(){
  if (porteChoisie === "client") {
    location.href = "index.html";
    return;
  }

  const role = await lireMonRole();
  const page = pageInterne(role);

  if (page) { location.href = page; return; }

  /* compte valide, mais sans role interne : on ne le deconnecte
     pas, on lui propose simplement d'aller commander. */
  erreur("Ce compte n'a pas d'acces a l'espace interne.");
  afficherDejaConnecte();
}

/* ------------------------------------------------------------
   Quand quelqu'un est deja connecte, on lui montre les portes
   qui lui sont ouvertes plutot que de redemander un mot de passe.
   ------------------------------------------------------------ */
async function afficherDejaConnecte(){
  const u = utilisateurActuel();
  if (!u) return;

  document.getElementById("formulaire-connexion").hidden = true;
  document.getElementById("deja-connecte").hidden        = false;
  document.getElementById("deja-identifiant").textContent = identifiantCourt(u.email);

  const zone = document.getElementById("portes-disponibles");
  zone.innerHTML = "";

  /* commander : ouvert a tout le monde */
  ajouterPorte(zone, "Commander", "index.html");

  /* l'espace interne, selon le role */
  const role = await lireMonRole();
  const page = pageInterne(role);
  if (page === "cuisine.html") ajouterPorte(zone, "Ecran cuisine", page);
  if (page === "admin.html")   ajouterPorte(zone, "Gerer le menu", page);
}

function ajouterPorte(zone, titre, page){
  const bouton = document.createElement("button");
  bouton.className = "btn-client porte-directe";
  bouton.textContent = titre;
  bouton.onclick = function(){ location.href = page; };
  zone.appendChild(bouton);
}

/* ------------------------------------------------------------
   Demarrage
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", function(){

  document.getElementById("logo-connexion").textContent = CONFIG.nomRestaurant;
  document.getElementById("suffixe-connexion").textContent = "@" + (CONFIG.domaineComptes || "kei.mg");

  if (!demarrerFirebase()) {
    erreur("Le site n'est pas relie a Firebase. Voir le README, section Firebase.");
    document.getElementById("btn-connexion").disabled = true;
    return;
  }

  /* on remet le dernier identifiant utilise : sur un telephone,
     retaper son nom a chaque commande est vite penible */
  const dernier = localStorage.getItem("kei_dernier_identifiant");
  if (dernier) {
    document.getElementById("identifiant").value = dernier;
    document.getElementById("motdepasse").focus();
  } else {
    document.getElementById("identifiant").focus();
  }

  document.getElementById("porte-client").onclick  = function(){ choisirPorte("client"); };
  document.getElementById("porte-interne").onclick = function(){ choisirPorte("interne"); };

  document.getElementById("btn-connexion").onclick = async function(){
    const bouton = this;
    const id  = document.getElementById("identifiant").value.trim();
    const mdp = document.getElementById("motdepasse").value;

    if (id === "" || mdp === "") { erreur("Remplissez les deux champs."); return; }

    bouton.disabled = true;
    erreur("");

    const r = await connecterCompte(id, mdp);

    if (!r.ok) {
      bouton.disabled = false;
      erreur(r.erreur);
      document.getElementById("motdepasse").value = "";
      return;
    }

    localStorage.setItem("kei_dernier_identifiant", id);
    await allerAuBonEndroit();
    bouton.disabled = false;
  };

  document.getElementById("motdepasse").addEventListener("keydown", function(e){
    if (e.key === "Enter") document.getElementById("btn-connexion").click();
  });

  document.getElementById("btn-changer-compte").onclick = function(){
    deconnecterCompte().then(function(){ location.reload(); });
  };

  /* deja connecte ? on propose directement les portes ouvertes */
  surConnexion(function(utilisateur){
    if (utilisateur) afficherDejaConnecte();
  });
});
