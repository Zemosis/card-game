# Muushig — Rulebook

Muushig is a Mongolian trick-taking card game for **5 players**. Everyone starts
on **15 points**. Winning tricks takes points off your score; the **first player
to reach 0 wins the match**.

In Muushig, winning a trick is called **eating** it (you eat the pile).

The engine in `src/utils/muushig/` implements exactly these rules. If a rule
changes here, change it there and in the in-game rulebook
(`src/components/muushig/MuushigRules.jsx`).

---

## At a glance

| | |
|---|---|
| Players | 5 |
| Deck | 32 cards: 7, 8, 9, 10, J, Q, K, A in all four suits |
| Hand | 5 cards |
| Starting score | 15 |
| Tricks per round | 5 |
| Goal | Be the first to reach 0 points |

A round goes: **deal → play or fold → swap cards → dealer takes the trump →
5 tricks → scoring**.

---

## 1. Cards

- Ranks, low to high: **7, 8, 9, 10, J, Q, K, A**.
- Suits have **no order**. A card only beats another card of the **same suit**,
  unless it is a **trump**.
- Any **trump** beats any non-trump card. Between trumps, the higher rank wins.

---

## 2. The dealer

- **First round:** every player draws one card. The **highest rank deals**
  (ties are broken at random).
- **Later rounds:** the deal passes **clockwise** to the next player.

"Left of the dealer" means the next player clockwise.

---

## 3. Dealing and trump

1. The dealer deals **5 cards** to each player (25 cards).
2. The dealer turns the next card **face up** and sets it beside the pile. Its
   suit is **trump** for the whole round.
3. The remaining **6 cards** are the **draw pile**.

The table also has a **dead pile**: every discarded card and every folded hand
goes there face down. Cards in the dead pile never come back this round.

---

## 4. Play or fold

Starting **left of the dealer** and going clockwise (the dealer decides last),
each player says whether they **play** this round or **fold**.

- A folded player puts their hand on the dead pile and sits the round out.
  Their **score doesn't change**.
- **At least 2 players must play.** When the players still to decide are needed
  to reach 2, they can't fold.

---

## 5. Swapping cards

Starting **left of the dealer** and going clockwise (skipping folded players,
dealer last), each player may:

- **discard** any number of cards (0 to 5) onto the dead pile, and
- **draw** the same number from the draw pile.

You can't discard more cards than the draw pile holds. Once the draw pile is
empty, the players after that can't swap.

### The dealer takes the trump

After everyone has swapped, a dealer who is playing may **discard one card and
take the face-up trump card** into their hand. Unless every card they hold is
better than it, they should. Once it's taken, the trump card is gone from the
table; only its suit remains trump.

---

## 6. Playing tricks

- The **first trick** is led by the first playing player **left of the dealer**.
- Each later trick is led by **whoever ate the previous one**.
- Play goes **clockwise**; everyone who is playing puts down **one card**.

### What you must play

**Other suit led (not trump):**

- If you hold a card of the led suit that is **higher** than the highest card of
  that suit on the table, you **must** play one of them.
- Otherwise you may play **any card** — including a trump, to eat the pile.
- But if someone has already **trumped in** (played a trump on it), the trump
  rules below apply to you too.

**Trump led, or trumped in:**

- You should play a **higher trump** if you have one.
- If you have no higher trump, you should play **any trump**.
- If you have no trump at all, play any card.

Breaking a trump rule is allowed, but punished: see **Debuffed cards**.

### Who eats the pile

The **highest trump** on the table eats the pile. If no trump was played, the
**highest card of the led suit** does. A card of any other suit can never win.

On the table the trick is a **stack**: a card that beats the top card goes on
top, anything weaker is tucked underneath. When everyone has played, **whoever's
card is on top eats the pile**.

---

## 7. Debuffed cards

You get a **debuffed card** when you hold back a trump you were supposed to
play:

1. **Trump rule.** A trump was on the table — led, or played on top of another
   suit — and you didn't play a higher trump (or any trump, when you had no
   higher one). Your **highest trump left in hand** is debuffed. (If you must
   follow the led suit with a higher card, you do that instead: no debuff.)
2. **The Ace rule.** You hold the **Ace of trumps** and, on any trick where you
   are allowed to play it, you play something else. The Ace is debuffed. (If
   you're leading, you're always allowed to play it — so lead with it.)

A debuffed card:

- is shown greyed out and blurred with a **DEBUFFED** stamp,
- is the **weakest card** in the game — it can never eat a pile,
- **must be played on the next trick**; it's the only card you may play. You
  have forfeited that trick.

If a debuffed card is led, the led suit is set by the next card played.

---

## 8. Scoring

A round has exactly **5 tricks**. When they're done:

| Piles eaten this round | Score change |
|---|---|
| 0 (and you played) | **+5** |
| 1 to 5 | **−1 per pile** |
| Folded | no change |

Eating **all 5 piles** **wins the round**: you drop 5, and everyone else who
played ate nothing, so they each take +5.

## 9. Winning the match

The match ends after the first round in which someone reaches **0 or less**.
The **lowest score** wins; if that's a tie, the player who ate more piles in
that last round wins.
