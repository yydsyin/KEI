/* ============================================================
   CONFIGURATION DU SITE  --  Restaurant KEI
   C'est le SEUL fichier a modifier pour les reglages generaux.
   ============================================================ */

const CONFIG = {

  // Nom affiche en haut du site
  nomRestaurant : "KEI",

  // Petite phrase sous le nom
  slogan : "Cuisine de saison, faite maison",

  // ---------------------------------------------------------
  // LE DOMAINE DES COMPTES
  // Firebase demande une adresse mail comme identifiant. Pour
  // eviter d'avoir a la taper en entier, le site ajoute lui-meme
  // "@" + ce domaine derriere l'identifiant.
  //   le client tape "yin"  ->  Firebase recoit "yin@kei.mg"
  // Ce domaine n'a pas besoin d'exister vraiment.
  // Il doit correspondre aux comptes crees dans la console.
  // ---------------------------------------------------------
  domaineComptes : "kei.mg",

  // ---------------------------------------------------------
  // LA MONNAIE : l'ariary malgache
  // devise    : ce qui s'ecrit apres le prix
  // decimales : 0 pour l'ariary (on n'ecrit pas de centimes)
  // ---------------------------------------------------------
  devise    : "Ar",
  decimales : 0,

  // Frais de livraison en ariary (mettre 0 s'il n'y en a pas)
  fraisLivraison : 3000,

  // ---------------------------------------------------------
  // DUREE DE VIE D'UNE COMMANDE, en heures.
  // Passe ce delai, la commande est effacee de la base par
  // l'ecran cuisine. Sert a ne pas garder les donnees des
  // clients plus longtemps que necessaire.
  // ---------------------------------------------------------
  heuresAvantSuppression : 3,

  // ---------------------------------------------------------
  // LA SONNERIE INSISTANTE DE LA CUISINE
  // Tant qu'une commande n'est pas marquee vue, l'ecran cuisine
  // resonne toutes les N secondes, comme un telephone qui sonne.
  // Mettre 0 pour ne sonner qu'une fois a l'arrivee.
  // ---------------------------------------------------------
  secondesEntreRappels : 20,

  // Horaires affiches en bas de page
  horaires : "Du mardi au dimanche &middot; 11h00-14h00 &middot; 18h00-22h00",

  // Adresse affichee en bas de page
  adresse : "Antananarivo"
};
