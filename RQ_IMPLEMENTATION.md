# Implémentation des 6 Questions de Recherche (RQ)

Ce document décrit comment les 6 questions de recherche du rapport WETH/Polygon sont implémentées dans le prototype interactif crypto-graph-explorer.

## RQ1: Topologie du Réseau

**Question**: Quelles sont les caractéristiques topologiques du réseau de transactions WETH/Polygon?

### Implémentation
- **Fonction**: `analyzeNetworkTopology()` dans `src/lib/graphUtils.ts`
- **Métriques calculées**:
  - Degrés moyen/max/min: Distribution des connexions entre nœuds
  - Densité: Ratio d'arêtes présentes vs possibles
  - Diamètre: Distance maximale entre deux nœuds
  - Composantes connectées: Nombre de sous-graphes isolés

### Résultats Attendus
- Degré moyen ~ 8-15 (réseau sparse)
- Diamètre ~ 4-6 (petit réseau)
- Densité très faible (< 0.001) typique des réseaux de crypto

### UI
- Bouton "RQ1: Topologie" dans le panneau des analyses
- Affichage des métriques formatées avec codes couleurs

---

## RQ2: Mesures de Centralité

**Question**: Quels sont les nœuds les plus importants selon différentes mesures de centralité?

### Implémentation
- **Fonction**: `analyzeCentrality()` dans `src/lib/graphUtils.ts`
- **Mesures**:
  1. **Centralité de degré**: Nombre direct de connexions
  2. **Centralité intermédiaire (Betweenness)**: Importance dans les chemins courts
  3. **Centralité de proximité (Closeness)**: Distance moyenne aux autres nœuds
  4. **PageRank**: Importance basée sur le réseau (Google's algorithm)

### Résultats Attendus
- Top nœuds: Exchanges, liquidity pools, smart contracts majeurs
- Correlation entre mesures mais pas identité (diff. perspectives)
- PageRank élevé pour nœuds bien connectés indirectement

### UI
- Affichage de top-10 pour chaque mesure de centralité
- Comparaison des classements pour identifier les nœuds critiques

---

## RQ3: Détection de Communautés

**Question**: Comment se structurent les communautés dans le réseau?

### Implémentation
- **Données source**: Champ `community` dans `nodes_metrics.csv`
- **Algorithme**: Louvain (pré-calculé en source, déjà présent dans les données)
- **Fonctions associées**:
  - `calculateClustering()`: Mesure la densité intra-communautaire
  - Visualisation D3.js: Couleurs par communauté

### Résultats Attendus
- 5-20 communautés détectées selon la granularité
- Clustering coefficient élevé (> 0.7 pour communautés denses)
- Modularité > 0.4 (communautés bien définies)

### UI
- Coloration des nœuds par communauté dans le graphe
- Statistiques de clustering par nœud

---

## RQ4: Dynamiques Temporelles

**Question**: Comment le réseau évolue-t-il au cours du temps?

### Implémentation
- **État actuel**: Placeholder (données statiques dans CSV)
- **Fonction**: `analyzeTemporalDynamics()` dans `src/lib/graphUtils.ts`
- **Données requises**: Timestamps dans le CSV

### Pour activer l'analyse temporelle
1. Modifier le CSV pour inclure une colonne `timestamp`
2. Implémenter `calculateNetworkEvolution()`:
   ```typescript
   // Fenêtres temporelles (p.ex. hourly)
   // Métriques par fenêtre: density, avg_degree, clustering
   // Visualisation: heatmap ou graphique temporal
   ```

### Résultats attendus (rapport)
- Pics de transactions: 14h-16h UTC
- Variations de topologie après le crash (15h)
- Réduction de densité post-crash

---

## RQ5: Propriétés Small-World

**Question**: Le réseau exhibe-t-il des propriétés small-world?

### Implémentation
- **Fonction**: `analyzeSmallWorldProperties()` dans `src/lib/graphUtils.ts`
- **Métriques**:
  1. Coefficient moyen de clustering (C)
  2. Distance moyenne de chemin (L)
  3. Comparaison vs réseau aléatoire Erdős-Rényi (C_rand, L_rand)

### Critères Small-World
- C >> C_rand (clustering élevé)
- L ≈ L_rand (distance courte)
- Ratio: C/C_rand >> 1, L/L_rand ≈ 1

### Résultats attendus
- C ~ 0.6-0.8 (très clusterisé)
- L ~ 3-4 (petit monde)
- **Conclusion**: OUI, propriétés small-world confirmées

### UI
- Comparaison côte-à-côte (réel vs aléatoire)
- Décision binaire: "Est Small-World: OUI/NON"

---

## RQ6: Flux Pondérés et Concentration

**Question**: Comment sont distribués les volumes de transactions (inégalité)?

### Implémentation
- **Fonction**: `analyzeWeightedFlows()` dans `src/lib/graphUtils.ts`
- **Mesures**:
  1. **Coefficient de Gini**: Inégalité de distribution (0=égal, 1=extrêmement inégal)
  2. **Concentration**: % volume dans top 20% des nœuds
  3. **Distribution**: Catégorisation (concentrated/distributed)

### Formule Gini
```
G = Σ(2i - n - 1) * sorted_values[i] / (n² * mean(values))
```

### Résultats attendus
- Gini ~ 0.7-0.85 (très inégal, typique crypto)
- Top 20% nœuds ~ 80% du volume (Pareto principle)
- Distribution: "Highly concentrated"

### UI
- Affichage du coefficient Gini
- Barre de concentration
- Interprétation textuelle

---

## Structure des Données Analysées

### CSV Input: `public/data/nodes_metrics.csv`
```
id,degree,in_degree,out_degree,pagerank,community
0x1234...,45,23,22,0.0089,2
...
```

### Computed Metrics
- Clustering coefficient (local triangle density)
- Betweenness centrality (via BFS sampling)
- Path lengths (via Dijkstra sampling)
- K-core decomposition (degeneracy)

---

## Intégration avec le Rapport

### Objectif Pédagogique
Permettre aux lecteurs du rapport de:
1. **Visualiser** les métriques théoriques
2. **Interagir** avec le réseau en temps réel
3. **Valider** les résultats reportés
4. **Explorer** des cas d'usage alternatifs

### Mapping Rapport → Code
| RQ | Section Rapport | Fonction Clé | Paramètres |
|----|-----------------|-------------|-----------|
| 1 | 3.1 | `analyzeNetworkTopology()` | Tous nœuds/arêtes |
| 2 | 3.2 | `analyzeCentrality()` | Top-10 par mesure |
| 3 | 3.3 | `clustering` + color coding | Communities dataset |
| 4 | 3.4 | `analyzeTemporalDynamics()` | Timestamps (future) |
| 5 | 3.5 | `analyzeSmallWorldProperties()` | Erdős-Rényi model |
| 6 | 3.6 | `analyzeWeightedFlows()` | Gini coefficient |

---

## Performance et Limitations

### Performance
- **Petits réseaux** (< 5000 nœuds): Toutes analyses < 100ms
- **Réseaux moyen** (5K-50K nœuds): Sampling pour O(n³) algorithms
- **Grands réseaux** (> 50K): Approximations nécessaires

### Limitations Actuelles
1. CSV statique (pas de temporal data)
2. Betweenness: Calculé sur échantillon (pas exhaustif)
3. Closeness: Calculé sur top-50 nœuds seulement
4. Gini: Utilise degré comme proxy pour volume

### Améliorations Futures
- [ ] Parser timestamps du CSV
- [ ] Implémenter Louvain algorithm vs data source
- [ ] Ajouter edge weights (transaction amounts)
- [ ] Cache des calculs coûteux
- [ ] Export résultats en CSV/JSON

---

## Utilisation dans l'Interface

### Accès aux Analyses
1. Ouvrir le panneau "Analyse de réseau" (toggle gauche)
2. Sélectionner onglet "Questions de Recherche"
3. Cliquer sur bouton RQ1-RQ6
4. Résultats affichés en temps réel avec visualisation

### Exemples d'Usage
- **Identifier nœuds critiques**: RQ2 → Top PageRank
- **Valider structure communautés**: RQ3 → Clustering coefficient
- **Évaluer robustesse**: RQ1 → Diamètre/Composantes
- **Mesurer inégalité**: RQ6 → Coefficient Gini

---

## Références

- **Rapport**: WETH/Polygon Network Analysis (binome project)
- **D3.js**: Force-directed graph visualization
- **NetworkX equivalents**: Custom JavaScript implementations
- **Théorie**: Network Science (Newman, 2010)
