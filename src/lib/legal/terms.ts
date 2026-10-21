import type { LegalEntity } from "./entity";

export const terms = {
  en: (e: LegalEntity) => `
These Terms of Service ("Terms") govern your use of ${e.brand} (the "Service"), operated by ${e.name}${e.address ? `, ${e.address}` : ""} ("we", "us"). By creating an account or using the Service you accept these Terms. If you use the Service for a company, you accept them on its behalf.

## 1. What the Service does
${e.brand} lets you describe a web application in natural language. An AI agent then writes a Next.js project, runs it in an isolated virtual machine ("VM") operated by us, and shows you a live preview. You can publish the result on a subdomain of ${e.domain}, download the source code or push it to a GitHub repository you control.

The Service only builds websites and web applications. It is not intended for native mobile apps, desktop software or programs in other languages.

## 2. Eligibility and accounts
- You must be at least 16 years old, or the minimum age of digital consent in your country if higher, and able to enter into a binding contract.
- Give accurate information and keep your password and sign-in methods secure. You are responsible for activity on your account.
- One person, one account. Creating accounts to collect sign-up or referral credits more than once is not allowed.
- We may ask you to verify your email address before giving you free credits or access to some features.

## 3. Credits
- AI usage is paid with prepaid credits. Each agent step is charged from the tokens the model actually used, at the provider's price plus our margin. The cost of each run is shown in the interface.
- Free, referral and promotional credits have no cash value, cannot be transferred and may be withdrawn if they were obtained through abuse.
- Paid credits do not expire while your account is open. They are not refundable except where the law requires it.
- If your balance reaches zero during a run, the run stops.

## 4. Paid plans
Paid plans are not available yet. When they open, prices, billing periods and included credits will be shown before you pay, and payments will be processed by our payment provider. Subscriptions renew automatically until cancelled; cancellation takes effect at the end of the current period.

**Right of withdrawal (EU/UK consumers).** You normally have 14 days to withdraw from a distance contract. Because credits and plans give access to digital services that start immediately, you will be asked to agree to immediate performance and to acknowledge that you lose the right of withdrawal once the service has been fully performed or once you start using the credits, as permitted by Article 16(m) of Directive 2011/83/EU. Unused paid credits bought less than 14 days ago can be refunded on request.

## 5. Your content
- "Your Content" means your prompts, attachments, files, generated code, published apps and other material you submit or that the agent produces for you.
- You keep all rights you have in Your Content. As far as the law allows, the code and assets generated for you belong to you.
- You give us a worldwide, non-exclusive, royalty-free licence to host, copy, process, transmit and display Your Content only as needed to run, secure and improve the reliability of the Service for you, including sending it to the AI model you select. This licence ends when you delete the content, except for copies kept in backups for a limited time or where we must keep them by law.
- We do not use Your Content to train AI models.
- You confirm you have the rights needed for everything you upload or ask the agent to use.

## 6. AI output
AI output can be wrong, incomplete, insecure or similar to existing material. Review generated code before relying on it, especially for authentication, payments, personal data and anything safety-related. Nothing produced by the Service is legal, medical, financial or other professional advice.

## 7. Acceptable use
You must follow our [Acceptable Use Policy](/legal/acceptable-use). Prompts and projects are checked automatically for prohibited content. Violations can lead to blocked requests, strikes, restriction or termination of your account, and, where the law requires it, reports to the authorities.

To protect the infrastructure, you cannot edit project files by hand inside the Service: changes are made by the agent. You can always export your code and edit it elsewhere.

## 8. Published apps
- You are responsible for apps you publish, including their content, the data they collect and compliance with the laws that apply to them (for example privacy notices and consumer information).
- A subdomain is provided for as long as you have an account in good standing and is not your property. Plan limits on the number of published apps apply.
- We may suspend or remove a published app that breaks these Terms, receives a valid legal notice or puts other users or the infrastructure at risk.
- Published apps show a small "Built with Forged" badge with a link to report abuse.

## 9. Third-party services
The agent can use AI models and services from other companies (for example Anthropic, OpenRouter and the services you connect yourself in Connectors). Services you connect with your own keys are governed by your agreement with their providers, and you pay their fees directly. We are not responsible for third-party services.

## 10. Availability and changes
We work to keep the Service available but do not guarantee it will be uninterrupted. VMs are stopped when idle and may be queued when the servers are busy. We may change or discontinue features; if a change significantly reduces what you paid for, you can ask for a pro-rata refund of unused paid credits.

## 11. Suspension and termination
You can delete your account at any time from your settings. We may suspend or terminate accounts that breach these Terms, create risk or legal exposure for us or others, or have been inactive for more than 24 months (with 30 days' notice by email). On termination, your projects are deleted as described in the [Privacy Policy](/legal/privacy).

## 12. Warranties and liability
- The Service is provided "as is" and "as available". To the extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose and non-infringement.
- To the extent permitted by law, we are not liable for indirect or consequential losses, loss of profits, data or goodwill, and our total liability for any claim is limited to the greater of the amount you paid us in the 12 months before the claim and 50 EUR.
- Nothing in these Terms limits liability that cannot be limited by law, including for death or personal injury caused by negligence, fraud, gross negligence or wilful misconduct, or your statutory rights as a consumer.

## 13. Indemnity
If you use the Service for business purposes, you will indemnify us against third-party claims arising from Your Content, your published apps or your breach of these Terms.

## 14. Changes to these Terms
We may update these Terms. We will give at least 30 days' notice by email or in the app before material changes take effect. If you do not agree, you can close your account before the changes apply.

## 15. Law and disputes
These Terms are governed by the law of ${e.governingLaw}. If you are a consumer, you also keep the protection of the mandatory rules of the country where you live, and you may bring proceedings there. Otherwise disputes go to ${e.courts}.

Please contact us first at ${e.email} so we can try to resolve the problem.${e.mediator ? ` Consumers in the EU can also refer a dispute free of charge to our consumer mediator: ${e.mediator}.` : ""}

## 16. Contact
${e.name}${e.address ? `, ${e.address}` : ""} · ${e.email}
`,
  fr: (e: LegalEntity) => `
Les présentes conditions générales d'utilisation (les « Conditions ») régissent l'utilisation de ${e.brand} (le « Service »), exploité par ${e.name}${e.address ? `, ${e.address}` : ""} (« nous »). En créant un compte ou en utilisant le Service, vous acceptez les Conditions. Si vous utilisez le Service pour une entreprise, vous les acceptez en son nom.

## 1. Le Service
${e.brand} vous permet de décrire une application web en langage naturel. Un agent d'IA écrit alors un projet Next.js, l'exécute dans une machine virtuelle isolée (« VM ») que nous opérons et vous en montre un aperçu en direct. Vous pouvez publier le résultat sur un sous-domaine de ${e.domain}, télécharger le code source ou l'envoyer vers un dépôt GitHub que vous contrôlez.

Le Service sert uniquement à créer des sites et applications web. Il n'est pas conçu pour des applications mobiles natives, des logiciels de bureau ou des programmes dans d'autres langages.

## 2. Conditions d'accès et compte
- Vous devez avoir au moins 16 ans, ou l'âge de consentement numérique de votre pays s'il est plus élevé, et pouvoir conclure un contrat.
- Fournissez des informations exactes et protégez votre mot de passe et vos moyens de connexion. Vous êtes responsable de l'activité de votre compte.
- Une personne, un compte. Créer plusieurs comptes pour obtenir plusieurs fois les crédits d'inscription ou de parrainage est interdit.
- Nous pouvons vous demander de vérifier votre adresse e-mail avant de vous accorder des crédits gratuits ou certaines fonctionnalités.

## 3. Crédits
- L'utilisation de l'IA est payée avec des crédits prépayés. Chaque étape de l'agent est facturée selon les tokens réellement utilisés par le modèle, au prix du fournisseur plus notre marge. Le coût de chaque exécution est affiché dans l'interface.
- Les crédits gratuits, de parrainage et promotionnels n'ont aucune valeur monétaire, ne sont pas cessibles et peuvent être retirés s'ils ont été obtenus de manière abusive.
- Les crédits payés n'expirent pas tant que votre compte est ouvert. Ils ne sont pas remboursables, sauf lorsque la loi l'exige.
- Si votre solde atteint zéro pendant une exécution, celle-ci s'arrête.

## 4. Offres payantes
Les offres payantes ne sont pas encore disponibles. À leur ouverture, les prix, périodes de facturation et crédits inclus seront affichés avant tout paiement, traité par notre prestataire de paiement. Les abonnements se renouvellent automatiquement jusqu'à leur résiliation, qui prend effet à la fin de la période en cours.

**Droit de rétractation (consommateurs de l'UE et du Royaume-Uni).** Vous disposez en principe de 14 jours pour vous rétracter d'un contrat conclu à distance. Les crédits et offres donnant accès à des services numériques exécutés immédiatement, il vous sera demandé d'accepter cette exécution immédiate et de reconnaître que vous perdez votre droit de rétractation une fois le service pleinement exécuté ou dès que vous utilisez les crédits, comme le permet l'article L221-28 du Code de la consommation (article 16 m) de la directive 2011/83/UE). Les crédits payés non utilisés et achetés depuis moins de 14 jours peuvent être remboursés sur demande.

## 5. Vos contenus
- « Vos Contenus » désigne vos prompts, pièces jointes, fichiers, le code généré, les applications publiées et tout autre élément que vous soumettez ou que l'agent produit pour vous.
- Vous conservez tous vos droits sur Vos Contenus. Dans la mesure permise par la loi, le code et les ressources générés pour vous vous appartiennent.
- Vous nous accordez une licence mondiale, non exclusive et gratuite pour héberger, copier, traiter, transmettre et afficher Vos Contenus uniquement dans la mesure nécessaire pour faire fonctionner et sécuriser le Service pour vous, y compris pour les envoyer au modèle d'IA que vous choisissez. Cette licence prend fin à la suppression des contenus, sauf pour les copies conservées temporairement dans les sauvegardes ou lorsque la loi nous impose de les conserver.
- Nous n'utilisons pas Vos Contenus pour entraîner des modèles d'IA.
- Vous garantissez disposer des droits nécessaires sur tout ce que vous importez ou demandez à l'agent d'utiliser.

## 6. Résultats produits par l'IA
Les résultats de l'IA peuvent être erronés, incomplets, peu sûrs ou ressembler à des contenus existants. Relisez le code généré avant de vous y fier, en particulier pour l'authentification, les paiements, les données personnelles et tout ce qui touche à la sécurité. Rien de ce que produit le Service ne constitue un conseil juridique, médical, financier ou professionnel.

## 7. Utilisation acceptable
Vous devez respecter notre [politique d'utilisation acceptable](/legal/acceptable-use?lang=fr). Les prompts et projets sont analysés automatiquement pour détecter les contenus interdits. Une violation peut entraîner le blocage de la demande, des avertissements, la restriction ou la fermeture du compte et, lorsque la loi l'exige, un signalement aux autorités.

Pour protéger l'infrastructure, vous ne pouvez pas modifier vous-même les fichiers d'un projet dans le Service : les modifications sont faites par l'agent. Vous pouvez toujours exporter votre code pour le modifier ailleurs.

## 8. Applications publiées
- Vous êtes responsable des applications que vous publiez, de leur contenu, des données qu'elles collectent et du respect des lois qui s'y appliquent (par exemple mentions d'information et droit de la consommation).
- Le sous-domaine est mis à disposition tant que votre compte est actif et en règle ; il ne vous appartient pas. Les limites de votre offre s'appliquent au nombre d'applications publiées.
- Nous pouvons suspendre ou retirer une application publiée qui enfreint les Conditions, fait l'objet d'une notification légale valable ou met en danger d'autres utilisateurs ou l'infrastructure.
- Les applications publiées affichent un petit badge « Built with Forged » avec un lien de signalement.

## 9. Services tiers
L'agent peut utiliser des modèles et services d'autres sociétés (par exemple Anthropic, OpenRouter et les services que vous connectez vous-même dans Connecteurs). Les services connectés avec vos propres clés relèvent de votre contrat avec leurs fournisseurs et vous en payez directement les frais. Nous ne sommes pas responsables des services tiers.

## 10. Disponibilité et évolutions
Nous faisons notre possible pour que le Service reste disponible, sans garantir qu'il sera ininterrompu. Les VM sont arrêtées lorsqu'elles sont inactives et peuvent être placées en file d'attente lorsque les serveurs sont chargés. Nous pouvons modifier ou arrêter des fonctionnalités ; si un changement réduit fortement ce que vous avez payé, vous pouvez demander le remboursement au prorata des crédits payés non utilisés.

## 11. Suspension et résiliation
Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. Nous pouvons suspendre ou fermer un compte qui enfreint les Conditions, crée un risque juridique ou technique pour nous ou pour d'autres, ou est inactif depuis plus de 24 mois (avec un préavis de 30 jours par e-mail). À la fermeture, vos projets sont supprimés comme décrit dans la [politique de confidentialité](/legal/privacy?lang=fr).

## 12. Garanties et responsabilité
- Le Service est fourni « en l'état » et « selon disponibilité ». Dans la mesure permise par la loi, nous excluons les garanties implicites de qualité marchande, d'adéquation à un usage particulier et d'absence de contrefaçon.
- Dans la mesure permise par la loi, nous ne sommes pas responsables des dommages indirects, pertes de profits, de données ou d'image, et notre responsabilité totale est limitée au plus élevé des deux montants suivants : les sommes que vous nous avez payées au cours des 12 mois précédant la réclamation, ou 50 EUR.
- Rien dans les Conditions ne limite une responsabilité qui ne peut l'être légalement, notamment en cas de décès ou de dommage corporel causé par une négligence, de fraude, de faute lourde ou intentionnelle, ni vos droits légaux de consommateur, dont la garantie légale de conformité.

## 13. Garantie contre les recours
Si vous utilisez le Service à des fins professionnelles, vous nous garantissez contre toute réclamation de tiers liée à Vos Contenus, à vos applications publiées ou à votre violation des Conditions.

## 14. Modification des Conditions
Nous pouvons modifier les Conditions. Nous vous préviendrons au moins 30 jours à l'avance par e-mail ou dans l'application avant tout changement important. Si vous ne l'acceptez pas, vous pouvez fermer votre compte avant son entrée en vigueur.

## 15. Droit applicable et litiges
Les Conditions sont régies par le droit de ${e.governingLaw === "France" ? "la France" : e.governingLaw}. Si vous êtes consommateur, vous conservez la protection des règles impératives du pays où vous résidez et pouvez saisir ses juridictions. Dans les autres cas, les litiges relèvent de ${e.courts === "the courts of the operator's registered office" ? "la compétence des tribunaux du siège de l'exploitant" : e.courts}.

Contactez-nous d'abord à ${e.email} afin que nous tentions de résoudre le problème.${e.mediator ? ` Si vous êtes consommateur, vous pouvez aussi recourir gratuitement à notre médiateur de la consommation : ${e.mediator}.` : ""}

## 16. Contact
${e.name}${e.address ? `, ${e.address}` : ""} · ${e.email}
`,
};
