# Journaux et surveillance

La page **Journaux et surveillance** montre l'état du service et permet de rechercher dans les journaux des requêtes.

## Tableau de bord

Les fiches du haut couvrent les dernières 24 heures :

- **Requêtes** : nombre de requêtes à l'API.
- **Taux d'erreur** : part des requêtes qui ont échoué avec une erreur serveur (5xx).
- **Latence p95** : 95 % des requêtes ont été plus rapides que cette valeur.
- **Erreurs client** : requêtes refusées car non valides (4xx).

Le graphique montre les requêtes et les erreurs serveur par heure. Changez l'intervalle avec **Période**.

## Rechercher dans les journaux en langage naturel

1. Saisissez une question comme `erreurs de la dernière heure` ou `requêtes lentes de plus de 500 ms`.
2. Appuyez sur **Entrée**. La recherche indique comment elle a compris la question sous **Interprété comme**.
3. Le tableau liste les requêtes correspondantes, des plus récentes aux plus anciennes.

Seuls les champs des journaux peuvent être recherchés : heure, méthode, chemin, statut, durée, niveau, message et pays.
Si la question ne peut pas devenir une recherche dans les journaux, il vous est demandé de la reformuler.

## Recherche par mot-clé

Passez à **Mot-clé** pour rechercher dans le chemin et le texte du message, éventuellement limité à un niveau.
