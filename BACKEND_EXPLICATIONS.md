# BuildFlow — Comment le backend a été construit

---

## 1. C'est quoi un backend ?

Le **frontend** (Angular), c'est ce que l'utilisateur voit dans son navigateur.  
Le **backend**, c'est le serveur caché derrière : il reçoit les demandes du frontend, interroge la base de données, et renvoie les données.

```
Navigateur (Angular)  →  envoie une requête  →  Backend (Express)  →  lit/écrit  →  Base de données (PostgreSQL)
Navigateur (Angular)  ←  reçoit les données  ←  Backend (Express)  ←────────────────────────────────────────────
```

---

## 2. La stack technique

| Technologie | Rôle | Analogie simple |
|---|---|---|
| **Node.js** | Moteur d'exécution — fait tourner le code JavaScript côté serveur | Le moteur d'une voiture |
| **Express** | Framework web — gère les routes et les requêtes HTTP | Le volant de la voiture |
| **PostgreSQL** | Base de données relationnelle — stocke toutes les données | Le disque dur de l'app |
| **Prisma** | ORM — fait le lien entre le code TypeScript et la base de données | Un traducteur entre TypeScript et SQL |
| **JWT** | Token d'authentification — prouve qu'un utilisateur est bien connecté | Un badge d'accès |
| **bcryptjs** | Hachage des mots de passe — transforme un mot de passe en code illisible | Un coffre-fort |

---

## 3. Structure du projet

```
buildflow-api/
│
├── prisma/
│   ├── schema.prisma     ← Définition des 16 tables de la base de données
│   └── seed.ts           ← Script pour insérer des données de test
│
├── src/
│   ├── index.ts          ← Point d'entrée — démarre le serveur
│   ├── app.ts            ← Configure Express + branche toutes les routes
│   ├── prisma.ts         ← Instance unique du client Prisma (connexion BDD)
│   │
│   ├── middleware/
│   │   └── auth.middleware.ts    ← Vérifie le JWT à chaque requête
│   │
│   └── routes/
│       ├── auth.routes.ts        ← POST /api/auth/login
│       ├── utilisateurs.routes.ts
│       ├── clients.routes.ts
│       ├── contrats.routes.ts
│       ├── chantiers.routes.ts   ← inclut budget S0
│       ├── terrain.routes.ts     ← rapports + pointages
│       ├── facturation.routes.ts ← situations + encaissements
│       ├── comptabilite.routes.ts ← bilan + clôture
│       └── documents.routes.ts
│
├── .env                  ← Variables secrètes (mot de passe BDD, clé JWT...)
├── package.json          ← Liste des dépendances npm
└── tsconfig.json         ← Configuration TypeScript
```

---

## 4. La base de données — Prisma et le schema.prisma

### 4.1 C'est quoi Prisma ?

Sans Prisma, pour lire des données on écrirait du SQL brut :
```sql
SELECT * FROM chantiers WHERE tenant_id = '...' AND statut = 'en_cours';
```

Avec Prisma, on écrit du TypeScript :
```typescript
prisma.chantier.findMany({ where: { tenant_id: '...', statut: 'en_cours' } })
```

Prisma traduit automatiquement en SQL. On a aussi **l'autocomplétion** et la **vérification de types**.

### 4.2 Le schema.prisma — comment on définit une table

Chaque `model` dans `schema.prisma` correspond à une table dans PostgreSQL.

**Exemple — la table Chantier :**
```prisma
model Chantier {
  id                    Int      @id @default(autoincrement())  // clé primaire auto-incrémentée
  tenant_id             String                                   // identifiant de l'entreprise
  nom_chantier          String
  statut                StatutChantier @default(en_cours)       // enum : en_cours, termine, suspendu, cloture
  avancement_global     Float    @default(0)
  date_livraison_prevue DateTime

  budget    Budget?      // relation 1-1 avec Budget (le ? = facultatif)
  corps_etat CorpsEtat[] // relation 1-N avec CorpsEtat (tableau)
}
```

### 4.3 Les migrations

Une **migration** c'est le script SQL généré automatiquement par Prisma quand on modifie le schema.  
On ne touche **jamais** la base de données à la main — on modifie `schema.prisma` et on lance :

```bash
npx prisma migrate dev --name init
```

Prisma génère le SQL, le joue sur la base, et garde un historique dans `prisma/migrations/`.

### 4.4 Les 20 tables du projet

Le schema contient **20 tables** au total — 18 tables métier et 2 tables de jonction (pivot).

| # | Table | Type | Rôle |
|---|---|---|---|
| 1 | `entreprises` | Système | Une ligne = une entreprise BTP cliente (tenant multi-tenant) |
| 2 | `utilisateurs` | Système | Comptes de connexion (admin, conducteur, chef, comptable) |
| 3 | `clients` | Métier | Clients de l'entreprise BTP (particuliers ou sociétés) |
| 4 | `contrats` | Métier | Contrats signés avec les clients (marchés de travaux) |
| 5 | `modifications` | Métier | Avenants aux contrats (montant et délai supplémentaires) |
| 6 | `chantiers` | Métier ⭐ | Entité centrale — chaque chantier est lié à un contrat |
| 7 | `budgets` | Gestion | Budget S0 figé (créé une seule fois, non modifiable) |
| 8 | `plannings` | Gestion | Planning de réalisation du chantier (dates prévues) |
| 9 | `jalons` | Gestion | Dates clés du planning (atteint, manqué, en attente) |
| 10 | `corps_etat` | Gestion | Lots de travaux (maçonnerie, plomberie, électricité…) |
| 11 | `intervenants` | Gestion | Sous-traitants affectés à chaque corps d'état |
| 12 | `ressources` | Gestion | Matériaux, matériels et main d'œuvre |
| 13 | `rapports_terrain` | Suivi | Rapports journaliers du chef de chantier |
| 14 | `corps_etat_rapports` | **Jonction** | Lie un rapport aux lots de travaux traités ce jour-là |
| 15 | `pointages` | Suivi | En-tête du pointage journalier (totaux par jour) |
| 16 | `pointage_intervenants` | **Jonction** | Détail par ouvrier : présence, heures, observations |
| 17 | `situations` | Facturation | Factures d'avancement (situations de travaux) |
| 18 | `paiements` | Facturation | Encaissements liés à chaque situation |
| 19 | `documents` | Documents | Fichiers référencés (plans, PV, photos, contrats…) |
| 20 | `clotures` | Workflow | Clôture finale en 2 étapes (comptable → admin) |

**Pourquoi 20 et non 16 ou 18 ?** Les deux erreurs de comptage précédentes omettaient les tables de jonction `corps_etat_rapports` et `pointage_intervenants`, qui ne stockent pas d'entités métier mais relient deux tables dans des relations plusieurs-à-plusieurs.

---

## 5. Express — Comment les routes fonctionnent

### 5.1 Structure d'une route

Chaque route correspond à une URL + une méthode HTTP :

| Méthode | Action | Exemple |
|---|---|---|
| `GET` | Lire des données | `GET /api/chantiers` → liste des chantiers |
| `POST` | Créer une donnée | `POST /api/clients` → créer un client |
| `PUT` | Modifier entièrement | `PUT /api/clients/1` → modifier le client 1 |
| `PATCH` | Modifier partiellement | `PATCH /api/chantiers/1/statut` → changer juste le statut |
| `DELETE` | Supprimer | `DELETE /api/documents/5` → supprimer le document 5 |

### 5.2 Anatomie d'une route Express

```typescript
// GET /api/chantiers — lister tous les chantiers de l'entreprise connectée
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {

  // 1. On récupère les données — uniquement celles du bon tenant
  const chantiers = await prisma.chantier.findMany({
    where: { tenant_id: req.user!.tenant_id },  // isolation multi-tenant
    include: { budget: true, corps_etat: true }, // on joint les tables liées
  });

  // 2. On renvoie en JSON
  res.json(chantiers);
});
```

### 5.3 Comment les routes sont branchées dans app.ts

```typescript
// Chaque groupe de routes a son propre préfixe
app.use('/api/auth',         authRoutes);       // → /api/auth/login
app.use('/api/chantiers',    chantierRoutes);   // → /api/chantiers, /api/chantiers/:id
app.use('/api/terrain',      terrainRoutes);    // → /api/terrain/rapports
// etc.
```

---

## 6. L'authentification JWT

### 6.1 C'est quoi un JWT ?

Un JWT (JSON Web Token) est une chaîne de caractères encodée qui contient des informations sur l'utilisateur connecté. Il est généré au login et envoyé dans chaque requête suivante.

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBidHAtYWJpLmNpIiwicm9sZSI6ImFkbWluIiwidGVuYW50X2lkIjoiN2ZlMTZjOWUifQ.signature
     ↑ header                    ↑ payload (données)                                                                              ↑ signature
```

Le payload décodé contient :
```json
{
  "id": 1,
  "email": "admin@btp-abi.ci",
  "role": "admin",
  "tenant_id": "7fe16c9e-ee67-429a-aef1-53e9a8558ff8"
}
```

### 6.2 Flux de connexion

```
1. Utilisateur envoie  →  POST /api/auth/login  { email, mot_de_passe }
2. Backend vérifie le mot de passe avec bcrypt
3. Si correct → génère un JWT signé avec JWT_SECRET
4. Renvoie le token au frontend
5. Le frontend stocke le token (localStorage)
6. Pour chaque requête suivante → envoie le token dans le header :
   Authorization: Bearer eyJhbGci...
```

### 6.3 Le middleware auth — vérification du token

Ce code s'exécute **avant** chaque route protégée :

```typescript
export function authMiddleware(req, res, next) {
  // 1. Lire le token dans le header
  const token = req.headers.authorization?.split(' ')[1];

  // 2. Vérifier la signature avec JWT_SECRET
  const payload = jwt.verify(token, process.env.JWT_SECRET);

  // 3. Attacher les infos utilisateur à la requête
  req.user = payload; // { id, email, role, tenant_id }

  // 4. Passer à la route suivante
  next();
}
```

### 6.4 Les mots de passe — bcrypt

Les mots de passe ne sont **jamais stockés en clair** dans la base de données.  
bcrypt transforme `"Buildflow2026!"` en `"$2b$10$xK9mZqL..."` — un hash irréversible.

```typescript
// Au moment de créer un compte
const hash = await bcrypt.hash("Buildflow2026!", 10);
// hash = "$2b$10$..." → c'est ce qu'on stocke en base

// Au moment du login
const ok = await bcrypt.compare("Buildflow2026!", hash);
// ok = true → l'utilisateur a saisi le bon mot de passe
```

---

## 7. L'architecture multi-tenant

### 7.1 Le problème

Plusieurs entreprises utilisent la même application et la même base de données.  
L'entreprise A ne doit **jamais** voir les données de l'entreprise B.

### 7.2 La solution : tenant_id

Chaque entreprise a un `tenant_id` unique (UUID généré automatiquement).  
Ce champ est présent sur **toutes les tables**.

```
Entreprise A → tenant_id = "7fe16c9e-..."
Entreprise B → tenant_id = "a3c8f201-..."
```

Quand l'entreprise A se connecte, son JWT contient `tenant_id = "7fe16c9e-..."`.  
**Chaque requête filtre automatiquement par ce tenant_id :**

```typescript
// L'utilisateur connecté ne peut voir QUE ses propres chantiers
prisma.chantier.findMany({
  where: { tenant_id: req.user.tenant_id }  // ← filtre automatique
})
```

---

## 8. Les règles métier implémentées

### 8.1 Budget S0 figé
Le budget initial ne peut être créé qu'**une seule fois**. Si on essaie de le recréer :
```typescript
const existant = await prisma.budget.findUnique({ where: { id_chantier } });
if (existant) {
  res.status(409).json({ message: 'Budget S0 déjà défini — il est figé' });
  return;
}
```

### 8.2 Avancement global calculé automatiquement
L'avancement global d'un chantier est la moyenne pondérée des corps d'état :
```
Avancement global = Σ (part_chantier × avancement_corps_état) / 100
```
Ce calcul est déclenché automatiquement quand un rapport terrain est soumis.

### 8.3 Alerte dépassement budget (> 5%)
Si le coût réel dépasse le déboursé sec prévu de plus de 5%, une alerte est activée :
```typescript
alerte: cout_reel > budget.debourse_sec_estime * 1.05
```

### 8.4 Clôture séquentielle
La clôture d'un chantier se fait en **2 étapes obligatoires** :
1. Le **Comptable** valide le bilan → `statut = 'bilan_valide'`
2. L'**Admin** clôture officellement → `statut = 'cloture'`

L'Admin ne peut pas clôturer si le Comptable n'a pas validé. Cette règle est vérifiée côté serveur.

### 8.5 Encaissements — mise à jour automatique du RAF
Quand un paiement est enregistré, le reste à facturer est recalculé automatiquement :
```typescript
const nouveau_encaisse = situation.montant_encaisse + montant_paiement;
const reste = situation.montant_ttc - nouveau_encaisse;
const statut = reste <= 0 ? 'payee' : 'en_attente';
```

### 8.6 Corps d'état — contrôle de la somme des parts (≤ 100 %)
Avant d'ajouter un corps d'état, le backend vérifie que la somme des `part_chantier` de tous les lots existants n'excède pas 100 % :
```typescript
const existants = await prisma.corpsEtat.findMany({ where: { id_chantier } });
const somme = existants.reduce((s, c) => s + c.part_chantier, 0);
if (somme + Number(part_chantier) > 100) {
  res.status(400).json({ message: `La somme des parts dépasse 100% (actuel : ${somme}%)` });
  return;
}
```

### 8.7 Jalons — calcul automatique de l'écart en jours
Quand un jalon est marqué atteint ou manqué, le backend calcule automatiquement l'écart entre la date prévue et la date réelle :
```typescript
const ecart_jours = Math.round(
  (new Date(date_reelle).getTime() - new Date(date_prevue).getTime()) / 86_400_000
);
// Valeur positive = retard, valeur négative = avance
```

### 8.8 Bilan comptable — données enrichies
Le bilan `/api/comptabilite/bilan` retourne pour chaque chantier les champs calculés suivants :
- `nom_client` : déduit de la relation `contrat → client`
- `statut_bilan` : `'bilan_valide'`, `'cloture'` ou `'en_cours'` selon la clôture
- `avancement` : avancement global du chantier (%)
- `montant_marche` : montant du contrat associé
- `rad` : reste à dépenser = `montant_total_S0 - cout_reel_a_date`

---

## 9. Les contrôles d'accès par rôle

Certaines routes ne sont accessibles qu'à certains rôles.  
On utilise la fonction `requireRole()` :

```typescript
// Seul l'admin peut créer un utilisateur
router.post('/', requireRole('admin'), async (req, res) => { ... });

// Admin et comptable peuvent créer un budget S0
router.post('/:id/budget', requireRole('admin', 'comptable'), async (req, res) => { ... });

// Chef de chantier, conducteur et admin peuvent soumettre un rapport terrain
router.post('/rapports', requireRole('admin', 'conducteur', 'chef_chantier'), async (req, res) => { ... });
```

---

## 10. Tous les endpoints de l'API

### Authentification
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Aucun | Connexion — renvoie un JWT |

### Utilisateurs
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/utilisateurs` | Tous | Liste des utilisateurs |
| POST | `/api/utilisateurs` | Admin | Créer un compte |
| PUT | `/api/utilisateurs/:id` | Admin | Modifier un compte |
| PATCH | `/api/utilisateurs/:id/toggle` | Admin | Activer / désactiver |

### Clients
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/clients` | Tous | Liste des clients |
| GET | `/api/clients/:id` | Tous | Détail d'un client |
| POST | `/api/clients` | Admin, Conducteur | Créer un client |
| PUT | `/api/clients/:id` | Admin, Conducteur | Modifier un client |

### Contrats
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/contrats` | Tous | Liste des contrats |
| GET | `/api/contrats/:id` | Tous | Détail d'un contrat |
| GET | `/api/contrats/stats` | Tous | Statistiques globales des contrats |
| POST | `/api/contrats` | Admin | Créer un contrat |
| POST | `/api/contrats/:id/avenants` | Admin | Ajouter un avenant |

### Chantiers
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/chantiers` | Tous | Liste des chantiers (avec budget, planning, corps d'état) |
| GET | `/api/chantiers/en-cours` | Tous | Chantiers actifs uniquement |
| GET | `/api/chantiers/:id` | Tous | Détail complet d'un chantier |
| POST | `/api/chantiers` | Admin | Créer un chantier |
| PATCH | `/api/chantiers/:id/avancement` | Admin, Conducteur | Recalculer l'avancement global (moyenne pondérée) |
| PATCH | `/api/chantiers/:id/statut` | Admin | Changer le statut |
| POST | `/api/chantiers/:id/budget` | Admin, Comptable | Créer le budget S0 (1 seule fois, figé) |
| PATCH | `/api/chantiers/:id/budget/cout-reel` | Admin, Comptable, Conducteur | Mettre à jour le coût réel |

**Corps d'état (lots de travaux)**

| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/chantiers/:id/corps-etat` | Tous | Liste des lots avec leurs intervenants |
| POST | `/api/chantiers/:id/corps-etat` | Admin, Conducteur | Ajouter un lot (contrôle ≤ 100 %) |
| PATCH | `/api/chantiers/:id/corps-etat/:ceId/avancement` | Admin, Conducteur | Mettre à jour l'avancement d'un lot |

**Planning et jalons**

| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/chantiers/:id/planning` | Tous | Planning avec tous ses jalons |
| POST | `/api/chantiers/:id/planning` | Admin, Conducteur | Créer le planning (ou mettre à jour la version) |
| POST | `/api/chantiers/:id/jalons` | Admin, Conducteur | Ajouter un jalon à un planning existant |
| PATCH | `/api/chantiers/:id/jalons/:jalonId` | Admin, Conducteur | Marquer atteint/manqué (calcul écart jours auto) |

**Intervenants (sous-traitants)**

| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/chantiers/:id/intervenants` | Tous | Liste des sous-traitants du chantier |
| POST | `/api/chantiers/:id/intervenants` | Admin, Conducteur | Affecter un sous-traitant à un corps d'état |
| PATCH | `/api/chantiers/:id/intervenants/:intId` | Admin, Conducteur | Modifier un intervenant |
| DELETE | `/api/chantiers/:id/intervenants/:intId` | Admin | Retirer un intervenant |

### Terrain
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/terrain/rapports` | Tous | Liste des rapports terrain |
| POST | `/api/terrain/rapports` | Admin, Conducteur, Chef | Soumettre un rapport |
| GET | `/api/terrain/pointages` | Tous | Liste des pointages |
| POST | `/api/terrain/pointages` | Admin, Conducteur, Chef | Soumettre un pointage |

### Facturation
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/facturation/situations` | Tous | Liste des situations de travaux |
| GET | `/api/facturation/situations/:id` | Tous | Détail d'une situation |
| POST | `/api/facturation/situations` | Admin, Conducteur | Émettre une situation |
| POST | `/api/facturation/encaissements` | Comptable, Admin | Enregistrer un paiement |
| GET | `/api/facturation/stats` | Tous | Statistiques financières globales |

### Comptabilité
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/comptabilite/bilan` | Admin, Comptable | Bilan enrichi : nom client, statut bilan, avancement, montant marché, RAD |
| POST | `/api/comptabilite/cloture/:id/valider` | Comptable | Étape 1 — valider le bilan (`statut = 'bilan_valide'`) |
| POST | `/api/comptabilite/cloture/:id/cloturer` | Admin | Étape 2 — clôturer le chantier (après validation comptable) |

### Documents
| Méthode | URL | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/documents` | Tous | Liste des documents (filtrables par chantier/catégorie) |
| POST | `/api/documents` | Admin, Conducteur, Chef | Référencer un document |
| DELETE | `/api/documents/:id` | Admin, Conducteur | Supprimer un document |

---

## 11. Comment démarrer le projet

### Prérequis
- Node.js installé
- PostgreSQL installé et démarré

### Commandes

```bash
# 1. Installer les dépendances
npm install

# 2. Générer le client Prisma (types TypeScript)
npx prisma generate

# 3. Créer la base de données et les 16 tables
npx prisma migrate dev --name init

# 4. Insérer les données de test
npm run db:seed

# 5. Démarrer le serveur en mode développement
npm run dev
```

L'API démarre sur `http://localhost:3000`.

### Vérifier que ça marche
```bash
# Test de santé
curl http://localhost:3000/api/health
# → { "status": "ok" }

# Test de login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@btp-abi.ci","mot_de_passe":"Buildflow2026!"}'
# → { "token": "eyJ...", "utilisateur": { ... } }
```

### Variables d'environnement (.env)

```env
DATABASE_URL="postgresql://postgres:buildflow2026@localhost:5432/buildflow"
JWT_SECRET="buildflow-dev-secret-2026"
JWT_EXPIRES_IN="7d"
PORT=3000
FRONTEND_URL="http://localhost:4200"
```

---

## 12. Schéma général de l'architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PC du développeur / Serveur Railway           │
│                                                                      │
│   ┌──────────────┐    HTTP/JSON    ┌─────────────────────────────┐  │
│   │   Angular    │ ─────────────► │      Express (Node.js)       │  │
│   │  (Frontend)  │ ◄───────────── │                              │  │
│   │  Port 4200   │                │  ┌─────────────────────────┐ │  │
│   └──────────────┘                │  │  authMiddleware (JWT)    │ │  │
│                                   │  │  → vérifie le token      │ │  │
│                                   │  │  → extrait tenant_id     │ │  │
│                                   │  └───────────┬─────────────┘ │  │
│                                   │              │                │  │
│                                   │  ┌───────────▼─────────────┐ │  │
│                                   │  │        Routes            │ │  │
│                                   │  │  /api/auth               │ │  │
│                                   │  │  /api/chantiers          │ │  │
│                                   │  │  /api/terrain            │ │  │
│                                   │  │  /api/facturation ...    │ │  │
│                                   │  └───────────┬─────────────┘ │  │
│                                   │              │                │  │
│                                   │  ┌───────────▼─────────────┐ │  │
│                                   │  │     Prisma ORM           │ │  │
│                                   │  │  (traduit en SQL)        │ │  │
│                                   │  └───────────┬─────────────┘ │  │
│                                   └──────────────┼───────────────┘  │
│                                                  │                   │
│                                   ┌──────────────▼───────────────┐  │
│                                   │    PostgreSQL (Port 5432)     │  │
│                                   │    Base de données buildflow  │  │
│                                   │    16 tables + tenant_id      │  │
│                                   └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

---

## 13. Ce qui a changé — journal des évolutions

| Date | Modification |
|---|---|
| Mai 2026 | Création du backend — 18 tables, authentification JWT, multi-tenant |
| Mai 2026 | Routes corps d'état (GET/POST/PATCH avancement) + règle ≤ 100 % |
| Mai 2026 | Routes jalons (GET/POST/PATCH) + calcul écart jours automatique |
| Mai 2026 | Routes intervenants (GET/POST/PATCH/DELETE) |
| Mai 2026 | `GET /api/contrats/stats` — statistiques globales des contrats |
| Mai 2026 | Bilan comptable enrichi : `nom_client`, `statut_bilan`, `avancement`, `montant_marche`, `rad` |
| Mai 2026 | Frontend Angular 21 — zone.js activé, cache HTTP désactivé, stratégie de navigation corrigée |

---

*BuildFlow API — Node.js + Express + Prisma + PostgreSQL*  
*Dernière mise à jour : Mai 2026*
