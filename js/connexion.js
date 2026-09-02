/* ============================================================
   PAGE DE CONNEXION UNIQUE  --  Restaurant KEI
   ------------------------------------------------------------
   Une seule porte d'entree pour tout le site. On y choisit
   d'abord OU l'on veut aller, puis on se connecte.

   IMPORTANT : les comptes sont separes selon leur type. Un compte
   appartient a une seule porte, et le role decide laquelle :

   - pas de role -> compte client -> "Commander"      -> index.html
   - role "chef" -> compte interne -> "Espace interne" -> cuisine.html
   - role "admin"-> compte interne -> "Espace interne" -> admin.html

   Le chef ne peut donc pas commander avec son compte de chef, et
   un client ne peut pas entrer dans l'espace interne. Si l'on se
   trompe de porte, on n'est pas deconnecte : on nous montre
   simplement celle qui nous revient.

   C'est pageDuRole(), dans kei-firebase.js, qui tranche.
   ============================================================ */

let porteChoisie = "client";

/* La porte a laquelle un compte appartient, d'apres sa page. */
function porteDeLaPage(page){
  return page === "index.html" ? "client" : "interne";
}

/* Le nom du bouton qui mene a cette page. */
function titreDeLaPage(page){
  if (page === "cuisine.html") return "Ecran cuisine";
  if (page === "admin.html")   return "Gerer le menu";
  return "Commander";
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
  const page  = pageDuRole(await lireMonRole());
  const porte = porteDeLaPage(page);

  if (porte === porteChoisie) { location.href = page; return; }

  /* Mauvaise porte. Le mot de passe etait bon : on ne deconnecte
     pas, on explique et on montre la porte qui est la sienne. */
  erreur(porteChoisie === "client"
    ? "Ce compte est un compte interne : il ne sert pas a commander."
    : "Ce compte est un compte client : il n'a pas d'acces a l'espace interne.");
  afficherDejaConnecte();
}

/* ------------------------------------------------------------
   Quand quelqu'un est deja connecte, on lui montre sa porte
   plutot que de redemander un mot de passe. Un compte n'en a
   qu'une : il n'y a donc qu'un seul bouton.
   ------------------------------------------------------------ */
async function afficherDejaConnecte(){
  const u = utilisateurActuel();
  if (!u) return;

  document.getElementById("formulaire-connexion").hidden = true;
  document.getElementById("deja-connecte").hidden        = false;
  document.getElementById("deja-identifiant").textContent = identifiantCourt(u.email);

  const zone = document.getElementById("portes-disponibles");
  zone.innerHTML = "";

  const page = pageDuRole(await lireMonRole());
  ajouterPorte(zone, titreDeLaPage(page), page);
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
