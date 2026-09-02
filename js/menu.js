/* ============================================================
   LE MENU DU RESTAURANT KEI
   ------------------------------------------------------------
   Prix en ariary, sans centimes.

   Structure : une liste de categories.
   Chaque categorie contient une liste de plats.
   Chaque plat a : un id unique, un nom, une description, un prix.

   Un plat peut aussi avoir des CHOIX (les "sous-options") :

     choix : [
       { nom:"Garniture", options:[ {nom:"Poulet"}, {nom:"Jambon"} ] }
     ]

   Le client doit choisir une option par groupe avant de pouvoir
   ajouter le plat. Une option peut couter un supplement :
   { nom:"Poulet", supplement:500 }. Sans supplement, c'est 0.

   Pour l'instant tout est dans une seule categorie : les vraies
   categories seront confirmees aupres du chef. Quand il n'y en a
   qu'une, le site n'affiche pas son titre.
   ============================================================ */

const MENU = [
  {
    categorie : "La carte",
    plats : [

      { id:"k1",  nom:"Riz cantonnais",                 desc:"", prix:7000,
        choix:[ { nom:"Viande", options:[ {nom:"Poulet"}, {nom:"Bœuf"} ] } ] },

      { id:"k2",  nom:"Misao",                          desc:"", prix:7000,
        choix:[ { nom:"Garniture", options:[ {nom:"Bœuf"}, {nom:"Œuf"}, {nom:"Poulet"} ] } ] },

      { id:"k3",  nom:"Frites + poulet frit",            desc:"", prix:7000 },
      { id:"k4",  nom:"Riz + boulettes de viande sauce", desc:"", prix:7000 },
      { id:"k5",  nom:"Riz + bœuf sauce",               desc:"", prix:7000 },
      { id:"k6",  nom:"Riz + poulet sauce curry",       desc:"", prix:7000 },

      { id:"k7",  nom:"Pâtes sèches",                  desc:"", prix:7000,
        choix:[ { nom:"Garniture", options:[ {nom:"Bœuf"}, {nom:"Œuf"}, {nom:"Poulet"} ] } ] },

      { id:"k8",  nom:"Riz + bœuf avec carotte",        desc:"", prix:7000 },
      { id:"k9",  nom:"Riz + ailes de poulet sauce",    desc:"", prix:8000 },

      { id:"k10", nom:"Nem",                            desc:"À l'unité", prix:1500 },
      { id:"k11", nom:"Sambos",                         desc:"À l'unité", prix:1500 },

      { id:"k12", nom:"Panini",                         desc:"", prix:7000,
        choix:[ { nom:"Garniture", options:[ {nom:"Poulet"}, {nom:"Jambon"} ] } ] },

      { id:"k13", nom:"Sandwich",                       desc:"", prix:7000,
        choix:[ { nom:"Garniture", options:[ {nom:"Poulet"}, {nom:"Jambon"} ] } ] },

      { id:"k14", nom:"Frites",                         desc:"", prix:2500,
        choix:[ { nom:"Sauce", options:[ {nom:"Ketchup"}, {nom:"Mayonnaise"} ] } ] }

    ]
  }
];
