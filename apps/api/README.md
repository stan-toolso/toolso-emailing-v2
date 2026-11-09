# Intro

L'application toolso emailing api est l'application en charge de répondre aux requetes https, de traiter les demandes de lancement de script et de dépiler les tâches à exécuter depuis une file de message ou en faisant du pull la base de données.

# Comment me lancer en debug

- Prérequis : avoir un bit installé sur son compte ayant accès au compte bit.cloud toolso et loggué (bit.login si besoin)
- Modifier le fichier scripts/local_api.js pour accéder à la base de données de son choix (modification de la variable d'environnement RESSOURCE_UID)
- Depuis le menu Run and Debug de Vscode lancer la configuration appellée Emailing local API l'api est accessible via le hots : http://localhost:4001

# Comment me deployer

- Effectuer un simple commit sur git de votre code et le pipeline de CICD se chargera de tester et de déployer votre code sur la base test
- Aller [ici](https://gitlab.com/toolso/toolso-emailing-api/-/pipelines) pour lancer la livraison sur d'autres clients.
- En cas de besoin de déploiement rapide possibilité de lancer les scripts activate\* du dossier deploy

# Commande pour relancer l'update des scores des workables

update "Contact" set "nextStatusUpdateDate"=now() where status='workable' and "nextStatusUpdateDate">now();

TEST
