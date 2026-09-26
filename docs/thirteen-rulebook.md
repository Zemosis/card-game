# Thirteen — Rulebook

The rules the game enforces (`src/utils/handEvaluator.js`, `src/utils/gameLogic.js`;
the server runs the same files). The in-game version is
`src/components/thirteen/RulesModal.jsx` — keep the two in step.

## The goal

Be the **first to play every card** in your hand. Everyone else scores points for the
cards they still hold, and points are bad. Reach **25 points** and you are eliminated.
The **last player standing wins the match**.

- 4 players, 13 cards each, one 52-card deck (no jokers).

## Card order

- **Ranks**, low to high: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, **2**.
- **Suits** break ties between equal ranks, low to high: ♦ Diamonds < ♣ Clubs < ♥ Hearts < ♠ Spades.
- The **2♠** is the strongest single card; the **3♦** the weakest.

## Playing a round

1. Everyone is dealt 13 cards. In the first round the holder of the **3♦** leads
   (they don't have to play it). In later rounds, **the previous round's winner** leads.
2. The leader plays any combination, starting a **trick**. The leader can't pass.
3. Clockwise, each player plays a **higher combination of the same kind** (same number
   of cards) or **passes**.
4. **A pass locks you out** until the trick ends.
5. When everyone else has passed, the last player to play **takes the trick**, the table
   clears, and they lead again with anything.
6. The first player to empty their hand **wins the round**.

## Combinations

Plays are 1, 2, 3, 4 or 5 cards. Other sizes are not valid.

| Play | Cards | Beaten by |
| --- | --- | --- |
| Single | 1 | a higher single |
| Pair | 2 of a rank | a higher pair |
| Triple | 3 of a rank | a higher triple |
| Four of a kind | 4 of a rank | a higher four of a kind only |

There are **no bombs**: four of a kind cannot be played on 2s or anything but another
four of a kind.

### 5-card hands

Any 5-card hand beats any weaker **type** of 5-card hand, weakest to strongest:

1. **Straight** — five consecutive ranks, any suits. Exactly five cards. 2 is the top
   rank, so J-Q-K-A-2 is the highest straight; there is no wrap (A-2-3-4-5 is invalid).
2. **Flush** — five cards of one suit.
3. **Full house** — a triple plus a pair.
4. **Straight flush** — a straight in one suit.
5. **Royal flush** — 10-J-Q-K-A in one suit.

## Breaking ties (same kind)

- **Singles, pairs, triples, fours:** higher rank; on equal rank, the highest suit held.
- **Straights, flushes, straight flushes:** highest card's rank, then its suit.
- **Full houses:** rank of the triple (then of the pair).

## Scoring

- When a player goes out, every other player scores **1 point per card left**.
- Holding **10 or more cards doubles** those points (11 cards = 22).
- Points add up across rounds. At **25 or more** a player is eliminated and sits out.
- When one player remains, they win the match (a match win is recorded) and the host
  can start a rematch.

## Controls

- Click a card to select it; **Shift**-click selects a range.
- **Space** plays the selection, **P** passes.
- **Sort** arranges the hand by rank or by suit; **Clear / All** change the selection.
