import type { LegalEntity } from "./entity";

export const acceptableUse = {
  en: (e: LegalEntity) => `
This policy lists what you may not do with ${e.brand}, including in the apps you build and publish. It is part of the [Terms of Service](/legal/terms).

## You may not use the Service to create, host or distribute
- **Child sexual abuse material** or any sexualisation of minors. Accounts are closed immediately and the material is reported to the competent authorities.
- **Phishing or credential harvesting**, including copies of login pages of real companies, fake payment pages and impersonation of brands, people or public bodies.
- **Malware**: viruses, ransomware, keyloggers, info-stealers, botnets, crypto-miners or code meant to exploit vulnerabilities in systems you are not authorised to test.
- **Fraud and scams**: fake shops, investment or crypto scams, fake giveaways, counterfeit documents, fake reviews, money-laundering tools.
- **Illegal goods and services**: drugs, weapons and explosives, stolen data, counterfeit goods, or anything illegal where you or your users are.
- **Violence and hate**: threats, incitement to violence, terrorist or violent extremist content, harassment, and content that attacks people for protected characteristics.
- **Sexual content involving real people without their consent**, and pornographic content in published apps.
- **Privacy violations**: doxxing, stalkerware, collection or sale of personal data without a lawful basis, scrapers built to collect personal data at scale.
- **Infringement** of copyright, trademarks or other rights.
- **Spam**: bulk unsolicited messages, link farms, SEO spam.
- **Dangerous advice presented as professional**, such as medical, legal or financial services without the safeguards and qualifications the law requires.

## You may not misuse the infrastructure
- Try to escape a VM, access other projects, scan or attack networks, or reach our internal services.
- Run workloads unrelated to building your web app (mining, proxies, mass scraping, password cracking, load testing third parties).
- Overload the Service, bypass rate limits or queues, or automate account creation.
- Create several accounts to get sign-up or referral credits again, or share accounts to avoid plan limits.
- Use the Service to build a competing product by copying our interface or extracting our prompts.

## How we enforce it
Prompts are checked automatically before they reach a model. A blocked request adds a strike; three strikes in 30 days restrict the account to read-only. Severe violations lead to immediate termination. Published apps can be taken down after a report or our own review. We cooperate with law enforcement when legally required.

## Appeals and reports
If you think a decision was wrong, write to ${e.abuseEmail} and a person will review it. To report an app or a share link, use the [report form](/report).
`,
  fr: (e: LegalEntity) => `
Cette politique liste ce que vous ne pouvez pas faire avec ${e.brand}, y compris dans les applications que vous créez et publiez. Elle fait partie des [conditions générales d'utilisation](/legal/terms?lang=fr).

## Il est interdit de créer, héberger ou diffuser
- **Des contenus pédocriminels** ou toute sexualisation de mineurs. Le compte est fermé immédiatement et les contenus sont signalés aux autorités compétentes.
- **De l'hameçonnage ou de la collecte d'identifiants**, y compris des copies de pages de connexion de vraies entreprises, de fausses pages de paiement et l'usurpation de marques, de personnes ou d'organismes publics.
- **Des logiciels malveillants** : virus, rançongiciels, enregistreurs de frappe, voleurs de données, botnets, mineurs de cryptomonnaie ou code destiné à exploiter des vulnérabilités sur des systèmes que vous n'êtes pas autorisé à tester.
- **Des fraudes et arnaques** : fausses boutiques, arnaques à l'investissement ou aux cryptomonnaies, faux concours, faux documents, faux avis, outils de blanchiment.
- **Des biens et services illicites** : drogues, armes et explosifs, données volées, contrefaçons, ou tout ce qui est illégal là où vous ou vos utilisateurs vous trouvez.
- **De la violence et de la haine** : menaces, incitation à la violence, contenus terroristes ou d'extrémisme violent, harcèlement et contenus visant des personnes pour des caractéristiques protégées.
- **Des contenus sexuels impliquant de vraies personnes sans leur consentement**, et des contenus pornographiques dans les applications publiées.
- **Des atteintes à la vie privée** : divulgation de données personnelles, logiciels espions, collecte ou vente de données personnelles sans base légale, scrapers conçus pour collecter des données personnelles à grande échelle.
- **Des contrefaçons** de droits d'auteur, de marques ou d'autres droits.
- **Du spam** : messages non sollicités en masse, fermes de liens, spam de référencement.
- **Des conseils dangereux présentés comme professionnels**, par exemple des services médicaux, juridiques ou financiers sans les garanties et qualifications requises par la loi.

## Il est interdit d'abuser de l'infrastructure
- Tenter de sortir d'une VM, d'accéder à d'autres projets, de scanner ou d'attaquer des réseaux ou d'atteindre nos services internes.
- Exécuter des tâches sans rapport avec la création de votre application web (minage, proxys, scraping massif, cassage de mots de passe, tests de charge contre des tiers).
- Surcharger le Service, contourner les limites ou les files d'attente, ou automatiser la création de comptes.
- Créer plusieurs comptes pour obtenir à nouveau les crédits d'inscription ou de parrainage, ou partager un compte pour contourner les limites d'une offre.
- Utiliser le Service pour créer un produit concurrent en copiant notre interface ou en extrayant nos prompts.

## Application
Les prompts sont analysés automatiquement avant d'atteindre un modèle. Une demande bloquée ajoute un avertissement ; trois avertissements en 30 jours passent le compte en lecture seule. Les violations graves entraînent la fermeture immédiate. Les applications publiées peuvent être retirées après un signalement ou notre propre examen. Nous coopérons avec les autorités lorsque la loi l'exige.

## Contestation et signalements
Si vous pensez qu'une décision est injustifiée, écrivez à ${e.abuseEmail} : une personne la réexaminera. Pour signaler une application ou un lien de partage, utilisez le [formulaire de signalement](/report).
`,
};

export const cookies = {
  en: (e: LegalEntity) => `
${e.brand} only uses cookies and browser storage that are needed for the Service to work or that you set yourself. There are no advertising, analytics or social-media trackers, so we do not ask for consent.

## Cookies
| Name | Purpose | Duration |
| --- | --- | --- |
| \`better-auth.session_token\` | keeps you signed in | 7 days, renewed while you use the Service |
| \`better-auth.session_data\` | short cache of your session to make pages faster | 5 minutes |
| \`forged_ref\` | remembers the referral link you followed so your friend gets credit | 30 days |
| \`forged_did\` | random device identifier used to stop automated and repeated sign-ups | 12 months |

## Local storage (stays in your browser)
| Key | Purpose |
| --- | --- |
| \`forged-theme\`, \`forged-appearance\` | your theme, colours and custom CSS |
| \`forged:enhance-level\` | the prompt-enhancement level you chose last |
| \`forged:pending-prompt\` | a prompt typed before signing in, so it is not lost |
| \`forged:cookie-notice\` | remembers that you closed the cookie notice |

You can delete cookies and local storage in your browser settings at any time. Blocking the session cookie prevents you from signing in.

Apps you publish with ${e.brand} are your own websites: if you add analytics or advertising to them, you are responsible for their cookie consent.
`,
  fr: (e: LegalEntity) => `
${e.brand} n'utilise que des cookies et un stockage local nécessaires au fonctionnement du Service ou que vous définissez vous-même. Il n'y a aucun traceur publicitaire, de mesure d'audience ou de réseau social : aucun consentement n'est donc demandé.

## Cookies
| Nom | Finalité | Durée |
| --- | --- | --- |
| \`better-auth.session_token\` | maintient votre connexion | 7 jours, renouvelés tant que vous utilisez le Service |
| \`better-auth.session_data\` | cache court de votre session pour accélérer les pages | 5 minutes |
| \`forged_ref\` | mémorise le lien de parrainage suivi pour créditer votre ami | 30 jours |
| \`forged_did\` | identifiant d'appareil aléatoire servant à bloquer les inscriptions automatisées ou répétées | 12 mois |

## Stockage local (reste dans votre navigateur)
| Clé | Finalité |
| --- | --- |
| \`forged-theme\`, \`forged-appearance\` | votre thème, vos couleurs et votre CSS personnalisé |
| \`forged:enhance-level\` | le dernier niveau d'amélioration de prompt choisi |
| \`forged:pending-prompt\` | un prompt saisi avant la connexion, pour ne pas le perdre |
| \`forged:cookie-notice\` | mémorise la fermeture du bandeau d'information |

Vous pouvez supprimer les cookies et le stockage local dans les réglages de votre navigateur. Bloquer le cookie de session empêche la connexion.

Les applications que vous publiez avec ${e.brand} sont vos propres sites : si vous y ajoutez des outils de mesure d'audience ou de publicité, vous êtes responsable du recueil du consentement.
`,
};

export const legalNotice = {
  en: (e: LegalEntity) => `
## Publisher
${[
  `**${e.name}**${e.form ? `, ${e.form}` : ""}${e.capital ? ` with a share capital of ${e.capital}` : ""}`,
  e.address && `Registered office: ${e.address}`,
  e.registration && `Registration: ${e.registration}`,
  e.vat && `VAT number: ${e.vat}`,
  `Email: ${e.email}`,
  e.phone && `Phone: ${e.phone}`,
  e.director && `Publication director: ${e.director}`,
]
  .filter(Boolean)
  .join("  \n")}

## Hosting
${e.host}

## Reporting illegal content
Report an app or a share link with the [report form](/report) or by email to ${e.abuseEmail}. Notices are handled as required by the EU Digital Services Act: please include the URL, why you believe the content is illegal, and your name and email unless the report concerns child sexual abuse material.

## Intellectual property
The ${e.brand} name, logo, interface and texts are protected. Brand logos of AI providers and third-party services are shown to identify compatible services and belong to their owners.
`,
  fr: (e: LegalEntity) => `
## Éditeur
${[
  `**${e.name}**${e.form ? `, ${e.form}` : ""}${e.capital ? ` au capital de ${e.capital}` : ""}`,
  e.address && `Siège social : ${e.address}`,
  e.registration && `Immatriculation : ${e.registration}`,
  e.vat && `N° de TVA intracommunautaire : ${e.vat}`,
  `E-mail : ${e.email}`,
  e.phone && `Téléphone : ${e.phone}`,
  e.director && `Directeur de la publication : ${e.director}`,
]
  .filter(Boolean)
  .join("  \n")}

## Hébergement
${e.host}

## Signaler un contenu illicite
Signalez une application ou un lien de partage avec le [formulaire de signalement](/report) ou par e-mail à ${e.abuseEmail}. Les notifications sont traitées conformément au règlement européen sur les services numériques (DSA) et à la LCEN : indiquez l'URL, les raisons pour lesquelles le contenu vous paraît illicite, ainsi que vos nom et e-mail, sauf s'il s'agit de contenus pédocriminels.

## Propriété intellectuelle
Le nom ${e.brand}, son logo, son interface et ses textes sont protégés. Les logos des fournisseurs d'IA et des services tiers sont affichés pour identifier les services compatibles et appartiennent à leurs titulaires.
`,
};

export const security = {
  en: (e: LegalEntity) => `
We welcome reports from security researchers. If you find a vulnerability in ${e.brand}, please tell us privately at ${e.securityEmail}.

## Please include
- a description of the issue and its impact,
- steps to reproduce, with the URLs or project IDs involved,
- your name or handle if you want to be credited.

## Rules
- Only test against your own account and projects.
- Do not access, change or delete other users' data. Stop and report as soon as you can see data that is not yours.
- No denial-of-service, spam, social engineering or physical attacks.
- Do not try to escape the VM beyond what is needed to demonstrate the issue, and never use access to pivot to other systems.
- Give us reasonable time to fix the issue before disclosing it.

## Our commitment
We acknowledge reports within 3 working days, keep you informed, and credit you when the fix ships if you wish. We will not take legal action against research done in good faith within these rules.
`,
  fr: (e: LegalEntity) => `
Nous accueillons les signalements des chercheurs en sécurité. Si vous trouvez une vulnérabilité dans ${e.brand}, signalez-la-nous en privé à ${e.securityEmail}.

## Merci d'indiquer
- une description du problème et de son impact,
- les étapes pour le reproduire, avec les URL ou identifiants de projet concernés,
- votre nom ou pseudonyme si vous souhaitez être crédité.

## Règles
- Testez uniquement sur votre propre compte et vos propres projets.
- N'accédez pas aux données des autres utilisateurs, ne les modifiez ni ne les supprimez. Arrêtez-vous et signalez dès que vous voyez des données qui ne sont pas les vôtres.
- Pas de déni de service, de spam, d'ingénierie sociale ni d'attaque physique.
- Ne tentez pas de sortir de la VM au-delà de ce qui est nécessaire pour démontrer le problème et n'utilisez jamais un accès pour rebondir vers d'autres systèmes.
- Laissez-nous un délai raisonnable pour corriger avant toute publication.

## Nos engagements
Nous accusons réception sous 3 jours ouvrés, vous tenons informé et vous créditons à la publication du correctif si vous le souhaitez. Nous n'engagerons pas de poursuites contre une recherche menée de bonne foi dans le respect de ces règles.
`,
};
