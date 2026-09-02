/* ============================================================
   SERVICE WORKER  --  page cuisine du restaurant KEI
   ------------------------------------------------------------
   Un service worker est un petit programme que le navigateur
   garde en memoire. Ici il sert a deux choses :
   1. rendre la page installable sur l'ecran d'accueil ;
   2. garder en cache les fichiers du site, pour que la page
      cuisine s'ouvre meme avec une connexion faible.

   Les commandes, elles, viennent toujours du reseau : on ne les
   met jamais en cache, sinon le chef verrait des commandes
   perimees.
   ============================================================ */

const CACHE = "kei-cuisine-v1";

const FICHIERS = [
  "cuisine.html",
  "css/style.css",
  "css/cuisine.css",
  "js/config.js",
  "js/firebase-config.js",
  "js/kei-firebase.js",
  "js/cuisine.js",
  "icones/icone-192.png",
  "icones/icone-512.png"
];

/* A l'installation : on met les fichiers de cote */
self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE)
          .then(function(c){ return c.addAll(FICHIERS); })
          .then(function(){ return self.skipWaiting(); })
  );
});

/* A l'activation : on supprime les anciennes versions du cache */
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(noms){
      return Promise.all(noms.map(function(n){
        if (n !== CACHE) return caches.delete(n);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* A chaque requete : le reseau d'abord, le cache en secours */
self.addEventListener("fetch", function(e){
  const url = e.request.url;

  /* jamais de cache pour Firebase : il faut les vraies donnees */
  if (url.indexOf("firebaseio.com")   !== -1 ||
      url.indexOf("googleapis.com")   !== -1 ||
      url.indexOf("firebaseapp.com")  !== -1) return;

  if (e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request)
      .then(function(reponse){
        /* on garde une copie a jour */
        const copie = reponse.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copie); });
        return reponse;
      })
      .catch(function(){ return caches.match(e.request); })
  );
});
