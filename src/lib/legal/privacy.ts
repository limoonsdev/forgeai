import type { LegalEntity } from "./entity";

export const privacy = {
  en: (e: LegalEntity) => `
This policy explains what personal data ${e.brand} processes, why, for how long, and how you can exercise your rights. It applies to everyone, wherever you live, and is written to meet the EU and UK General Data Protection Regulation (GDPR).

## 1. Who is responsible
The data controller is ${e.name}${e.address ? `, ${e.address}` : ""}. Privacy contact: ${e.privacyEmail}.

## 2. What we collect
| Category | Examples | Source |
| --- | --- | --- |
| Account | name, email address, username, password hash, profile picture, accounts you link (Google, Discord, GitHub…) | you, the sign-in provider |
| Projects | prompts, attachments, project files, conversations, published apps, settings | you and the agent |
| Credits | balance, ledger of usage and grants, referral relationships | the Service |
| Connections | API keys you add in Connectors (encrypted), notification targets, GitHub access token | you |
| Security and anti-abuse | IP address, network range, approximate network operator (ASN), browser user agent, a hashed device identifier, a hash of your email, sign-up attempts, moderation decisions | your browser, the Service |
| Technical logs | request logs and error logs | the Service |
| Support | messages you send us, abuse reports | you |

We do not use advertising or analytics trackers, and we do not sell personal data.

## 3. Why we use it and on what legal basis
| Purpose | Legal basis (GDPR art. 6) |
| --- | --- |
| Create and run your account, build and host your projects, process credits | performance of the contract (6.1.b) |
| Send service emails (verification, password reset, security alerts, notifications you turn on) | performance of the contract (6.1.b) |
| Prevent fraud, multiple accounts, abuse and attacks; enforce our policies; keep the infrastructure secure | legitimate interests (6.1.f): protecting users, the Service and our resources |
| Keep accounting and tax records when payments open | legal obligation (6.1.c) |
| Respond to legal requests and exercise or defend legal claims | legal obligation (6.1.c) and legitimate interests (6.1.f) |

## 4. AI processing and automated decisions
When you send a prompt, it is processed by the AI model you selected, together with the project context the agent needs. Prompts are also checked automatically for content forbidden by the [Acceptable Use Policy](/legal/acceptable-use). A blocked request adds a strike to your account; three strikes in 30 days restrict the account, and certain categories (such as child sexual abuse material) close it immediately. You can ask for a human review of any such decision by writing to ${e.abuseEmail}, and you can contest it.

## 5. Who receives your data
We share data only with service providers acting on our instructions (processors) or when the law requires it:
- **Hosting:** ${e.host}.
- **AI model providers:** Anthropic (Claude models) and OpenRouter, which routes requests to the provider of the model you choose (for example OpenAI, Google, xAI, DeepSeek, Alibaba Qwen or Moonshot). Only the content needed for the request is sent. These providers' API terms do not allow them to train on this data.
- **Email delivery:** the email provider configured by the operator.
- **Optional processors:** an automated content-moderation API, a DDoS protection network and, once payments open, a payment processor. They are listed in this section when enabled.
- **Services you connect yourself** (for example fal, Replicate, Supabase, Stripe or GitHub) receive data when the agent uses them on your behalf. They act under their own terms.
- **Authorities**, when we are legally required to, for example to report child sexual abuse material.

## 6. Transfers outside the European Economic Area
Some providers are based in the United States or other countries. Transfers rely on an adequacy decision (such as the EU–US Data Privacy Framework for certified companies) or on the European Commission's Standard Contractual Clauses with additional safeguards. If you do not want your prompts to leave the provider ecosystem you trust, choose your model accordingly: the model picker shows the provider of each model.

## 7. How long we keep data
| Data | Retention |
| --- | --- |
| Account and projects | until you delete them or close your account; removed from live systems within 30 days, from backups within a further 30 days |
| Credit ledger and invoices | 10 years when it is an accounting record, otherwise with the account |
| Sign-up attempts, IP and device signals | 12 months |
| Moderation records | 12 months after the last strike, longer when needed for a legal obligation |
| Sessions | until sign-out or expiry, then 30 days |
| Server logs | 14 days |
| Abuse reports | 12 months after they are closed |

## 8. Security
Projects run in isolated VMs. Data is encrypted in transit (TLS). Secrets such as connector keys are encrypted at rest with AES-256-GCM. Access to production systems is restricted and logged. Passwords are stored as salted hashes. No system is perfectly secure; if a breach affects your data, we will notify you and the supervisory authority as the law requires.

## 9. Your rights
You can access, correct, export (portability), delete or restrict your data, object to processing based on legitimate interests, and withdraw any consent at any time. Most of this is self-service in **Settings → Account** (export your data, delete your account). For anything else, write to ${e.privacyEmail}. We answer within one month. You can also complain to a data protection authority, for example the authority where you live, or ${e.supervisoryAuthority}.

California residents have the right to know, delete and correct personal information and not to be discriminated against for exercising these rights. We do not sell or share personal information for cross-context behavioural advertising.

## 10. Children
The Service is not intended for anyone under 16. If you believe a child has created an account, contact us and we will delete it.

## 11. Cookies
We only use cookies that are necessary for the Service (sign-in session, security and referral attribution) and local storage for your interface preferences. See the [Cookie Policy](/legal/cookies).

## 12. Changes
We will announce material changes to this policy by email or in the app at least 30 days before they apply.
`,
  fr: (e: LegalEntity) => `
Cette politique explique quelles données personnelles ${e.brand} traite, pourquoi, pendant combien de temps, et comment exercer vos droits. Elle s'applique à tous, où que vous viviez, et respecte le Règlement général sur la protection des données (RGPD) de l'UE et du Royaume-Uni.

## 1. Responsable du traitement
Le responsable du traitement est ${e.name}${e.address ? `, ${e.address}` : ""}. Contact pour la protection des données : ${e.privacyEmail}.

## 2. Données collectées
| Catégorie | Exemples | Source |
| --- | --- | --- |
| Compte | nom, adresse e-mail, nom d'utilisateur, empreinte du mot de passe, photo de profil, comptes liés (Google, Discord, GitHub…) | vous, le fournisseur de connexion |
| Projets | prompts, pièces jointes, fichiers, conversations, applications publiées, réglages | vous et l'agent |
| Crédits | solde, historique d'utilisation et d'attribution, liens de parrainage | le Service |
| Connexions | clés d'API ajoutées dans Connecteurs (chiffrées), destinations de notification, jeton d'accès GitHub | vous |
| Sécurité et lutte contre les abus | adresse IP, plage réseau, opérateur réseau approximatif (ASN), user agent du navigateur, identifiant d'appareil haché, empreinte de votre e-mail, tentatives d'inscription, décisions de modération | votre navigateur, le Service |
| Journaux techniques | journaux de requêtes et d'erreurs | le Service |
| Support | messages que vous nous envoyez, signalements | vous |

Nous n'utilisons aucun traceur publicitaire ou de mesure d'audience et nous ne vendons pas de données personnelles.

## 3. Finalités et bases légales
| Finalité | Base légale (art. 6 RGPD) |
| --- | --- |
| Créer et gérer votre compte, construire et héberger vos projets, gérer les crédits | exécution du contrat (6.1.b) |
| Envoyer les e-mails de service (vérification, réinitialisation du mot de passe, alertes de sécurité, notifications activées) | exécution du contrat (6.1.b) |
| Prévenir la fraude, les comptes multiples, les abus et les attaques ; faire respecter nos règles ; sécuriser l'infrastructure | intérêt légitime (6.1.f) : protéger les utilisateurs, le Service et nos ressources |
| Tenir la comptabilité lorsque les paiements seront ouverts | obligation légale (6.1.c) |
| Répondre aux demandes légales, constater, exercer ou défendre des droits en justice | obligation légale (6.1.c) et intérêt légitime (6.1.f) |

## 4. Traitement par l'IA et décisions automatisées
Lorsque vous envoyez un prompt, il est traité par le modèle d'IA que vous avez choisi, avec le contexte du projet nécessaire à l'agent. Les prompts sont aussi analysés automatiquement pour détecter les contenus interdits par la [politique d'utilisation acceptable](/legal/acceptable-use?lang=fr). Une demande bloquée ajoute un avertissement à votre compte ; trois avertissements en 30 jours restreignent le compte, et certaines catégories (comme les contenus pédocriminels) entraînent sa fermeture immédiate. Vous pouvez demander un réexamen humain de toute décision de ce type en écrivant à ${e.abuseEmail} et la contester.

## 5. Destinataires
Nous partageons des données uniquement avec des prestataires agissant sur nos instructions (sous-traitants) ou lorsque la loi l'exige :
- **Hébergement :** ${e.host}.
- **Fournisseurs de modèles d'IA :** Anthropic (modèles Claude) et OpenRouter, qui transmet la requête au fournisseur du modèle choisi (par exemple OpenAI, Google, xAI, DeepSeek, Alibaba Qwen ou Moonshot). Seul le contenu nécessaire à la requête est envoyé. Les conditions de ces API n'autorisent pas l'entraînement sur ces données.
- **Envoi d'e-mails :** le prestataire configuré par l'exploitant.
- **Sous-traitants optionnels :** une API de modération automatique, un réseau de protection contre les attaques DDoS et, à l'ouverture des paiements, un prestataire de paiement. Ils sont listés ici lorsqu'ils sont activés.
- **Services que vous connectez vous-même** (par exemple fal, Replicate, Supabase, Stripe ou GitHub) : ils reçoivent des données lorsque l'agent les utilise pour vous, selon leurs propres conditions.
- **Autorités**, lorsque la loi nous y oblige, par exemple pour signaler des contenus pédocriminels.

## 6. Transferts hors de l'Espace économique européen
Certains prestataires sont situés aux États-Unis ou dans d'autres pays. Ces transferts reposent sur une décision d'adéquation (comme le Data Privacy Framework UE–États-Unis pour les sociétés certifiées) ou sur les clauses contractuelles types de la Commission européenne assorties de garanties complémentaires. Le sélecteur de modèle indique le fournisseur de chaque modèle : choisissez-le en conséquence.

## 7. Durées de conservation
| Données | Durée |
| --- | --- |
| Compte et projets | jusqu'à leur suppression ou la fermeture du compte ; effacement des systèmes actifs sous 30 jours, des sauvegardes sous 30 jours supplémentaires |
| Historique des crédits et factures | 10 ans lorsqu'il s'agit de pièces comptables, sinon avec le compte |
| Tentatives d'inscription, IP et signaux d'appareil | 12 mois |
| Décisions de modération | 12 mois après le dernier avertissement, plus longtemps si une obligation légale l'impose |
| Sessions | jusqu'à la déconnexion ou l'expiration, puis 30 jours |
| Journaux serveur | 14 jours |
| Signalements | 12 mois après leur clôture |

## 8. Sécurité
Les projets s'exécutent dans des VM isolées. Les données sont chiffrées en transit (TLS). Les secrets comme les clés des connecteurs sont chiffrés au repos (AES-256-GCM). L'accès aux systèmes de production est restreint et journalisé. Les mots de passe sont stockés sous forme d'empreintes salées. Aucun système n'est infaillible : en cas de violation affectant vos données, nous vous en informerons ainsi que l'autorité de contrôle, comme la loi l'exige.

## 9. Vos droits
Vous pouvez accéder à vos données, les rectifier, les exporter (portabilité), les effacer ou en limiter le traitement, vous opposer aux traitements fondés sur l'intérêt légitime, retirer votre consentement à tout moment et définir des directives sur le sort de vos données après votre décès. L'essentiel se fait dans **Paramètres → Compte** (export des données, suppression du compte). Pour le reste, écrivez à ${e.privacyEmail}. Nous répondons sous un mois. Vous pouvez aussi introduire une réclamation auprès d'une autorité de protection des données, par exemple celle de votre pays de résidence ou la ${e.supervisoryAuthority}.

## 10. Mineurs
Le Service n'est pas destiné aux personnes de moins de 16 ans. Si vous pensez qu'un enfant a créé un compte, contactez-nous et nous le supprimerons.

## 11. Cookies
Nous n'utilisons que des cookies nécessaires au Service (session de connexion, sécurité et attribution du parrainage) et le stockage local du navigateur pour vos préférences d'interface. Voir la [politique relative aux cookies](/legal/cookies?lang=fr).

## 12. Modifications
Nous annoncerons toute modification importante de cette politique par e-mail ou dans l'application au moins 30 jours avant son entrée en vigueur.
`,
};
