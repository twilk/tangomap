# Partner matching — evidence review & proposed algorithm

> Research done before implementation (deep-research harness: 5 search angles, 22
> sources fetched, 99 claims extracted, 25 verified by 3-vote adversarial refute,
> 22 confirmed / 3 refuted). This doc records what the evidence says and the
> algorithm we'll build. **TL;DR: match on shared repertoire + level proximity,
> gated by reciprocity — NOT "complementary strengths," which the evidence does
> not support for the core dance-partner case.**

## The question

Each dancer has a "Tango DNA": a 62-skill binary vector across 13 categories and
10 progressive levels. We want to suggest good **dance/practice partners** (and
maybe **learning partners**). Should the signal be shared repertoire, level
proximity, complementary gaps, reciprocity, or a blend?

## What the evidence says (2015–2025)

### 1. For a real-time joint task, SIMILAR skill wins — complementary does not
Tango is a real-time joint-motor-coordination task, and that's exactly the
regime where similarity beats complementarity.
- **Joint visual search** (Wahn, Czeszumski & König 2018, *PLOS One*): partner
  performance *similarity* predicted collective benefit — dyads r=.44 (p=.049),
  triads r=.55 (p=.011). [PMC5766227](https://pmc.ncbi.nlm.nih.gov/articles/PMC5766227/)
- **Joint object-control / motor coordination** (Wahn et al. 2016, *CogSci*):
  the *difference* in individual skill was "highly predictive" of the dyad's
  benefit — more-similar partners benefited more, and pairs with **>8% skill
  difference produced NEGATIVE gain.** [ResearchGate](https://www.researchgate.net/publication/308202429)
- Caveat: small n, one marginal p-value; lab perceptual/motor tasks, not dance.
  Directional, not a designed similar-vs-complementary trial.

### 2. Skill-based matchmaking: the operational signal is ability PROXIMITY
- **TrueSkill2** (Minka et al., Microsoft Research 2018): the matchmaking signal
  is the skill *rating*; richer inference lifted win-prediction 52%→68% on 3M
  Halo 5 matches. [MSR](https://www.microsoft.com/en-us/research/wp-content/uploads/2018/03/trueskill2.pdf)
- **Glicko-2 difficulty matching** (Sarkar et al. 2017, *FDG*, n=294): matching
  skill to difficulty ~**doubled** completed levels vs random (median 5 vs 2,
  r_rb=.42, p<.001). [Sarkar 2017](https://www.khoury.northeastern.edu/home/scooper/index_files/pub/sarkar2017engagement.pdf)

### 3. But perfect "fairness" isn't the optimum — a slight favorable gap + consistency
- **EOMM** (Chen et al., EA, *WWW* 2017; 36.9M matches): "matchmaking based on
  fairness is not optimal for engagement"; equal-skill is a degenerate special
  case (~15% more retained over 20 rounds in simulation). [arXiv 1702.06820](https://arxiv.org/pdf/1702.06820)
- **Kim et al. 2024** (*Heliyon*; ~6M matches): being matched slightly **weaker**
  opponents lowers churn more than perfectly fair; higher **variance** in skill
  gaps raises churn. Consistency matters as much as balance. [PMC10839887](https://pmc.ncbi.nlm.nih.gov/articles/PMC10839887/)

### 4. Reciprocity: two-sided scoring beats one-sided similarity
- **RECON** (Pizzato et al., *RecSys* 2010 / *UMUAI* 2013): combining x's
  preference for y AND y's for x (harmonic mean, biased to the smaller value)
  raised dating top-10 success **23% → 42%** vs one-sided. Person-to-person
  matching must satisfy both sides. [RECON](https://dl.acm.org/doi/10.1145/1864708.1864747)

### 5. Complementarity works only in narrow, ASYMMETRIC conditions
- **Team formation** (Büyükboyacı & Robbett 2019, *JEMS*): complementary skills
  pay off only with *specialization* + *self-selection* — an interaction effect,
  not a main effect. [JEMS](https://onlinelibrary.wiley.com/doi/full/10.1111/jems.12296)
- **Cross-age tutoring meta** (Chang et al., *Ed. Psych. Review* 2025; 32 studies):
  a deliberate ability *gap* with defined roles gives g=0.34, and **both** gain
  (tutors g=0.39, tutees g=0.33). [Springer](https://link.springer.com/article/10.1007/s10648-025-09997-z)
- **BUT the field experiment** (Kamei & Ashworth 2023, *JEBO*): large-ability-gap
  pairs beat similar-ability for learning (~3 marks, p=.031) — with the gain
  **flowing almost entirely to the weaker partner**; the stronger one's effect
  was "close to zero." Not mutual. [JEBO](https://www.sciencedirect.com/science/article/abs/pii/S016726812300015X)

### Where the "complementary strengths" intuition was REFUTED in verification
- MMORPG "people prefer skill-different collaborators (heterophily)" and
  "complementarity → higher output" — refuted 1-2 and 0-3. [nature srep18727](https://www.nature.com/articles/srep18727)
- "Mixed-ability grouping beats similar-ability for reading comprehension on
  average" — refuted 1-2. [sciencedirect S0361476X17302540](https://www.sciencedirect.com/science/article/abs/pii/S0361476X17302540)

## Recommendation

### Dance/practice partner (default) — symmetric, reciprocity-free-by-construction
Rank other dancers for `me` by a symmetric score:

```
score(A, B) = w_rep · repertoire(A,B) + w_lvl · levelProx(A,B)

repertoire(A,B) = Jaccard(mastered_A, mastered_B) = |A ∩ B| / |A ∪ B|
levelProx(A,B)  = 1 − |reach_A − reach_B| / 10     (reach = furthest level)
```

Why this is the evidence-backed choice:
- **Jaccard of the skill vectors** = the figures both dancers can actually
  execute together (shared repertoire), and it *already* encodes level similarity
  (a 59-skill and a 44-skill dancer cap at Jaccard ≤ 0.75), matching strands 1–2.
- **levelProx** makes the "≥8% difference → negative" coordination cliff explicit;
  penalize large gaps, tolerate a small one.
- **Reciprocity is free**: the score is symmetric, so a top match for A is a top
  match for B — no interaction history needed (solves RECON's cold-start problem
  for our small directory).
- Start `w_rep ≈ 0.7, w_lvl ≈ 0.3`; tune later.

### Learning partner (separate, optional mode) — asymmetric, honestly framed
Only here does complementarity belong, and only bounded:

```
learnScore(me ← them) = #{skills them has that me lacks, within a bounded gap}
gate: 1 ≤ (reach_them − reach_me) ≤ ~2–3 levels   (danceable-together bound)
```

Framing must be honest: **"@them can help you with N skills you haven't reached"**
— the beginner gains most; we do **not** tell the advanced dancer it improves
their dancing (ceiling effect: an advanced dancer already "has" most skills).

## Open parameters to decide
- `w_rep` / `w_lvl` weighting (no dance-specific study exists — start 0.7/0.3).
- Whether to prefer exact level parity or a small favorable gap (EOMM/Heliyon).
- Ship the learning mode now, or dance-partner only first.
- Does tango's leader/follower role structure make a skilled-leader + learning-
  follower pairing more like tutoring (complementarity OK) than symmetric
  practice? Unstudied — treat as a later experiment.
