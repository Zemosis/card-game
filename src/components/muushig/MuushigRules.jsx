// MUUSHIG RULES — the Muushig rulebook, opened from the table header.
//
// Follows docs/muushig-rulebook.md section by section, and the engine in
// utils/muushig/engine.js implements the same rules. If a rule changes, change
// all three. Examples are drawn with real PixelCards.

import React from "react";
import { PixelCard } from "../PixelCard";
import Rulebook, { Callout, CardRow, Cards, Hi, Kbd, Key, Section, Steps, Versus } from "../Rulebook";
import { MAX_FOLDS_IN_A_ROW, MIN_PLAYING, START_SCORE, TRICKS_PER_ROUND, ZERO_PILES_PENALTY } from "../../utils/muushig/engine";

const SECTIONS = [
  ["goal", "The goal"],
  ["cards", "Cards"],
  ["deal", "Dealer, deal, trump"],
  ["join", "Go in or fold"],
  ["swap", "Swapping cards"],
  ["tricks", "Playing tricks"],
  ["debuff", "Debuffed cards"],
  ["scoring", "Scoring"],
  ["controls", "Controls"],
];

export default function MuushigRules({ onClose }) {
  return (
    <Rulebook
      title="HOW TO PLAY MUUSHIG"
      subtitle="Eat piles to count down to zero · 5 players"
      headerCards="7♣ J♥ K♠ A♦"
      sections={SECTIONS}
      onClose={onClose}
    >
      <Section id="goal" n={1} title="The goal">
        <p>
          Everyone starts on <Key>{START_SCORE} points</Key>. Winning a trick is called <Key>eating</Key> the pile, and every
          pile you eat takes a point off your score. The <Key>first player to reach 0 wins the match</Key>.
        </p>
        <p>
          Go in and eat nothing, and you <Hi color="#e85a7a">gain {ZERO_PILES_PENALTY} points</Hi>. So every hand is a
          choice: go in and fight for piles, or fold and sit it out.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
          {[
            ["5", "players"],
            ["5", "cards each"],
            ["32", "card deck"],
            [String(START_SCORE), "points to shed"],
          ].map(([big, small]) => (
            <div key={small} className="px-3 py-3 text-center" style={{ backgroundColor: "#14102a", boxShadow: "0 0 0 2px #1f1a3d" }}>
              <div className="font-pixel-display text-[18px] text-glow-gold">{big}</div>
              <div className="font-pixel-body text-[18px] text-bone/70 leading-none mt-1.5">{small}</div>
            </div>
          ))}
        </div>
        <p>
          A round goes: <Key>deal → go in or fold → swap cards → dealer takes the trump → {TRICKS_PER_ROUND} tricks →
          scoring</Key>.
        </p>
      </Section>

      <Section id="cards" n={2} title="Cards">
        <p>
          Only <Key>7 through Ace</Key> are used, in all four suits: 32 cards, no jokers.
        </p>
        <div className="overflow-x-auto py-2">
          <div className="min-w-max">
            <Cards spec="7♥ 8♥ 9♥ 10♥ J♥ Q♥ K♥ A♥" width={40} overlap={-0.1} />
          </div>
          <div className="flex justify-between font-pixel-display text-[10px] mt-2 min-w-max" style={{ width: 8 * 44 - 4 }}>
            <span className="text-bone/60">LOW</span>
            <span className="text-glow-gold">HIGH</span>
          </div>
        </div>
        <p>
          Suits have <Key>no order</Key>. A card only beats another card of the <Key>same suit</Key>, unless it's a{" "}
          <Key>trump</Key>: any trump beats any non-trump card.
        </p>
        <Versus win="7♣" lose="7♠" caption="clubs were led, so the 7♣ holds" />
      </Section>

      <Section id="deal" n={3} title="Dealer, deal, trump">
        <Steps
          items={[
            <>
              First round: everyone draws a card and the <Key>highest rank deals</Key> (ties at random). After that the deal
              passes <Key>clockwise</Key>.
            </>,
            <>
              The dealer gives everyone <Key>5 cards</Key>.
            </>,
            <>
              The next card is turned <Key>face up</Key> and set on the table. Its suit is <Key>trump</Key> for the whole
              round.
            </>,
            <>
              The last <Key>6 cards</Key> are the <Key>draw pile</Key>.
            </>,
          ]}
        />
        <p>
          The table also has a <Key>dead pile</Key>: every discarded card and every folded hand goes there face down, and
          never comes back this round.
        </p>
      </Section>

      <Section id="join" n={4} title="Go in or fold">
        <p>
          Starting <Key>left of the dealer</Key> and going clockwise (the dealer decides last), each player says whether they{" "}
          <Key>go in</Key> this round or <Key>fold</Key>.
        </p>
        <p>
          A folded hand goes to the dead pile and its player sits the round out. Their <Hi>score doesn't change</Hi>: a
          safe choice with a bad hand.
        </p>
        <Callout tone="rule" title={`AT LEAST ${MIN_PLAYING} MUST GO IN`}>
          When the players still to decide are needed to make {MIN_PLAYING}, they can't fold.
        </Callout>
        <Callout tone="rule" title={`NO ${MAX_FOLDS_IN_A_ROW + 1} FOLDS IN A ROW`}>
          Fold {MAX_FOLDS_IN_A_ROW} rounds in a row and you <Key>must go in</Key> on the next one, whatever your hand.
          Going in starts the count over.
        </Callout>
      </Section>

      <Section id="swap" n={5} title="Swapping cards">
        <p>
          Starting left of the dealer (skipping folded players, dealer last), each player may <Key>discard</Key> any
          number of cards onto the dead pile and <Key>draw</Key> the same number from the draw pile.
        </p>
        <p>
          You can't discard more cards than the draw pile holds. Once it's empty, the players after that can't swap, and
          the dead pile takes its spot on the table.
        </p>
        <Callout tone="tip" title="THE DEALER TAKES THE TRUMP">
          After everyone has swapped, a dealer who is playing may <Key>discard one card and take the face-up trump</Key>.
          Unless every card they hold is better than it, they should. Once it's taken, the table shows just the trump
          suit.
        </Callout>
      </Section>

      <Section id="tricks" n={6} title="Playing tricks">
        <p>
          The <Key>first trick</Key> is led by the first playing player left of the dealer. Each later trick is led by{" "}
          <Key>whoever ate the last one</Key>. Play goes clockwise, one card each.
        </p>
        <div className="flex flex-col gap-2">
          <CardRow
            name="OTHER SUIT LED"
            spec="9♠"
            text="If you hold a higher card of that suit, you must play one. Otherwise play anything, a trump included."
            extra="Once someone has trumped in, the trump rule below applies to you too."
          />
          <CardRow
            name="TRUMP LED OR TRUMPED IN"
            spec="Q♦"
            text="You should play a higher trump; with no higher one, any trump; with no trump at all, anything."
            extra="Breaking this is allowed, but it debuffs a card (see Debuffed cards)."
          />
        </div>
        <p>
          The <Key>highest trump</Key> eats the pile. With no trump played, the <Key>highest card of the led suit</Key>{" "}
          does. A card of any other suit never wins.
        </p>
        <Versus win="8♦" lose="A♠" caption="with ♦ trump, even a small trump eats the ace" />
        <Callout tone="rule" title="THE STACK">
          The trick is stacked in the middle of the table. A card that <Key>beats the top card</Key> goes on top; anything
          weaker is tucked underneath. When everyone has played, <Key>whoever's card is on top eats the pile</Key>.
        </Callout>
      </Section>

      <Section id="debuff" n={7} title="Debuffed cards">
        <p>You get a debuffed card for holding back a trump you were supposed to play:</p>
        <Steps
          items={[
            <>
              <Key>Trump rule.</Key> A trump was on the table (led, or played on top of another suit) and you didn't play
              a higher trump (or any trump, when you had no higher one). Your <Key>highest trump left</Key> is debuffed.
              If you must follow the led suit with a higher card, you do that instead.
            </>,
            <>
              <Key>Ace rule.</Key> You hold the <Key>Ace of trumps</Key> and, on a trick where you're allowed to play it,
              you play something else. The Ace is debuffed. When you lead you're always allowed to play it, so lead with
              it.
            </>,
          ]}
        />
        <div className="flex items-center gap-5 flex-wrap mt-1">
          <PixelCard rank="A" suit="♦" width={56} debuffed />
          <ul className="flex flex-col gap-1.5">
            <li>
              It's the <Hi color="#e85a7a">weakest card</Hi> in the game: it can never eat a pile.
            </li>
            <li>
              It's <Key>the only card you may play on the next trick</Key>, so you give that pile away.
            </li>
            <li>If it's led, the next card played sets the suit.</li>
          </ul>
        </div>
        <Callout tone="warn" title="EXAMPLE">
          Trumps are ♦. The leader plays K♦. You hold A♦ but play 10♦: your A♦ is debuffed, and next trick you must throw
          it. Nothing warns you first: the card is slashed and stamped the moment you misplay.
        </Callout>
      </Section>

      <Section id="scoring" n={8} title="Scoring">
        <p>
          Every round is exactly <Key>{TRICKS_PER_ROUND} tricks</Key>. When they're done:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full max-w-[520px] font-pixel-body text-[20px]" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
            <thead>
              <tr className="font-pixel-display text-[10px] text-bone/60 text-left">
                <th className="px-3 py-1 font-normal">PILES EATEN</th>
                <th className="px-3 py-1 font-normal">SCORE CHANGE</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["0 (and you went in)", `+${ZERO_PILES_PENALTY}`, "#e85a7a"],
                ["1", "-1", "#9bd14f"],
                ["3", "-3", "#9bd14f"],
                ["5 (round won)", "-5", "#9bd14f"],
                ["folded", "no change", "#c8b890"],
              ].map(([n, d, c]) => (
                <tr key={n} style={{ backgroundColor: "#14102a" }}>
                  <td className="px-3 py-1.5">{n}</td>
                  <td className="px-3 py-1.5" style={{ color: c }}>
                    {d}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="rule" title="5 EATEN = ROUND WON">
          Eat <Key>all 5 piles</Key> and you <Key>win the round</Key>: you drop 5 points, and everyone else who went in ate
          nothing, so they all take <Hi color="#e85a7a">+{ZERO_PILES_PENALTY}</Hi>.
        </Callout>
        <p>
          The match ends after the first round in which someone reaches <Key>0 or less</Key>. The <Key>lowest score</Key>{" "}
          wins; on a tie, whoever ate more piles in that last round.
        </p>
      </Section>

      <Section id="controls" n={9} title="Controls">
        <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(140px,auto) 1fr" }}>
          {[
            [<>GO IN / FOLD</>, "Join the round or sit it out"],
            [<>Click cards</>, "Swapping: pick the cards to discard. Dealer: pick the card to give up for the trump"],
            [<>Click a card</>, "Tricks: pick the card to throw (dimmed cards aren't allowed right now)"],
            [<Kbd>SPACE</Kbd>, "The highlighted button: GO IN, SWAP, TAKE TRUMP or THROW"],
            [<>SORT</>, "Arrange your hand by rank or by suit"],
          ].map(([k, v], i) => (
            <React.Fragment key={i}>
              <div className="font-pixel-display text-[10px] text-parchment flex items-center">{k}</div>
              <div className="text-bone/80">{v}</div>
            </React.Fragment>
          ))}
        </div>
        <Callout tone="tip" title="GOOD LUCK">
          One eaten pile beats none by six points, so don't go in with a hand that can't eat.
        </Callout>
      </Section>
    </Rulebook>
  );
}
