# Site de commande en ligne — Restaurant KEI

Site web qui affiche le menu, laisse le client composer sa commande, et
l'envoie **directement sur l'écran de la cuisine**. Aucune application à
ouvrir, rien à installer côté client.

**HTML + CSS + JavaScript** pour le site, **Firebase** (offre gratuite, sans
carte bancaire) pour la base de données. L'hébergement est gratuit aussi.

Monnaie : **ariary (Ar)**, affiché sans centimes — `18 000 Ar`.

Trois pages :

| Page | Pour qui | À quoi ça sert |
|---|---|---|
| `index.html` | les clients | voir le menu et commander |
| `cuisine.html` | le chef | voir les commandes arriver, en direct |
| `admin.html` | le restaurant | modifier le menu, gérer les comptes |

---

## 1. Les fichiers

```
KEI/
├── connexion.html        ← LA PORTE D'ENTREE : une seule page de connexion
├── index.html            ← la page du menu (page principale)
├── admin.html            ← page protégée pour modifier le menu
├── cuisine.html          ← ÉCRAN CUISINE : les commandes en direct
├── manifest.json         ← pour installer l'écran cuisine sur un téléphone
├── sw.js                 ← service worker de l'écran cuisine
├── firebase-rules.json   ← règles de sécurité à coller dans Firebase
├── README.md             ← ce document
├── icones/               ← les icônes de l'application cuisine
├── css/
│   ├── style.css         ← mise en forme du site
│   └── cuisine.css       ← mise en forme de l'écran cuisine
└── js/
    ├── config.js         ← RÉGLAGES (nom, monnaie, horaires, livraison…)
    ├── menu.js           ← LE MENU (les plats et les prix)
    ├── firebase-config.js← LES CLÉS FIREBASE (à remplir)
    ├── kei-firebase.js   ← comptes, rôles, commandes, profils
    ├── notif.js          ← LA SONNETTE : notification sur le tel du chef
    ├── connexion.js      ← la page de connexion et l'aiguillage
    ├── comptes.js        ← profil du client et "Mes informations"
    ├── script.js         ← panier + précisions + envoi + n° de commande
    ├── cuisine.js        ← écran cuisine : alarme, cartes, statuts
    └── admin.js          ← espace restaurant : modification du menu
```

> **Firebase est obligatoire.** Tant que `js/firebase-config.js` n'est pas
> rempli, le site s'affiche mais aucune commande ne peut partir. La marche à
> suivre est en section 8.

---

## 2. À faire avant la mise en ligne

### a) Vérifier les réglages généraux

Dans `js/config.js` : le nom du restaurant, le slogan, la monnaie, les
horaires et l'adresse affichés en bas de page.

```js
nomRestaurant : "KEI",
devise        : "Ar",
decimales     : 0,        // l'ariary ne s'écrit pas avec des centimes
```

### b) Régler les frais de livraison

Toujours dans `js/config.js` : `fraisLivraison : 3000`.
Mettre `0` s'il n'y a pas de livraison.

### c) Changer les mots de passe administrateurs

Les comptes de l'équipe sont dans `js/admins.js`. Deux sont livrés :

| Identifiant | Mot de passe | Rôle |
|-------------|--------------|------|
| `yin`  | `kei2024`  | Propriétaire |
| `chef` | `chef2024` | Cuisine |

**Changez-les avant la mise en ligne.** Le plus simple : connectez-vous à
`admin.html`, section **Administrateurs**, créez les vrais comptes, cliquez
sur **Télécharger admins.js** et remplacez le fichier sur GitHub. Puis
supprimez les deux comptes d'exemple du fichier.

> ⚠️ Les mots de passe **administrateurs** sont vérifiés dans le navigateur,
> donc contournables. C'est assumé : `admin.html` ne modifie que l'affichage
> du menu, il n'y a aucune donnée personnelle derrière. Les comptes clients
> et le compte chef, eux, sont vérifiés par Firebase : ceux-là sont
> réellement protégés.

---

## 3. Les trois sortes de comptes

Les trois vivent au **même endroit** : Firebase Authentication. Ce n'est pas
le compte qui change, c'est le **rôle** qu'on lui donne.

### Deux questions différentes

| Question | Qui y répond |
|---|---|
| **Qui es-tu ?** | Firebase Authentication : identifiant + mot de passe |
| **Qu'as-tu le droit de faire ?** | la table `roles` dans la base |

C'est la distinction entre **authentification** et **autorisation**. Se
connecter ne donne aucun droit particulier : ça prouve seulement une
identité. Les droits viennent ensuite, du rôle attaché à cette identité.

### La table des rôles

```
roles
├── Mw6dr94C1cZVe3whIYLR2Dj4pod2 : "chef"
└── K7pQ2xLm9nRt4vWy8zAb3cDe5fGh : "admin"
```

| Rôle | Écrit dans `roles` | Ce qu'il peut |
|---|---|---|
| **Client** | rien du tout | commander, voir **ses** commandes, gérer son profil |
| **Chef** | `"chef"` | lire **toutes** les commandes, les marquer vues, les effacer |
| **Admin** | `"admin"` | ouvrir `admin.html` et modifier le menu |

Un compte sans entrée dans `roles` est un client. C'est le cas par défaut :
on ne donne un pouvoir que si on l'a écrit explicitement.

### Qui vérifie quoi, et où

C'est le point important pour le rapport.

Le **chef** est vérifié par les règles de sécurité, **sur les serveurs de
Google** :

```
".read": "auth != null && root.child('roles').child(auth.uid).val() === 'chef'"
```

Un client qui ouvrirait `cuisine.html` verrait un écran vide : Firebase
refuserait de lui envoyer les commandes. Ce n'est pas l'écran qui le bloque,
c'est le serveur. **Impossible à contourner.**

L'**admin** est vérifié dans le navigateur : `admin.js` lit son rôle et
ferme la page si ce n'est pas `"admin"`. Quelqu'un qui sait lire le code
pourrait forcer l'ouverture de la page — mais il ne gagnerait rien, parce
que `admin.html` ne fait que modifier l'affichage du menu **sur son propre
écran**. Il n'y a aucune donnée derrière.

Cette différence est volontaire : **on protège au serveur ce qui doit
vraiment l'être, et on se contente du navigateur là où il n'y a rien à
voler.**

### Personne ne peut se donner un rôle

La table `roles` n'est écrite nulle part dans le site : aucune ligne de code
n'y touche. Les règles ne l'autorisent en lecture qu'à son propriétaire, et
en écriture à personne. Elle ne se remplit que depuis la console Firebase,
donc uniquement par toi.

### Créer un compte

1. **Authentication → Users → Add user** : `prenom@kei.mg` + mot de passe.
   Voilà un client.
2. Pour en faire un chef ou un admin : copier son **User UID**, puis
   **Realtime Database → Data → `roles`** → ajouter `UID : "chef"` ou
   `UID : "admin"`.

Chacun se connecte en tapant seulement `prenom` : le site ajoute `@kei.mg`
tout seul. Le domaine se règle dans `js/config.js` (`domaineComptes`) et n'a
pas besoin d'exister vraiment.

---

## 4. Une seule page de connexion

Tout le monde entre par **`connexion.html`**. Les trois autres pages y
renvoient automatiquement si personne n'est connecté.

On y indique d'abord **quel compte on utilise** :

| Porte | Comptes concernés | Mène à |
|---|---|---|
| **Commander** | les comptes sans rôle | `index.html` |
| **Espace interne** | `chef` et `admin` | `cuisine.html` ou `admin.html` selon le rôle |

### Un compte = un rôle = une seule page

**Les comptes sont séparés selon leur type.** Le rôle décide de la seule
page où le compte a le droit d'aller, et une seule fonction tranche pour
tout le site : `pageDuRole()`, dans `js/kei-firebase.js`.

| Rôle | Sa page | Ce qu'il ne peut pas faire |
|---|---|---|
| *(aucun)* | `index.html` | entrer dans l'espace interne |
| `chef` | `cuisine.html` | commander |
| `admin` | `admin.html` | commander, ni voir la cuisine |

Le chef ne commande donc pas avec son compte de chef : s'il veut manger,
il lui faut un compte client, comme tout le monde.

Se tromper de porte ne déconnecte pas. Le site explique — *« Ce compte est
un compte interne : il ne sert pas à commander »* — et affiche le bouton
qui mène à la bonne page.

La séparation est vérifiée **à deux endroits**, pour qu'aucune adresse
tapée à la main ne la contourne :

1. à la connexion, dans `js/connexion.js` ;
2. à l'ouverture de chaque page — `js/comptes.js` pour la commande,
   `js/cuisine.js` pour la cuisine, `js/admin.js` pour la carte.

Et ce qui compte vraiment, les commandes, reste protégé **côté serveur**
par les règles Firebase : un client ne peut lire que les siennes, quoi
qu'il tape dans la barre d'adresse.

### Une seule session pour tout le site

Firebase garde **une seule identité** pour l'ensemble des pages. Si on se
connecte en `chef` sur l'écran cuisine puis qu'on ouvre `index.html`, le
bandeau affiche `chef` — parce qu'on *est* connecté en chef.

C'est pour ça que la connexion a été rassemblée en une page : avec trois
écrans séparés, on croyait changer de compte alors qu'on n'en changeait pas.
Pour changer réellement d'identité, il faut se déconnecter — le bouton
**Se connecter avec un autre compte** de la page de connexion le fait.

---

## 5. Le suivi de la commande

Chaque commande reçoit un numéro, par exemple `KEI-0109-031`
(`KEI` + jour/mois + compteur), affiché au client et repris en cuisine.

Une commande a **deux états** :

| État | En cuisine | Chez le client |
|---|---|---|
| `nouvelle` | bord rouge, **À TRAITER**, comptée dans le badge | « Commande reçue, en attente de la cuisine » |
| `vue` | bord vert, estompée, bouton ✓ Vue | « La cuisine a vu votre commande » |

Le chef appuie sur **Marquer comme vue**, et la ligne de suivi passe au vert
sur l'écran du client, en direct. Le bouton se désactive ensuite : on ne
revient pas en arrière.

Le badge rouge en haut de l'écran cuisine ne compte que les commandes
**non vues** — c'est le nombre de choses qui restent à faire.

Le client peut fermer la page : il retrouve ses commandes du jour en haut du
site, avec leur état à jour, et un bouton **Recommander** qui remet les mêmes
plats dans le panier.

### Ce que voit la cuisine

Les commandes **à traiter passent devant**, de la plus ancienne à la plus
récente : on sert dans l'ordre d'arrivée. Celles déjà vues descendent en
dessous.

Chaque carte affiche depuis combien de temps la commande attend
(*17h31 · il y a 4 min*), rafraîchi toutes les 30 secondes. **Passé dix
minutes sans être vue**, la durée passe au vermillon et clignote doucement :
en plein service, c'est l'information qui manque le plus.

### Mes commandes du jour, côté client

En haut du site, un bandeau vert **Mes commandes du jour** liste les commandes
passées depuis cet appareil : numéro, heure, total et état.

- Les commandes encore en cours ont un bord rouge et l'état
  *En attente de la cuisine*, qui passe au vert quand le chef appuie sur
  **Marquer comme vue**.
- Une fois effacées de la base, elles restent affichées avec la mention
  *Terminée*.
- Un clic sur une ligne rouvre son écran de suivi.

**La liste se vide toute seule chaque jour.** Il n'y a pas de minuterie qui
guette minuit : à chaque ouverture du site, on compare la date de chaque
commande à la date du jour, et on ne garde que celles d'aujourd'hui. C'est
plus simple et ça marche même si le site est resté fermé une semaine.

Cette liste vit dans le navigateur du client (`localStorage`, clé
`kei_historique`) : le restaurant n'y a pas accès, chaque client ne voit que
les siennes, et elle survit à l'effacement des commandes dans Firebase.

### Les commandes ne sont pas gardées

Passé **3 heures**, une commande est effacée de la base. Deux raisons : garder
l'écran cuisine lisible, et ne pas conserver le nom, le téléphone et l'adresse
des clients plus longtemps que nécessaire. C'est un bon argument à mettre dans
le rapport — on ne garde que ce dont on a besoin, et pas plus longtemps qu'il
ne faut.

Le délai se change dans `js/config.js` :

```js
heuresAvantSuppression : 3,
```

**Qui fait le ménage ?** L'écran cuisine, quand il est ouvert : une fois au
démarrage du service, puis toutes les dix minutes. Sans serveur, il n'y a
personne d'autre pour s'en charger. Si l'écran reste fermé plusieurs jours,
les commandes attendent et sont effacées à la prochaine ouverture.

Seule la cuisine connectée peut effacer : les règles de sécurité refusent la
suppression à tout le monde d'autre — testé et vérifié.

Il n'y a donc **pas d'historique des commandes**. Si tu en veux un un jour, il
faudrait les recopier ailleurs avant de les effacer.

---

## 6. Les précisions par plat

Dans le panier, chaque plat a sa propre case de texte
(*sans oignon, bien cuit, peu de piment…*). Ce qui est écrit apparaît en
dessous du plat concerné dans le récapitulatif reçu en cuisine :

```
*Commande :*
- 2 x Poulet roti  ...  36 000 Ar
   > sans piment, bien cuit
- 1 x Soda 33cl  ...  3 000 Ar
   > bien frais
```

Il reste en plus un champ **Remarque générale** en bas du formulaire, pour
ce qui concerne toute la commande (« appeler en arrivant »).

---

## 7. Les comptes clients

Pour commander, il faut se connecter. **Il n'y a pas d'inscription sur le
site** : les comptes sont créés par le restaurant dans la console Firebase
(voir section 3).

### Mes informations

Une fois connecté, le client a un bouton **Mes informations** en haut de la
page. Il y trouve deux formulaires :

**Mes coordonnées** — nom complet, téléphone, adresse de livraison
habituelle. Ces informations remplissent automatiquement le formulaire de
commande. Elles sont enregistrées dans `profils/{uid}`, et les règles
n'autorisent chacun qu'à lire et écrire **le sien**.

**Changer mon mot de passe** — le client tape son mot de passe actuel, puis
le nouveau deux fois. Le changement est réel et vaut sur **tous ses
appareils**, puisque c'est Firebase qui garde le mot de passe.

Le site redemande toujours le mot de passe actuel avant d'en changer. Ce
n'est pas une formalité : sans ça, quelqu'un qui trouverait un téléphone
déverrouillé pourrait changer le mot de passe sans le connaître et prendre
le compte.

L'identifiant, lui, ne peut pas être changé par le client — seulement dans
la console Firebase.

### Ce qui a changé, et pourquoi

Dans une première version, les comptes étaient écrits dans un fichier
`js/clients.js` avec leur mot de passe sous forme d'empreinte SHA-256. Ça
marchait, mais c'était fragile :

- le fichier étant public sur GitHub, l'empreinte d'un mot de passe courant
  se retrouve en quelques secondes ;
- la vérification se faisait dans le navigateur, donc contournable ;
- le client ne pouvait rien changer lui-même ;
- ajouter un client demandait de modifier un fichier et de le remettre en
  ligne.

Passer par Firebase Authentication règle les quatre d'un coup. C'est une
bonne illustration, pour le rapport, de ce qu'apporte un serveur : **la
vérification se fait à un endroit que le visiteur ne contrôle pas.**

---

## 8. Commander un plat qui n'est pas au menu

Tout en bas de la page, un encadré **« Une envie qui n'est pas au menu ? »**
permet au client d'écrire ce qu'il souhaite (avec une quantité), même si le
plat ne figure nulle part dans le menu. Un bouton **+ Hors menu** dans la
barre du haut y mène directement.

Comme le prix n'est pas connu :
- la demande apparaît dans le panier avec la mention **prix à confirmer** ;
- elle n'est **pas comptée dans le total** ;
- si la commande ne contient *que* du hors menu, le total affiche
  *à confirmer* au lieu de `0 Ar`.

En cuisine, ces demandes ont leur propre rubrique :

```
*Commande :*
- 1 x Riz cantonais  ...  15 000 Ar

*Hors menu (prix a confirmer) :*
- 1 x Gateau d'anniversaire
   > ecrire "Joyeux anniversaire Mialy"
- 2 x Riz blanc en supplement

*TOTAL : 15 000 Ar*
(hors demandes hors menu : merci d'indiquer leur prix)
```

C'est ensuite au restaurant de rappeler le client pour lui dire s'il peut le
préparer, et à quel prix — d'où le numéro de téléphone obligatoire.

---

## 9. Firebase : la liaison avec la cuisine

### À quoi ça sert

C'est Firebase qui porte la commande du site jusqu'à la cuisine. Le site
**écrit la commande dans une base en ligne** : rien ne s'ouvre, aucune
application n'est nécessaire, ça marche depuis n'importe quel navigateur.

En cuisine, `cuisine.html` affiche les commandes au fur et à mesure, avec un
son et une vibration à chaque nouvelle, et un bouton **Marquer comme vue**.

**Aucun montant n'apparaît sur l'écran cuisine** : ni les prix des plats, ni
les frais de livraison, ni le total. Le chef prépare des plats, pas des
additions. Les prix restent enregistrés dans la base, ils ne sont simplement
pas affichés — c'est `extraireDetail()` dans `js/cuisine.js` qui les retire.

> **Sans cette configuration, aucune commande ne peut partir.** Le site
> s'affiche normalement, mais le bouton d'envoi explique ce qu'il manque.
> C'est la seule étape obligatoire du projet.

### C'est gratuit ?

Oui. Le plan **Spark** de Firebase est gratuit et **ne demande aucune carte
bancaire**. Sans carte enregistrée, on ne peut pas être facturé : si les
quotas étaient dépassés, le service se mettrait en pause. Ces quotas se
comptent en dizaines de milliers d'opérations par jour, très au-dessus de ce
qu'un restaurant consomme.

### Étape 1 — Créer le projet

1. Aller sur **console.firebase.google.com** et se connecter avec un compte
   Google.
2. **Créer un projet** → nom : `kei` → continuer.
3. Google Analytics : **désactiver**, on n'en a pas besoin.
4. Attendre la création, puis **Continuer**.

### Étape 2 — Créer la base de données

1. Menu de gauche → **Créer** → **Realtime Database**.
   ⚠️ *Realtime Database*, pas *Firestore* : le code est écrit pour celle-là.
2. Emplacement : **europe-west1** (le plus proche de Madagascar parmi les
   choix courants).
3. Mode de démarrage : **mode verrouillé**. On mettra les vraies règles juste
   après.

### Étape 3 — Coller les règles de sécurité

1. Dans **Realtime Database**, onglet **Rules**.
2. Efface tout (Ctrl+A puis Suppr).
3. Colle le contenu du fichier **`firebase-rules.json`** de ton projet.
4. **Publish**.

Ce que ces règles disent, en français :

| Qui | Peut |
|---|---|
| Personne (non connecté) | rien du tout |
| Un client connecté | créer une commande à son nom, lire **ses** commandes, lire et écrire **son** profil |
| Le chef (UID déclaré dans les règles) | lire toutes les commandes, changer leur statut, les effacer |

Firebase affichera peut-être un avertissement orange. C'est normal : il
signale que certaines branches sont ouvertes en écriture aux utilisateurs
connectés, ce qui est exactement ce qu'on veut.

### Étape 4 — Créer les comptes

1. Menu de gauche → **Build** → **Authentication** → **Get started**.
2. Onglet **Sign-in method** → **Email/Password** → activer le **premier**
   interrupteur seulement → **Save**.
3. Onglet **Users** → **Add user**, une fois par compte :

| Email | Mot de passe | Qui |
|---|---|---|
| `chef@kei.mg` | 6 caractères minimum | la cuisine |
| `mialy@kei.mg` | 6 caractères minimum | une cliente |

Les adresses n'ont pas besoin d'exister. Chacun se connecte en tapant
seulement la partie avant le `@` : le site ajoute le reste.

### Étape 4 bis — Déclarer le chef dans les règles

Sans cette étape, le chef se connecte mais ne voit **aucune commande** : les
règles refusent la lecture à tout compte qui n'est pas déclaré.

1. **Authentication → Users** : sur la ligne de `chef@kei.mg`, copie l'**User
   UID** (colonne de droite, une suite comme `Mw6dr94C1cZVe3whIYLR2Dj4pod2`).
2. Ouvre `firebase-rules.json` et remplace l'UID qui s'y trouve par le tien.
   Il apparaît **trois fois**, dans la partie `commandes`.
3. Republie les règles : **Realtime Database → Rules**, tout effacer, coller,
   **Publish**.

C'est cette ligne qui donne les droits de la cuisine :

```
".read": "auth != null && auth.uid === 'Mw6dr94C1cZVe3whIYLR2Dj4pod2'"
```

> Si tu recrées le compte chef un jour, son UID change : il faudra refaire
> cette étape avec le nouveau, sinon l'écran cuisine restera vide.

### Étape 5 — Copier les clés dans le site

1. Roue crantée en haut à gauche → **Paramètres du projet**.
2. Descendre jusqu'à **Vos applications** → icône **`</>`** (Web).
3. Surnom : `site KEI` → **Enregistrer l'application**.
4. Firebase affiche un bloc `firebaseConfig`. Recopier les sept valeurs dans
   `js/firebase-config.js`, puis mettre :

```js
const FIREBASE_ACTIF = true;
```

5. Vérifier que `databaseURL` est bien présente. Si elle manque, la reprendre
   dans **Realtime Database**, en haut (elle finit par `.firebaseio.com`).

### Étape 6 — Tester

1. Ouvrir `cuisine.html`, se connecter avec `chef`.
2. Ouvrir `index.html` dans un autre onglet, se connecter avec un compte
   client, passer une commande.
3. Elle doit apparaître en cuisine **en moins d'une seconde**, avec le son.
4. Cliquer sur **Marquer comme vue** en cuisine : la ligne de suivi passe au
   vert côté client, en direct.

### Étape 7 — Installer l'écran cuisine sur le téléphone du chef

1. Ouvrir l'adresse de `cuisine.html` dans **Chrome** sur son téléphone.
2. Menu ⋮ → **Ajouter à l'écran d'accueil**. Une icône apparaît, la page
   s'ouvre en plein écran comme une application.
3. Se connecter une fois : il restera connecté.
4. Accepter les **notifications** quand le bandeau le propose.
5. Dans les réglages du téléphone, mettre l'écran en veille longue (ou
   jamais) pendant le service.

> **L'écran cuisine sonne seulement s'il est ouvert.** C'est pour ça qu'il y
> a une deuxième alerte, indépendante : la sonnette ntfy de la section 9, qui
> réveille le téléphone même quand tout est fermé.

---

## 10. La sonnette du chef

### Le problème

Firebase porte la commande jusqu'à l'écran cuisine, mais il ne peut pas
allumer un téléphone dont l'écran est éteint. Sans sonnette, le chef ne voit
la commande que s'il pense à regarder — donc il la rate.

### Pourquoi pas une notification par le navigateur

Ce serait la solution idéale : rien à installer, Chrome affiche la
notification tout seul. **Testé, ça ne marche pas** : le serveur de push de
Google refuse les envois venant d'une page web.

| Service de push | Requête depuis une page web |
|---|---|
| Chrome / Google | **bloquée** |
| Firefox | acceptée |

Ça ne fonctionnerait qu'avec Firefox sur le téléphone du chef, ce qui
reviendrait à installer une application de toute façon.

### La solution retenue : ntfy

[ntfy.sh](https://ntfy.sh) est un service libre et gratuit fait exactement
pour ça. Le site lui envoie une requête, l'application ntfy installée sur le
téléphone du chef affiche la notification — **même écran éteint, même
téléphone verrouillé**.

**Aucun compte à créer**, ni pour le site ni pour le chef. Le seul secret est
le nom du sujet, dans `js/notif.js` :

```js
sujet : "kei-7VVJIeWk2D-g",
```

### Installation sur le téléphone du chef

1. Installer **ntfy** depuis le Play Store (gratuit, sans compte).
2. Ouvrir ntfy → **+** → taper le nom du sujet ci-dessus → **S'abonner**.
3. Passer une commande de test depuis le site : la notification doit arriver
   en quelques secondes.

### Rendre la notification la plus visible possible

Le site envoie déjà la **priorité maximale (5)**, ce qui donne un bandeau en
haut de l'écran, un son et une vibration. Le reste se règle sur le
téléphone — ces réglages comptent autant que le code :

1. **Paramètres → Applications → ntfy → Notifications** : autoriser, mettre
   l'importance sur **Urgent**, cocher l'affichage en **pop-up** et sur
   l'**écran de verrouillage**.
2. **Paramètres → Applications → ntfy → Batterie** : mettre sur
   **Sans restriction**. Sur Xiaomi, Oppo, Huawei et Samsung, l'économiseur
   de batterie retarde ou bloque les notifications — c'est la cause numéro un
   des notifications qui n'arrivent pas.
3. **Ne pas déranger** : ajouter ntfy aux exceptions, sinon rien ne sonnera
   le soir.
4. Dans ntfy, sur l'abonnement : choisir un **son long et fort**, activer la
   vibration.
5. Garder le volume des notifications au maximum pendant le service.

### Ce que contient la notification

Uniquement le numéro de commande et le type :

```
NOUVELLE COMMANDE
KEI-0109-024  -  A emporter
```

**Aucune donnée personnelle** : ni nom, ni téléphone, ni adresse. C'est
volontaire, parce que le nom du sujet est visible dans le code du site.
Quelqu'un qui le trouverait pourrait envoyer de fausses notifications, mais
ne pourrait **pas** lire vos commandes : elles restent dans Firebase,
protégées par les règles de sécurité. Si des notifications indésirables
arrivent, changez le nom du sujet dans `js/notif.js` et refaites
l'abonnement.

En appuyant sur la notification, l'écran cuisine s'ouvre directement sur la
commande.

### Un rappel automatique ?

`js/notif.js` peut envoyer un second message quelques minutes plus tard
(`rappelMinutes`). Il est désactivé par défaut, parce qu'il part **quoi qu'il
arrive**, même si le chef a déjà vu la commande : ntfy ne sait pas annuler un
message programmé. Un chef qui reçoit des rappels inutiles finit par couper
les notifications, ce qui serait pire que le problème de départ.

---

## 11. Mettre le site en ligne (gratuit, avec GitHub Pages)

1. Créer un compte sur **github.com** (bouton *Sign up*).
   Un email est demandé une seule fois, à l'inscription. Ensuite la
   connexion se fait avec **identifiant + mot de passe**, depuis
   n'importe quel ordinateur.
2. Cliquer sur **+** en haut à droite → **New repository**.
3. Nom du dépôt : par exemple `kei-restaurant`. Cocher **Public**.
   Cliquer sur **Create repository**.
4. Sur la page du dépôt : **Add file** → **Upload files**.
   Glisser **tout le contenu du dossier KEI** (`index.html`, `admin.html`,
   et les dossiers `css` et `js`). Puis **Commit changes**.
5. Onglet **Settings** → menu de gauche **Pages**.
   Sous *Branch*, choisir **main** et **/ (root)**, puis **Save**.
6. Attendre 1 à 2 minutes, recharger la page : l'adresse du site s'affiche.

Elle ressemble à :

```
https://TON-IDENTIFIANT.github.io/kei-restaurant/
```

C'est cette adresse qu'on donne aux clients (ou qu'on met dans un QR code
posé sur les tables).

---

## 12. Modifier le menu plus tard

**Méthode simple (recommandée)** — modifier directement `js/menu.js` sur
GitHub : ouvrir le fichier, cliquer sur le crayon ✏️, modifier, puis
**Commit changes**. Le site est à jour en une minute.

**Méthode via l'espace restaurant** — aller sur `admin.html`, se connecter,
modifier les plats, cliquer sur **Télécharger menu.js**, puis remplacer le
fichier `js/menu.js` sur GitHub par celui qui vient d'être téléchargé.

> Les modifications faites dans `admin.html` sans télécharger le fichier
> ne sont visibles que **sur l'ordinateur utilisé** (elles sont stockées
> dans le navigateur). C'est normal : sans serveur, un site ne peut pas
> retenir des données pour tout le monde.

### Ajouter un administrateur

Même principe : `admin.html` → section **Administrateurs** → remplissez
identifiant, nom affiché, rôle et mot de passe → **Ajouter cet
administrateur** → **Télécharger admins.js** → remplacez `js/admins.js`
sur GitHub. Tant que le fichier n'est pas remplacé, le nouveau compte
n'existe que sur l'ordinateur où vous l'avez créé.

Le mot de passe n'apparaît nulle part dans le fichier téléchargé : seule
son empreinte SHA-256 y figure.

---

## 13. Comment ça marche (pour le rapport de projet)

1. `menu.js` contient les données du menu sous forme de **tableau d'objets**.
2. `script.js` parcourt ce tableau et **crée les éléments HTML** avec
   `document.createElement`.
3. Le panier est un **objet** `{ identifiant_du_plat : quantité }`, les
   précisions un second objet `{ identifiant_du_plat : "sans oignon" }`, et
   les demandes hors menu un **tableau** d'objets
   `{ texte, quantite, precision }` — un tableau plutôt qu'un objet, parce
   qu'une demande libre n'a pas d'identifiant pour servir de clé.
   Les boutons `+` et `−` les modifient, puis l'affichage est recalculé.
4. L'affichage des prix se fait avec une **expression régulière** qui place
   une espace tous les trois chiffres :
   `.replace(/\B(?=(\d{3})+(?!\d))/g, " ")` → `18000` devient `18 000`.
5. Au moment d'envoyer, on assemble un récapitulatif en texte, puis on
   l'écrit dans Firebase avec `push()`, qui fabrique un identifiant unique.
   C'est cet identifiant qui permet ensuite de suivre la commande.
6. `localStorage` sert à trois choses : le client connecté (`kei_session`),
   son téléphone et sa dernière adresse (`kei_profils`), et ses commandes du
   jour (`kei_historique`). Ces données restent sur l'appareil du client.
7. Les mots de passe sont comparés par leur **empreinte SHA-256**, calculée
   avec `crypto.subtle.digest`, jamais stockés en clair.

7. Avec Firebase, la commande est aussi écrite dans une base en ligne
   (`envoyerCommandeEnLigne`), et l'écran cuisine l'écoute avec
   `child_added` / `child_changed` : c'est le navigateur qui est prévenu par
   le serveur, sans avoir à redemander toutes les secondes.
8. Le son de l'alarme n'est pas un fichier : il est **synthétisé** par le
   navigateur avec l'API Web Audio (trois oscillateurs à 880, 1108 et
   1318 Hz).

### Limites assumées
- Pas de paiement en ligne.
- Pas de gestion des stocks. Côté restaurant, pas d'historique : les
  commandes sont effacées au bout de 3 heures. Côté client, l'historique du
  jour existe, mais seulement sur son propre appareil.
- Le prix des demandes hors menu ne peut pas être calculé automatiquement.
- Ajouter un client demande de passer par la console Firebase : il n'y a pas
  d'inscription automatique, c'est voulu.
- Les mots de passe du site (clients, administrateurs) sont vérifiés côté
  navigateur, donc contournables. Seul le compte cuisine, géré par Firebase
  Authentication, est réellement protégé.
- L'écran cuisine ne sonne que s'il est ouvert ; la notification ntfy prend
  le relais quand il est fermé.
- Le nom du sujet ntfy est visible dans le code : on peut envoyer de fausses
  notifications au chef, mais pas lire les commandes.
