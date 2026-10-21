# Connexions sociales (Google, Discord, GitHub, Apple, Facebook)

Forged affiche toujours les cinq boutons. Un fournisseur sans identifiants dans `/etc/forged/forged.env` apparaît en **« Bientôt »** (bouton désactivé). Dès que ses variables sont renseignées et le service redémarré (`forgedctl restart`), le bouton devient actif, sur la page de connexion, d'inscription et dans **Paramètres → Compte** (pour lier un compte existant).

Dans tout ce guide, remplacez `forged.example` par votre domaine (celui de `NEXT_PUBLIC_APP_URL`).

**URL de redirection (callback) à déclarer chez chaque fournisseur :**

```
https://forged.example/api/auth/callback/<fournisseur>
```

où `<fournisseur>` vaut `google`, `discord`, `github`, `apple` ou `facebook`.

Après chaque modification : `sudo forgedctl env` (édite le fichier), puis `sudo forgedctl restart`.

---

## Google

1. Ouvrez https://console.cloud.google.com/ et créez un projet (ou choisissez-en un).
2. **APIs et services → Écran de consentement OAuth** (« Google Auth Platform ») :
   - Type d'utilisateur : **Externe**.
   - Nom de l'application : `Forged.dev`, e-mail d'assistance, logo (facultatif).
   - Domaines autorisés : `forged.example`.
   - Liens : page d'accueil `https://forged.example`, règles de confidentialité `https://forged.example/legal/privacy`, conditions `https://forged.example/legal/terms`.
   - Champs d'application (scopes) : `openid`, `email`, `profile` uniquement (pas de vérification Google nécessaire pour ces scopes).
   - Publiez l'application (**En production**), sinon seuls les utilisateurs de test pourront se connecter.
3. **Identifiants → Créer des identifiants → ID client OAuth** :
   - Type : **Application Web**.
   - Origines JavaScript autorisées : `https://forged.example`
   - URI de redirection autorisés : `https://forged.example/api/auth/callback/google`
4. Copiez l'ID et le secret :

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
```

## Discord

1. https://discord.com/developers/applications → **New Application** (nom : Forged.dev).
2. Onglet **OAuth2** :
   - Copiez **Client ID** et cliquez **Reset Secret** pour obtenir le **Client Secret**.
   - **Redirects → Add Redirect** : `https://forged.example/api/auth/callback/discord`
3. Les scopes `identify` et `email` sont demandés automatiquement par Forged.

```
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=xxxxxxxx
```

> Les comptes Discord sans e-mail vérifié ne peuvent pas recevoir de crédits gratuits tant que l'adresse n'est pas confirmée.

## GitHub (connexion)

1. https://github.com/settings/developers → **OAuth Apps → New OAuth App**.
   - Homepage URL : `https://forged.example`
   - Authorization callback URL : `https://forged.example/api/auth/callback/github`
2. **Generate a new client secret**.

```
GITHUB_CLIENT_ID=Ov23lixxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxx
```

> Cette application sert aussi à l'intégration GitHub (import/export de dépôts) : Forged demande l'accès aux dépôts (`repo`) uniquement quand l'utilisateur clique sur « Connecter GitHub » dans un projet, pas à la connexion.

## Apple

Nécessite un compte Apple Developer payant (99 $/an).

1. https://developer.apple.com/account/resources/identifiers → **+** → **App IDs** → type **App** : créez un identifiant (ex. `dev.forged.app`) et cochez **Sign in with Apple**.
2. **+** → **Services IDs** : créez un identifiant (ex. `dev.forged.web`). C'est votre `APPLE_CLIENT_ID`.
   - Cochez **Sign in with Apple → Configure** : Primary App ID = l'App ID de l'étape 1.
   - Domains and Subdomains : `forged.example`
   - Return URLs : `https://forged.example/api/auth/callback/apple`
3. **Keys → +** : cochez **Sign in with Apple**, associez l'App ID, téléchargez le fichier `.p8` (une seule fois !) et notez le **Key ID**.
4. Votre **Team ID** est affiché en haut à droite du portail.

```
APPLE_CLIENT_ID=dev.forged.web
APPLE_TEAM_ID=ABCDE12345
APPLE_KEY_ID=XYZ987WVUT
# Contenu du fichier .p8 sur une ligne, retours à la ligne remplacés par \n
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
```

Forged génère lui-même le « client secret » JWT (valable 6 mois) à chaque démarrage : rien à renouveler à la main tant que le service redémarre au moins une fois tous les 6 mois (les mises à jour automatiques s'en chargent).

> Apple ne transmet le nom de l'utilisateur qu'à la toute première connexion et peut fournir une adresse relais `@privaterelay.appleid.com`. Pour qu'Apple puisse livrer les e-mails de Forged à ces adresses, enregistrez votre domaine d'envoi dans **Services → Sign in with Apple for Email Communication**.

## Facebook

1. https://developers.facebook.com/apps → **Créer une app** → cas d'usage **Authentifier et demander des données aux utilisateurs avec Facebook Login**.
2. **Facebook Login → Paramètres** :
   - URI de redirection OAuth valides : `https://forged.example/api/auth/callback/facebook`
   - Activez **Connexion OAuth Web** et **Utiliser le mode strict pour les URI de redirection**.
3. **Paramètres de l'app → Général** : renseignez l'URL des règles de confidentialité (`/legal/privacy`), des conditions (`/legal/terms`) et l'**URL de suppression des données** (`https://forged.example/settings/account`), puis passez l'app en mode **Live**.
4. Copiez l'**ID de l'app** et la **clé secrète**.

```
FACEBOOK_CLIENT_ID=1234567890
FACEBOOK_CLIENT_SECRET=xxxxxxxx
```

> Les adresses e-mail Facebook ne sont pas considérées comme vérifiées : l'utilisateur confirme son e-mail avant de recevoir ses crédits gratuits, et un compte Facebook n'est jamais lié automatiquement à un compte existant.

---

## Vérifier

1. `sudo forgedctl restart`
2. Ouvrez `https://forged.example/login` : le bouton du fournisseur n'affiche plus « Bientôt ».
3. Connectez-vous, puis vérifiez **Paramètres → Compte → Méthodes de connexion**.

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| `redirect_uri_mismatch` | L'URL de redirection déclarée ne correspond pas exactement (https, domaine, chemin). |
| Retour sur `/login?error=oauth` | Secret incorrect, application non publiée (Google « En test », Facebook « Développement ») ou horloge du serveur décalée (Apple). |
| « Too many accounts were created… » | Les limites anti-abus s'appliquent aussi aux inscriptions via un fournisseur. Voir `FORGED_SIGNUP_*` dans `forged.env`. |
| Apple : `invalid_client` | `APPLE_PRIVATE_KEY` mal formatée (les `\n` doivent être présents) ou Key ID / Team ID inversés. |
