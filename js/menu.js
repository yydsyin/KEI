/* ============================================================
   LE MENU DU RESTAURANT
   ------------------------------------------------------------
   /!\ MENU D'EXEMPLE /!\  (prix en ariary)
   Il sera remplace par le vrai menu de KEI.

   Structure : une liste de categories.
   Chaque categorie contient une liste de plats.
   Chaque plat a : un id unique, un nom, une description, un prix.
   ============================================================ */

const MENU = [
  {
    categorie : "Entrees",
    plats : [
      { id:"e1", nom:"Salade de saison",   desc:"Legumes frais du marche",       prix:6000 },
      { id:"e2", nom:"Soupe du jour",      desc:"Preparee chaque matin",         prix:5000 },
      { id:"e3", nom:"Samboussas (x4)",    desc:"Farcis viande ou legumes",      prix:4000 }
    ]
  },
  {
    categorie : "Plats",
    plats : [
      { id:"p1", nom:"Poulet roti",        desc:"Accompagne de riz",             prix:18000 },
      { id:"p2", nom:"Riz cantonais",      desc:"Riz saute, oeuf, legumes",      prix:15000 },
      { id:"p3", nom:"Poisson du jour",    desc:"Selon arrivage, legumes",       prix:22000 },
      { id:"p4", nom:"Mine sao",           desc:"Nouilles sautees",              prix:14000 }
    ]
  },
  {
    categorie : "Desserts",
    plats : [
      { id:"d1", nom:"Gateau au chocolat", desc:"Fait maison",                   prix:7000 },
      { id:"d2", nom:"Salade de fruits",   desc:"Fruits de saison",              prix:6000 },
      { id:"d3", nom:"Glace (2 boules)",   desc:"Vanille, chocolat ou fraise",   prix:5000 }
    ]
  },
  {
    categorie : "Boissons",
    plats : [
      { id:"b1", nom:"Eau minerale 50cl",  desc:"Plate ou gazeuse",              prix:2000 },
      { id:"b2", nom:"Soda 33cl",          desc:"Cola, limonade, orange",        prix:3000 },
      { id:"b3", nom:"Jus naturel",        desc:"Presse du jour",                prix:5000 },
      { id:"b4", nom:"Cafe",               desc:"Expresso",                      prix:2500 }
    ]
  }
];
