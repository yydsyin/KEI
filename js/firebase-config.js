/* ============================================================
   CONFIGURATION FIREBASE  --  Restaurant KEI
   ------------------------------------------------------------
   Firebase est la base de donnees en ligne de Google. C'est
   elle qui porte la commande du site jusqu'a l'ecran de la
   cuisine, sans qu'aucune application ne soit necessaire.

   L'offre gratuite (plan Spark) suffit largement et ne demande
   AUCUNE carte bancaire.

   /!\ TANT QUE CE FICHIER N'EST PAS REMPLI, le site s'affiche
   normalement mais AUCUNE COMMANDE NE PEUT PARTIR : le bouton
   d'envoi explique alors ce qu'il manque.

   Comment remplir : voir le README, section "Firebase".
   ============================================================ */

/* ------------------------------------------------------------
   1. Mettre a true une fois que la configuration est remplie
   ------------------------------------------------------------ */
const FIREBASE_ACTIF = true;

/* ------------------------------------------------------------
   2. Les six valeurs copiees depuis la console Firebase
      (Parametres du projet > Vos applications > Configuration)

   Ces valeurs sont PUBLIQUES : elles sont faites pour etre
   visibles dans le code d'un site. Ce ne sont pas des mots de
   passe. La protection vient des REGLES DE SECURITE ecrites
   dans la console Firebase (voir firebase-rules.json).
   ------------------------------------------------------------ */
const FIREBASE_CONFIG = {
  apiKey            : "AIzaSyC7GM6L5F7MWjZ48hCjqlO8T8q9gmucCRA",
  authDomain        : "kei-commande-en-ligne.firebaseapp.com",
  databaseURL       : "https://kei-commande-en-ligne-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId         : "kei-commande-en-ligne",
  storageBucket     : "kei-commande-en-ligne.firebasestorage.app",
  messagingSenderId : "270729926657",
  appId             : "1:270729926657:web:89b580deaa522634f4c800"
};

/* ------------------------------------------------------------
   3. LES COMPTES
      Tous les comptes, clients comme chef, se creent dans la
      console Firebase : Authentication > Users > Add user.
      Ce qui distingue le chef, c'est son UID, ecrit dans les
      regles de securite : lui seul a le droit de lire la liste
      des commandes.
      Ces comptes n'ont rien a voir avec les administrateurs
      (js/admins.js), qui ne servent qu'a modifier le menu.
   ------------------------------------------------------------ */
const CHEF_EMAIL_EXEMPLE = "chef";   /* affiche dans le champ de l'ecran cuisine */
