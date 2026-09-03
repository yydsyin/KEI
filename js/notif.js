/* ============================================================
   LA SONNETTE DU CHEF  --  Restaurant KEI
   ------------------------------------------------------------
   Firebase porte la commande jusqu'a l'ecran cuisine, mais il ne
   peut pas reveiller un telephone dont l'ecran est eteint.
   C'est le role de ce fichier : envoyer une notification qui
   s'affiche meme quand tout est ferme.

   On utilise ntfy.sh, un service libre et gratuit. Le site lui
   envoie une simple requete ; l'application ntfy installee sur
   le telephone du chef affiche la notification.

   AUCUN COMPTE n'est necessaire, ni pour le site ni pour le chef.
   Le seul secret est le nom du sujet, ci-dessous.
   ============================================================ */

/* ------------------------------------------------------------
   REGLAGES
   ------------------------------------------------------------ */
const NTFY = {

  /* Mettre a false pour couper les notifications */
  actif : true,

  /* Le "sujet" : une adresse secrete que seul le chef connait.
     Le chef s'abonne a ce nom dans l'application ntfy.

     /!\ Ce nom est visible dans le code du site. Quelqu'un qui
     le trouve pourrait envoyer de fausses notifications au chef.
     Il ne pourrait PAS lire vos commandes : elles restent dans
     Firebase, protegees par les regles de securite.
     Si vous recevez des notifications indesirables, changez ce
     nom ici et refaites l'abonnement sur le telephone. */
  sujet : "kei-7VVJIeWk2D-g",

  /* Priorite 5 = maximum : notification en haut de l'ecran,
     son, vibration, affichage sur ecran verrouille. */
  priorite : 5,

  /* Rappel automatique si le chef n'a rien vu.
     ATTENTION : ce rappel part quoi qu'il arrive, meme si le chef
     a deja vu la commande, car ntfy ne sait pas l'annuler.
     Mettre 0 pour ne pas en envoyer. */
  rappelMinutes : 0
};

/* ------------------------------------------------------------
   Envoyer la sonnette
   Ne bloque jamais la commande : si la notification echoue,
   la commande est deja enregistree dans Firebase.
   ------------------------------------------------------------ */
function prevenirLeChef(commande){
  if (!NTFY.actif || !NTFY.sujet) return Promise.resolve(false);

  /* l'adresse de l'ecran cuisine, pour que le chef y arrive
     d'un seul appui sur la notification */
  let lienCuisine = "";
  try { lienCuisine = new URL("cuisine.html", location.href).href; } catch (e) {}

  /* On reste bref et on ne met AUCUNE donnee personnelle :
     ni nom, ni telephone, ni adresse. Le detail est en cuisine. */
  const resume = [commande.numero, commande.mode].join("  -  ");

  const enTetes = {
    "Title"    : "NOUVELLE COMMANDE",
    "Priority" : String(NTFY.priorite),
    "Tags"     : "bell"
  };
  if (lienCuisine.indexOf("http") === 0) {
    /* Appuyer n'importe ou sur la notification ouvre la cuisine. */
    enTetes["Click"] = lienCuisine;

    /* Et un vrai bouton, sous le texte de la notification.
       Le "clear=true" est l'essentiel : il FERME la notification
       en meme temps qu'il ouvre l'ecran cuisine. Sans lui, si le
       chef a choisi "Conserver les notifications" dans ntfy, le
       telephone continue de sonner jusqu'a ce qu'on aille la
       balayer a la main.
       Format impose par ntfy :  action, libelle, parametres... */
    enTetes["Actions"] = "view, Ouvrir la cuisine, " + lienCuisine + ", clear=true";
  }

  const envois = [ envoyerNtfy(enTetes, resume) ];

  /* le rappel differe, si le restaurant en veut un */
  if (NTFY.rappelMinutes > 0) {
    const enTetesRappel = Object.assign({}, enTetes, {
      "Title" : "Commande toujours en attente ?",
      "Delay" : NTFY.rappelMinutes + "min"
    });
    envois.push(envoyerNtfy(enTetesRappel, resume));
  }

  return Promise.all(envois).then(function(resultats){
    return resultats[0];
  });
}

/* Une requete vers ntfy. Renvoie true si elle est passee. */
function envoyerNtfy(enTetes, corps){
  return fetch("https://ntfy.sh/" + NTFY.sujet, {
    method  : "POST",
    headers : enTetes,
    body    : corps
  }).then(function(rep){
    if (!rep.ok) console.warn("Notification refusee, statut " + rep.status);
    return rep.ok;
  }).catch(function(e){
    /* pas de reseau, service indisponible... la commande est
       quand meme partie dans Firebase */
    console.warn("Notification non envoyee :", e.message);
    return false;
  });
}
