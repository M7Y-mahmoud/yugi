const MIN_DECK_SIZE = 40;
const MAX_DECK_SIZE = 60;
const DECK_STORAGE_KEY = 'ygo_deck';

export function getDeck() {
  const deckStr = sessionStorage.getItem(DECK_STORAGE_KEY);
  return deckStr ? JSON.parse(deckStr) : [];
}

export function saveDeck(deck) {
  sessionStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck));
}

export function getDeckCount() {
  return getDeck().length;
}

export function toggleCardInDeck(cardId) {
  const deck = getDeck();
  const index = deck.indexOf(cardId);
  
  if (index > -1) {
    deck.splice(index, 1);
    saveDeck(deck);
    return false; // Not selected anymore
  } else {
    if (deck.length < MAX_DECK_SIZE) {
      deck.push(cardId);
      saveDeck(deck);
      return true; // Selected
    } else {
      return false; // Still not selected (limit reached)
    }
  }
}

export function isCardSelected(cardId) {
  const deck = getDeck();
  return deck.includes(cardId);
}

export function clearDeck() {
  saveDeck([]);
}
