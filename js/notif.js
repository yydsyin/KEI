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

  /* ---------- LES RAPPELS ----------
     ntfy ne sonne qu'une fois par message, et seule l'application
     ntfy peut faire taire un message qui insiste. Pour que le
     telephone insiste SANS qu'on ait a ouvrir ntfy, c'est donc le
     site qui renvoie un nouveau message tant que la commande n'a
     pas ete vue. Chaque message sonne une fois et se tait tout
     seul ; c'est leur repetition qui reveille.

     Le rappel s'arrete a la seconde ou la cuisine appuie sur
     "Marquer comme vue" : le site suit le statut en direct.

     Mettre 0 pour ne plus envoyer aucun rappel. */
  secondesEntreRappels : 30,

  /* Garde-fou, et il est indispensable.

     ntfy.sh gratuit accepte 250 messages par jour et par adresse
     IP. Au-dela il repond 429 et n'envoie plus RIEN : ni rappel,
     ni meme la premiere alerte d'une nouvelle commande. Le chef
     ne serait alors plus prevenu du tout, sans que personne s'en
     apercoive.

     20 rappels = 10 minutes de sonnerie, soit 21 messages au pire
     pour une commande jamais vue. Il faudrait donc onze commandes
     entierement ignorees dans la meme journee pour epuiser le
     quota. Une commande vue en deux minutes n'en coute que cinq.

     Passe dix minutes, de toute facon, le telephone n'est pas
     pres de quelqu'un : insister davantage n'aiderait pas. */
  rappelsMaximum : 20
};

/* ------------------------------------------------------------
   Envoyer la sonnette
   Ne bloque jamais la commande : si la notification echoue,
   la commande est deja enregistree dans Firebase.
   ------------------------------------------------------------ */
function prevenirLeChef(commande, estUnRappel){
  if (!NTFY.actif || !NTFY.sujet) return Promise.resolve(false);

  /* l'adresse de l'ecran cuisine, pour que le chef y arrive
     d'un seul appui sur la notification */
  let lienCuisine = "";
  try { lienCuisine = new URL("cuisine.html", location.href).href; } catch (e) {}

  /* On reste bref et on ne met AUCUNE donnee personnelle :
     ni nom, ni telephone, ni adresse. Le detail est en cuisine. */
  const resume = [commande.numero, commande.mode].join("  -  ");

  const enTetes = {
    "Title"    : estUnRappel ? "COMMANDE TOUJOURS EN ATTENTE" : "NOUVELLE COMMANDE",
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

  return envoyerNtfy(enTetes, resume);
}

/* ------------------------------------------------------------
   LES RAPPELS JUSQU'A CE QUE LA COMMANDE SOIT VUE
   ------------------------------------------------------------ */
let minuterieRappels = null;
let rappelsFaits     = 0;

function demarrerRappels(commande){
  arreterRappels();

  if (!NTFY.actif || !NTFY.sujet) return;
  if (!NTFY.secondesEntreRappels || NTFY.secondesEntreRappels <= 0) return;

  rappelsFaits = 0;

  minuterieRappels = setInterval(function(){

    /* le garde-fou : au bout de rappelsMaximum, on renonce */
    if (rappelsFaits >= NTFY.rappelsMaximum) { arreterRappels(); return; }
    rappelsFaits++;

    prevenirLeChef(commande, true).then(function(passe){
      /* ntfy a refuse : service gratuit sature, plus de reseau...
         Inutile d'insister contre un mur, et surtout inutile de
         s'acharner sur un service qui nous dit non. */
      if (!passe) arreterRappels();
    });

  }, NTFY.secondesEntreRappels * 1000);
}

function arreterRappels(){
  if (minuterieRappels) {
    clearInterval(minuterieRappels);
    minuterieRappels = null;
  }
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
