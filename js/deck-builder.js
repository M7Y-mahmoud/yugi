const MIN_MAIN_DECK_SIZE = 40;
const MAX_MAIN_DECK_SIZE = 60;
const MAX_EXTRA_DECK_SIZE = 15;
const MAX_SIDE_DECK_SIZE = 15;
const DECK_STORAGE_KEY = 'ygo_deck';

export let activeDeckSection = 'mainDeck'; // 'mainDeck' | 'extraDeck' | 'sideDeck'

export function setActiveDeckSection(section) {
  activeDeckSection = section;
}

export function getDeck() {
  const deckStr = sessionStorage.getItem(DECK_STORAGE_KEY);
  if (deckStr) {
    try {
      const parsed = JSON.parse(deckStr);
      if (Array.isArray(parsed)) {
        return { mainDeck: parsed, extraDeck: [], sideDeck: [] };
      }
      if (parsed && typeof parsed === 'object') {
        const toArr = (val) => Array.isArray(val) ? val : (val && typeof val === 'object' ? Object.values(val) : []);
        return {
          mainDeck: toArr(parsed.mainDeck || parsed.cards),
          extraDeck: toArr(parsed.extraDeck),
          sideDeck: toArr(parsed.sideDeck)
        };
      }
    } catch (e) {
      console.error("Error parsing deck from sessionStorage:", e);
    }
  }
  return { mainDeck: [], extraDeck: [], sideDeck: [] };
}

export function saveDeck(deck) {
  sessionStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck));
}

export function getDeckCount(section = 'mainDeck') {
  const d = getDeck();
  return (d[section] && Array.isArray(d[section])) ? d[section].length : 0;
}

export function toggleCardInDeck(cardId) {
  const deck = getDeck();
  const sec = activeDeckSection || 'mainDeck';
  if (!Array.isArray(deck[sec])) deck[sec] = [];
  const sectionArray = deck[sec];
  const index = sectionArray.indexOf(cardId);
  
  if (index > -1) {
    sectionArray.splice(index, 1);
    saveDeck(deck);
    return false; // Not selected anymore
  } else {
    let limit = sec === 'mainDeck' ? MAX_MAIN_DECK_SIZE : 15;
    if (sectionArray.length < limit) {
      sectionArray.push(cardId);
      saveDeck(deck);
      return true; // Selected
    } else {
      return false; // limit reached
    }
  }
}

export function isCardSelected(cardId) {
  const deck = getDeck();
  const sec = activeDeckSection || 'mainDeck';
  const sectionArray = Array.isArray(deck[sec]) ? deck[sec] : [];
  return sectionArray.includes(cardId);
}

export function clearDeck() {
  saveDeck({ mainDeck: [], extraDeck: [], sideDeck: [] });
}
