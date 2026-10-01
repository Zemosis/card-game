import { describe, it, expect, vi } from "vitest";
import { COPIES, card, cards, ids, seededRandom } from "../helpers/cards.js";

describe.each(COPIES)("deckUtils (%s)", (_name, { deck: D }) => {
  describe("createDeck", () => {
    it("builds 52 unique cards with rank and suit values", () => {
      const deck = D.createDeck();
      expect(deck).toHaveLength(52);
      expect(new Set(ids(deck)).size).toBe(52);
      expect(deck[0]).toEqual({ rank: "3", suit: "♦", id: "3♦", rankValue: 0, suitValue: 0 });
      expect(deck.find((c) => c.id === "2♠")).toMatchObject({ rankValue: 12, suitValue: 3 });
    });
  });

  describe("shuffleDeck", () => {
    it("returns a new permutation and leaves the input alone", () => {
      const deck = D.createDeck();
      const before = ids(deck);
      const shuffled = D.shuffleDeck(deck, seededRandom(1));
      expect(shuffled).not.toBe(deck);
      expect(ids(deck)).toEqual(before);
      expect([...ids(shuffled)].sort()).toEqual([...before].sort());
      expect(ids(shuffled)).not.toEqual(before);
    });

    it("is reproducible under the same seed", () => {
      const a = D.shuffleDeck(D.createDeck(), seededRandom(7));
      const b = D.shuffleDeck(D.createDeck(), seededRandom(7));
      expect(ids(a)).toEqual(ids(b));
    });

    it("can reach every order, each from exactly one run of draws", () => {
      // Feed every possible pick at each step: 3 x 2 runs must give all 3! orders once.
      const orders = new Set();
      for (const first of [0, 1, 2])
        for (const second of [0, 1]) {
          const picks = [(first + 0.5) / 3, (second + 0.5) / 2];
          orders.add(D.shuffleDeck(["a", "b", "c"], () => picks.shift()).join(""));
        }
      expect(orders.size).toBe(6);
    });

    it("shuffles from the secure generator, never Math.random", () => {
      const insecure = vi.spyOn(Math, "random");
      const secure = vi.spyOn(globalThis.crypto, "getRandomValues");
      D.initializeGame();
      expect(insecure).not.toHaveBeenCalled();
      expect(secure).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  describe("dealCards", () => {
    it("deals 4 sorted hands of 13 with no overlap", () => {
      const hands = D.dealCards(D.shuffleDeck(D.createDeck(), seededRandom(3)));
      expect(hands).toHaveLength(4);
      hands.forEach((h) => {
        expect(h).toHaveLength(13);
        expect(ids(h)).toEqual(ids(D.sortHand(h)));
      });
      expect(new Set(hands.flat().map((c) => c.id)).size).toBe(52);
    });

    it("deals round-robin", () => {
      const deck = D.createDeck();
      const hands = D.dealCards(deck, 4, 2);
      expect(ids(hands[0])).toEqual(ids(D.sortHand([deck[0], deck[4]])));
      expect(ids(hands[3])).toEqual(ids(D.sortHand([deck[3], deck[7]])));
    });

    it("stops when the deck runs out", () => {
      const hands = D.dealCards(cards("3♦ 4♦ 5♦"), 2, 5);
      expect(hands.map((h) => h.length)).toEqual([2, 1]);
    });
  });

  describe("sorting", () => {
    it("sortHand orders by rank, then suit, without mutating", () => {
      const hand = cards("2♠ 3♠ 3♦ A♥ 10♣");
      expect(ids(D.sortHand(hand))).toEqual(["3♦", "3♠", "10♣", "A♥", "2♠"]);
      expect(ids(hand)).toEqual(["2♠", "3♠", "3♦", "A♥", "10♣"]);
    });

    if (D.sortHandBySuit) {
      it("sortHandBySuit orders by suit, then rank", () => {
        expect(ids(D.sortHandBySuit(cards("2♠ 3♠ 3♦ A♥ 10♣ 2♦")))).toEqual(["3♦", "2♦", "10♣", "A♥", "3♠", "2♠"]);
      });
    }
  });

  describe("comparing cards", () => {
    it("rank decides first, suit breaks ties", () => {
      expect(D.compareCards(card("8♦"), card("7♠"))).toBeGreaterThan(0);
      expect(D.compareCards(card("7♠"), card("7♥"))).toBeGreaterThan(0);
      expect(D.compareCards(card("7♦"), card("7♣"))).toBeLessThan(0);
      expect(D.compareCards(card("9♥"), card("9♥"))).toBe(0);
    });

    it("2♠ beats every card and 3♦ loses to every card", () => {
      D.createDeck().forEach((c) => {
        if (c.id !== "2♠") expect(D.isCardStronger(card("2♠"), c)).toBe(true);
        if (c.id !== "3♦") expect(D.isCardStronger(card("3♦"), c)).toBe(false);
      });
    });
  });

  describe("display", () => {
    it.each([
      ["A♠", "Ace of Spades"],
      ["10♦", "Ten of Diamonds"],
      ["2♥", "Two of Hearts"],
      ["J♣", "Jack of Clubs"],
    ])("%s is %s", (id, name) => {
      expect(D.getCardDisplay(card(id))).toBe(id);
      expect(D.getCardFullName(card(id))).toBe(name);
    });
  });

  describe("grouping and searching", () => {
    const hand = cards("3♦ 3♠ 7♥ 7♣ 7♦ K♠");

    it("groupByRank", () => {
      const g = D.groupByRank(hand);
      expect(Object.keys(g).sort()).toEqual(["3", "7", "K"]);
      expect(g["7"]).toHaveLength(3);
    });

    it("groupBySuit", () => {
      const g = D.groupBySuit(hand);
      expect(ids(g["♠"])).toEqual(["3♠", "K♠"]);
      expect(g["♥"]).toHaveLength(1);
    });

    it("findHighestCard / findLowestCard, null on empty", () => {
      expect(D.findHighestCard(hand).id).toBe("K♠");
      expect(D.findLowestCard(hand).id).toBe("3♦");
      expect(D.findHighestCard([])).toBeNull();
      expect(D.findLowestCard(null)).toBeNull();
    });

    it("removeCardsFromHand removes by id and keeps the rest", () => {
      expect(ids(D.removeCardsFromHand(hand, cards("7♥ K♠")))).toEqual(["3♦", "3♠", "7♣", "7♦"]);
      expect(D.removeCardsFromHand(hand, [])).toHaveLength(6);
    });

    it("handContainsCards", () => {
      expect(D.handContainsCards(hand, cards("3♦ K♠"))).toBe(true);
      expect(D.handContainsCards(hand, cards("3♦ 2♠"))).toBe(false);
      expect(D.handContainsCards(hand, [])).toBe(true);
    });

    it("findPlayerWithCard returns the seat or -1", () => {
      const hands = [cards("4♦"), cards("3♦ 5♠"), cards(""), cards("2♠")];
      expect(D.findPlayerWithCard(hands, "3", "♦")).toBe(1);
      expect(D.findPlayerWithCard(hands, "2", "♠")).toBe(3);
      expect(D.findPlayerWithCard(hands, "A", "♥")).toBe(-1);
    });
  });

  describe("initializeGame", () => {
    it("shuffles and deals a full game", () => {
      const { deck, hands } = D.initializeGame();
      expect(deck).toHaveLength(52);
      expect(hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
      expect(D.findPlayerWithCard(hands, "3", "♦")).toBeGreaterThanOrEqual(0);
    });
  });
});
