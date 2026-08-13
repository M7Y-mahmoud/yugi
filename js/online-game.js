import { setupCardPreview } from "./card-preview.js";
import { getCardDetailsAr } from "./card-translator.js";
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

const CARD_BACK_URL = 'public/assets/images/card-back.jpg';

// Room & Network State
let currentRoomCode = null;
let localPlayerRole = 'P1'; // 'P1' or 'P2'
let isRoomHost = false;
let roomData = null;
let gameCountdownStarted = false;

let localUser = {
  uid: null,
  name: 'متبارز',
  avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Duelist'
};

// Dueling State
let activeTurn = 'P1'; // 'P1' or 'P2'
let activePhase = 'MAIN1';
let allCardsList = [];

let turnState = {
  hasDrawnThisTurn: true,
  hasSummonedThisTurn: false
};

// Player 1 State
const p1State = {
  id: 'P1',
  name: 'متبارز 1',
  avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=P1',
  lp: 8000,
  deck: [],
  hand: [],
  monsters: [null, null, null, null, null],
  spells: [null, null, null, null, null],
  graveyard: []
};

// Player 2 State
const p2State = {
  id: 'P2',
  name: 'متبارز 2',
  avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=P2',
  lp: 8000,
  deck: [],
  hand: [],
  monsters: [null, null, null, null, null],
  spells: [null, null, null, null, null],
  graveyard: []
};

let selectedCardContext = null;
let pendingTributeData = null;

document.addEventListener('DOMContentLoaded', () => {
  setupCardPreview();
  initOnlineArena();
});

async function initOnlineArena() {
  logAction('⚡ جاري تجهيز حلبة المبارزة أونلاين وتحميل قاعدة البطاقات...');

  try {
    const snapshot = await get(ref(db, 'cards'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      allCardsList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    }
  } catch (err) {
    console.warn("Could not load cards from DB, using fallback dataset:", err);
  }

  // Fallback cards
  if (allCardsList.length === 0) {
    allCardsList = [
      { id: 'c1', name: 'Dark Magician', nameAr: 'الساحر المظلم', type: 'monster', atk: 2500, def: 2100, level: 7, imageUrl: 'https://images.ygoprodeck.com/images/cards/46986414.jpg', desc: 'الساحر النهائي من حيث الهجوم والدفاع.' },
      { id: 'c2', name: 'Blue-Eyes White Dragon', nameAr: 'التنين الأبيض أزرق العينين', type: 'monster', atk: 3000, def: 2500, level: 8, imageUrl: 'https://images.ygoprodeck.com/images/cards/89631139.jpg', desc: 'هذا التنين الأسطوري هو محرك دمار قوي.' },
      { id: 'c3', name: 'Monster Reborn', nameAr: 'إحياء الوحش', type: 'spell', imageUrl: 'https://images.ygoprodeck.com/images/cards/83764718.jpg', desc: 'استهدف وحشاً في أي من المقبرتين واستدعه خاصاً.' },
      { id: 'c4', name: 'Mirror Force', nameAr: 'القوة العاكسة', type: 'trap', imageUrl: 'https://images.ygoprodeck.com/images/cards/44095762.jpg', desc: 'عندما يُعلن وحش الخصم هجوماً: دمر جميع وحوش الخصم في وضع الهجوم.' },
      { id: 'c5', name: 'Red-Eyes Black Dragon', nameAr: 'التنين الأسود أحمر العينين', type: 'monster', atk: 2400, def: 2000, level: 7, imageUrl: 'https://images.ygoprodeck.com/images/cards/74677422.jpg', desc: 'تنين ذو هجوم ناري شرس.' },
    ];
  }

  setupEventListeners();

  // Authentication & Guest Handler
  onAuthStateChanged(auth, async (user) => {
    if (user && !user.isAnonymous) {
      localUser.uid = user.uid;
      try {
        const uSnap = await get(ref(db, `users/${user.uid}`));
        if (uSnap.exists()) {
          const uVal = uSnap.val();
          localUser.name = uVal.username || uVal.displayName || user.displayName || 'متبارز';
          localUser.avatar = uVal.avatarUrl || uVal.photoURL || `https://api.dicebear.com/9.x/adventurer/svg?seed=${user.uid}`;
        } else {
          localUser.name = user.displayName || user.email?.split('@')[0] || 'متبارز';
          localUser.avatar = user.photoURL || `https://api.dicebear.com/9.x/adventurer/svg?seed=${user.uid}`;
        }
      } catch (e) {
        localUser.name = user.displayName || 'متبارز';
        localUser.avatar = `https://api.dicebear.com/9.x/adventurer/svg?seed=${user.uid}`;
      }
    } else {
      if (!user) {
        try {
          const anonRes = await signInAnonymously(auth);
          localUser.uid = anonRes.user.uid;
        } catch (e) {
          localUser.uid = 'guest-' + Math.random().toString(36).substring(2, 8);
        }
      } else {
        localUser.uid = user.uid;
      }
      localUser.name = `متبارز-${Math.floor(1000 + Math.random() * 9000)}`;
      localUser.avatar = `https://api.dicebear.com/9.x/adventurer/svg?seed=${localUser.uid}`;
    }

    const nicknameInput = document.getElementById('lobby-nickname-input');
    if (nicknameInput) nicknameInput.value = localUser.name;

    connectToRoom();
  });
}

function getRoomCodeFromURL() {
  const params = new URLSearchParams(window.location.search);
  let room = params.get('room');
  if (!room) {
    room = 'ONLINE-' + Math.floor(1000 + Math.random() * 9000);
    window.history.replaceState({}, '', '?room=' + room);
  } else {
    room = room.toUpperCase();
  }
  return room;
}

function connectToRoom() {
  currentRoomCode = getRoomCodeFromURL();

  document.getElementById('room-code-text').textContent = currentRoomCode;
  document.getElementById('lobby-room-url').textContent = window.location.href;

  const roomRef = ref(db, `rooms/${currentRoomCode}`);

  onValue(roomRef, async (snapshot) => {
    if (!snapshot.exists()) {
      localPlayerRole = 'P1';
      isRoomHost = true;

      const newRoom = {
        code: currentRoomCode,
        status: 'waiting',
        createdAt: Date.now(),
        players: {
          P1: {
            uid: localUser.uid,
            name: localUser.name,
            avatar: localUser.avatar,
            isReady: false
          }
        }
      };
      await set(roomRef, newRoom);
      return;
    }

    const room = snapshot.val();
    roomData = room;

    const players = room.players || {};
    if (players.P1 && players.P1.uid === localUser.uid) {
      localPlayerRole = 'P1';
      isRoomHost = true;
    } else if (players.P2 && players.P2.uid === localUser.uid) {
      localPlayerRole = 'P2';
      isRoomHost = false;
    } else if (players.P1 && !players.P2) {
      localPlayerRole = 'P2';
      isRoomHost = false;
      await update(ref(db, `rooms/${currentRoomCode}/players/P2`), {
        uid: localUser.uid,
        name: localUser.name,
        avatar: localUser.avatar,
        isReady: false
      });
      return;
    } else if (!players.P1) {
      localPlayerRole = 'P1';
      isRoomHost = true;
      await update(ref(db, `rooms/${currentRoomCode}/players/P1`), {
        uid: localUser.uid,
        name: localUser.name,
        avatar: localUser.avatar,
        isReady: false
      });
      return;
    }

    updateLobbyUI(room);

    if (room.status === 'in_progress' && room.gameState) {
      syncGameStateFromRoom(room.gameState);
      if (document.getElementById('lobby-modal').style.display !== 'none') {
        startDuelWithCountdown();
      }
    }
  });
}

function updateLobbyUI(room) {
  const p1 = room.players?.P1;
  const p2 = room.players?.P2;

  const p1NameEl = document.getElementById('lobby-p1-name');
  const p1AvatarEl = document.getElementById('lobby-p1-avatar');
  const p1StatusEl = document.getElementById('lobby-p1-status');

  if (p1) {
    p1NameEl.textContent = p1.name;
    p1AvatarEl.src = p1.avatar;
    if (p1.isReady) {
      p1StatusEl.innerHTML = '<i class="ph ph-check-circle"></i> جاهز للمبارزة 🟢';
      p1StatusEl.style.color = '#22c55e';
    } else {
      p1StatusEl.innerHTML = '<i class="ph ph-x-circle"></i> غير مستعد 🔴';
      p1StatusEl.style.color = '#ef4444';
    }
  }

  const p2NameEl = document.getElementById('lobby-p2-name');
  const p2AvatarEl = document.getElementById('lobby-p2-avatar');
  const p2StatusEl = document.getElementById('lobby-p2-status');

  if (p2) {
    p2NameEl.textContent = p2.name;
    p2NameEl.style.fontStyle = 'normal';
    p2NameEl.style.color = '#fff';
    p2AvatarEl.src = p2.avatar;
    p2AvatarEl.style.opacity = '1';
    p2AvatarEl.style.borderStyle = 'solid';

    if (p2.isReady) {
      p2StatusEl.innerHTML = '<i class="ph ph-check-circle"></i> جاهز للمبارزة 🟢';
      p2StatusEl.style.color = '#22c55e';
    } else {
      p2StatusEl.innerHTML = '<i class="ph ph-x-circle"></i> غير مستعد 🔴';
      p2StatusEl.style.color = '#ef4444';
    }
  } else {
    p2NameEl.textContent = 'في انتظار انضمام الصديق...';
    p2NameEl.style.fontStyle = 'italic';
    p2NameEl.style.color = '#a1a1aa';
    p2AvatarEl.src = 'https://api.dicebear.com/9.x/adventurer/svg?seed=Waiting';
    p2AvatarEl.style.opacity = '0.5';
    p2AvatarEl.style.borderStyle = 'dashed';
    p2StatusEl.innerHTML = '<i class="ph ph-hourglass-high"></i> لم ينضم بعد';
    p2StatusEl.style.color = '#eab308';
  }

  const readyBtn = document.getElementById('lobby-ready-btn');
  const noticeEl = document.getElementById('lobby-status-notice');

  const myPlayer = (localPlayerRole === 'P1') ? p1 : p2;
  const otherPlayer = (localPlayerRole === 'P1') ? p2 : p1;

  if (!p1 || !p2) {
    readyBtn.disabled = true;
    readyBtn.innerHTML = '<i class="ph ph-hourglass-high"></i> في انتظار انضمام المنافس عبر الرابط...';
    readyBtn.style.background = 'rgba(255,255,255,0.1)';
    readyBtn.style.color = '#a1a1aa';
    noticeEl.innerHTML = '<i class="ph ph-info"></i> ارسل رابط الغرفة لصديقك للانضمام، ثم اضغطا على زر الاستعداد.';
  } else {
    readyBtn.disabled = false;
    if (myPlayer && myPlayer.isReady) {
      readyBtn.innerHTML = '<i class="ph ph-check-circle"></i> أنت مستعد! (اضغط للإلغاء)';
      readyBtn.style.background = 'linear-gradient(135deg, #059669, #047857)';
      readyBtn.style.color = '#fff';
      if (otherPlayer && !otherPlayer.isReady) {
        noticeEl.innerHTML = `⏳ في انتظار انضمام ${otherPlayer.name} بالضغط على زر الاستعداد...`;
      } else {
        noticeEl.innerHTML = '✨ كلا اللاعبين مستعدان! جاري بدء المبارزة...';
      }
    } else {
      readyBtn.innerHTML = '⚡ أنا مستعد للمبارزة (Ready)';
      readyBtn.style.background = 'linear-gradient(135deg, #22c55e, #15803d)';
      readyBtn.style.color = '#fff';
      noticeEl.innerHTML = 'اضغط على الزر أعلاه عندما تكون جاهزاً للقتال!';
    }
  }

  if (p1 && p2 && p1.isReady && p2.isReady && room.status === 'waiting' && isRoomHost) {
    initializeAndStartGame(room);
  }
}

async function initializeAndStartGame(room) {
  const p1Name = room.players.P1.name;
  const p1Avatar = room.players.P1.avatar;
  const p2Name = room.players.P2.name;
  const p2Avatar = room.players.P2.avatar;

  const deck1 = generateRandomDeck(allCardsList, 60);
  const deck2 = generateRandomDeck(allCardsList, 60);

  const hand1 = deck1.splice(0, 5);
  const hand2 = deck2.splice(0, 5);

  const initialGameState = {
    activeTurn: 'P1',
    p1State: {
      id: 'P1',
      name: p1Name,
      avatar: p1Avatar,
      lp: 8000,
      deck: deck1,
      hand: hand1,
      monsters: [null, null, null, null, null],
      spells: [null, null, null, null, null],
      graveyard: []
    },
    p2State: {
      id: 'P2',
      name: p2Name,
      avatar: p2Avatar,
      lp: 8000,
      deck: deck2,
      hand: hand2,
      monsters: [null, null, null, null, null],
      spells: [null, null, null, null, null],
      graveyard: []
    },
    turnState: {
      hasDrawnThisTurn: true,
      hasSummonedThisTurn: false
    },
    logs: [`⚔️ بدأت المبارزة أونلاين بين [${p1Name}] و [${p2Name}]!`]
  };

  await update(ref(db, `rooms/${currentRoomCode}`), {
    status: 'in_progress',
    gameState: initialGameState
  });
}

function startDuelWithCountdown() {
  if (gameCountdownStarted) return;
  gameCountdownStarted = true;

  const countdownModal = document.getElementById('duel-countdown-modal');
  const numEl = document.getElementById('countdown-num');
  if (countdownModal) countdownModal.style.display = 'flex';

  let count = 3;
  if (numEl) numEl.textContent = count;

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      if (numEl) numEl.textContent = count;
    } else {
      clearInterval(timer);
      if (countdownModal) countdownModal.style.display = 'none';
      document.getElementById('lobby-modal').style.display = 'none';
      renderArena();
    }
  }, 1000);
}

function generateRandomDeck(cardsPool, size) {
  let deck = [];
  const ids = cardsPool.map(c => c.id);
  let pool = [];
  ids.forEach(id => pool.push(id, id, id));

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const chosenIds = pool.slice(0, size);
  chosenIds.forEach(id => {
    const found = cardsPool.find(c => c.id === id);
    if (found) deck.push({ ...found, instanceId: Math.random().toString(36).substring(2, 9) });
  });

  return deck;
}

function setupEventListeners() {
  // Save Nickname Button
  document.getElementById('save-nickname-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('lobby-nickname-input');
    if (input && input.value.trim()) {
      localUser.name = input.value.trim();
      if (currentRoomCode && localPlayerRole) {
        await update(ref(db, `rooms/${currentRoomCode}/players/${localPlayerRole}`), {
          name: localUser.name
        });
        alert('تم حفظ اسمك بنجاح!');
      }
    }
  });

  // Ready Button Toggle
  document.getElementById('lobby-ready-btn')?.addEventListener('click', async () => {
    if (!roomData || !roomData.players) return;
    const myPlayer = roomData.players[localPlayerRole];
    if (!myPlayer) return;

    const newReadyState = !myPlayer.isReady;
    await update(ref(db, `rooms/${currentRoomCode}/players/${localPlayerRole}`), {
      isReady: newReadyState
    });
  });

  // Copy Link Handlers
  const copyRoomHandler = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('📋 تم نسخ رابط الغرفة بنجاح! أرسله لصديقك للانضمام.');
  };
  document.getElementById('lobby-copy-link-btn')?.addEventListener('click', copyRoomHandler);
  document.getElementById('copy-room-btn')?.addEventListener('click', copyRoomHandler);

  // Perspective toggle button
  document.getElementById('perspective-toggle-btn')?.addEventListener('click', () => {
    alert(`أنت الآن يلعب كـ [${localPlayerRole === 'P1' ? p1State.name : p2State.name}] في حلبة المبارزة أونلاين.`);
  });

  // Draw card button
  document.getElementById('btn-draw-card')?.addEventListener('click', () => {
    if (activeTurn !== localPlayerRole) {
      alert('ليس دورك الآن! انتظر حتى ينتهي الخصم من دوره.');
      return;
    }
    if (turnState.hasDrawnThisTurn) {
      alert('لقد قمت بسحب كارت في هذا الدور بالفعل!');
      return;
    }
    const myState = (localPlayerRole === 'P1') ? p1State : p2State;
    if (myState.deck.length > 0) {
      const drawn = myState.deck.pop();
      myState.hand.push(drawn);
      turnState.hasDrawnThisTurn = true;
      logAction(`🎴 سحب ${myState.name} كارت جديد [${drawn.nameAr || drawn.name}].`);
      renderArena();
      pushGameStateToFirebase();
    } else {
      alert('مجموعتك فارغة!');
    }
  });

  // End turn button
  document.getElementById('btn-end-turn')?.addEventListener('click', () => {
    if (activeTurn !== localPlayerRole) {
      alert('انتظر حتى ينتهي الخصم من دوره!');
      return;
    }
    const myState = (localPlayerRole === 'P1') ? p1State : p2State;
    const oppState = (localPlayerRole === 'P1') ? p2State : p1State;

    activeTurn = (localPlayerRole === 'P1') ? 'P2' : 'P1';
    myState.monsters.forEach(m => { if (m) m.hasAttackedThisTurn = false; });

    turnState.hasDrawnThisTurn = false;
    turnState.hasSummonedThisTurn = false;

    logAction(`⌛ أنهى ${myState.name} دوره! عاد الدور إلى ${oppState.name}.`);
    renderArena();
    pushGameStateToFirebase();
  });

  // LP Quick Controls
  setupLPButtons();

  // Dice & Coin buttons
  document.getElementById('btn-dice-roll')?.addEventListener('click', () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    logAction(`🎲 رمى ${localUser.name} النرد: (${roll})!`);
  });

  document.getElementById('btn-coin-flip')?.addEventListener('click', () => {
    const result = Math.random() > 0.5 ? 'ملك 👑' : 'كتابة 🦅';
    logAction(`🪙 رمى ${localUser.name} الكوين: (${result})!`);
  });

  // Close context menu on outside click
  document.addEventListener('click', (e) => {
    const ctx = document.getElementById('online-context-menu');
    if (ctx && !ctx.contains(e.target)) {
      ctx.style.display = 'none';
    }
  });

  // Close Modals
  document.getElementById('close-card-details-btn')?.addEventListener('click', () => {
    document.getElementById('card-details-modal').style.display = 'none';
  });

  document.getElementById('close-target-modal-btn')?.addEventListener('click', () => {
    document.getElementById('attack-target-modal').style.display = 'none';
  });

  document.getElementById('close-pile-modal-btn')?.addEventListener('click', () => {
    document.getElementById('pile-viewer-modal').style.display = 'none';
  });

  document.getElementById('close-tribute-modal-btn')?.addEventListener('click', () => {
    document.getElementById('tribute-select-modal').style.display = 'none';
    pendingTributeData = null;
  });

  document.getElementById('confirm-tribute-btn')?.addEventListener('click', () => {
    handleConfirmTribute();
  });

  setupPileClickListeners();
  setupContextMenuActions();
}

async function pushGameStateToFirebase() {
  if (!currentRoomCode) return;
  const stateToPush = {
    activeTurn,
    p1State,
    p2State,
    turnState,
    lastUpdate: Date.now()
  };
  try {
    await update(ref(db, `rooms/${currentRoomCode}/gameState`), stateToPush);
  } catch (err) {
    console.error("Error syncing state to Firebase:", err);
  }
}

function syncGameStateFromRoom(gs) {
  if (!gs) return;

  activeTurn = gs.activeTurn || 'P1';
  if (gs.p1State) Object.assign(p1State, gs.p1State);
  if (gs.p2State) Object.assign(p2State, gs.p2State);
  if (gs.turnState) Object.assign(turnState, gs.turnState);

  renderArena();
}

function setupPileClickListeners() {
  const pileBindings = [
    { id: 'you-grave-zone', pile: 'graveyard', owner: localPlayerRole },
    { id: 'opp-grave-zone', pile: 'graveyard', owner: (localPlayerRole === 'P1' ? 'P2' : 'P1') },
    { id: 'you-deck-zone', pile: 'deck', owner: localPlayerRole },
    { id: 'opp-deck-zone', pile: 'deck', owner: (localPlayerRole === 'P1' ? 'P2' : 'P1') },
    { id: 'you-grave-count', pile: 'graveyard', owner: localPlayerRole },
    { id: 'you-grave-count-num', pile: 'graveyard', owner: localPlayerRole },
    { id: 'opp-grave-count', pile: 'graveyard', owner: (localPlayerRole === 'P1' ? 'P2' : 'P1') },
    { id: 'you-deck-count', pile: 'deck', owner: localPlayerRole },
    { id: 'you-deck-count-num', pile: 'deck', owner: localPlayerRole },
    { id: 'opp-deck-count', pile: 'deck', owner: (localPlayerRole === 'P1' ? 'P2' : 'P1') }
  ];

  pileBindings.forEach(({ id, pile, owner }) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openPileViewer(pile, owner);
      });
    }
  });
}

function setupLPButtons() {
  document.getElementById('opp-lp-minus-500')?.addEventListener('click', () => {
    const oppState = (localPlayerRole === 'P1') ? p2State : p1State;
    oppState.lp = Math.max(0, oppState.lp - 500);
    logAction(`💥 خصم 500 LP من ${oppState.name}!`);
    renderArena();
    pushGameStateToFirebase();
    checkWinConditions();
  });

  document.getElementById('opp-lp-minus-1000')?.addEventListener('click', () => {
    const oppState = (localPlayerRole === 'P1') ? p2State : p1State;
    oppState.lp = Math.max(0, oppState.lp - 1000);
    logAction(`💥 خصم 1000 LP من ${oppState.name}!`);
    renderArena();
    pushGameStateToFirebase();
    checkWinConditions();
  });

  document.getElementById('you-lp-minus-500')?.addEventListener('click', () => {
    const myState = (localPlayerRole === 'P1') ? p1State : p2State;
    myState.lp = Math.max(0, myState.lp - 500);
    logAction(`💔 خصم 500 LP من ${myState.name}!`);
    renderArena();
    pushGameStateToFirebase();
    checkWinConditions();
  });

  document.getElementById('you-lp-minus-1000')?.addEventListener('click', () => {
    const myState = (localPlayerRole === 'P1') ? p1State : p2State;
    myState.lp = Math.max(0, myState.lp - 1000);
    logAction(`💔 خصم 1000 LP من ${myState.name}!`);
    renderArena();
    pushGameStateToFirebase();
    checkWinConditions();
  });

  document.getElementById('you-lp-plus-500')?.addEventListener('click', () => {
    const myState = (localPlayerRole === 'P1') ? p1State : p2State;
    myState.lp += 500;
    logAction(`💚 زيادة 500 LP لـ ${myState.name}!`);
    renderArena();
    pushGameStateToFirebase();
  });
}

function renderArena() {
  const isP1Local = (localPlayerRole === 'P1');
  const youState = isP1Local ? p1State : p2State;
  const oppState = isP1Local ? p2State : p1State;

  // Render Opponent Status Bar (Top)
  document.getElementById('opp-name').textContent = oppState.name;
  document.getElementById('opp-avatar').src = oppState.avatar;
  document.getElementById('opp-lp-value').textContent = oppState.lp;
  document.getElementById('opp-deck-count').textContent = oppState.deck ? oppState.deck.length : 0;
  document.getElementById('opp-grave-count').textContent = oppState.graveyard ? oppState.graveyard.length : 0;
  document.getElementById('opp-hand-count').textContent = oppState.hand ? oppState.hand.length : 0;

  // Render You Status Bar (Bottom)
  document.getElementById('you-name').textContent = youState.name;
  document.getElementById('you-avatar').src = youState.avatar;
  document.getElementById('you-lp-value').textContent = youState.lp;
  document.getElementById('you-deck-count').textContent = youState.deck ? youState.deck.length : 0;
  document.getElementById('you-deck-count-num').textContent = youState.deck ? youState.deck.length : 0;
  document.getElementById('you-grave-count').textContent = youState.graveyard ? youState.graveyard.length : 0;
  document.getElementById('you-grave-count-num').textContent = youState.graveyard ? youState.graveyard.length : 0;
  document.getElementById('you-hand-count').textContent = youState.hand ? youState.hand.length : 0;

  // Turn status banner
  const turnBanner = document.getElementById('turn-banner');
  const turnText = document.getElementById('turn-text');
  if (turnBanner && turnText) {
    if (activeTurn === localPlayerRole) {
      turnBanner.className = 'turn-status-banner your-turn';
      turnText.textContent = `دورك الآن (Your Turn) - [${youState.name}]`;
    } else {
      turnBanner.className = 'turn-status-banner opp-turn';
      turnText.textContent = `دور الخصم (Opponent Turn) - [${oppState.name}]`;
    }
  }

  // Render Hands (Opponent hand face down, Your hand face up)
  const oppRole = isP1Local ? 'P2' : 'P1';
  const youRole = isP1Local ? 'P1' : 'P2';

  renderHandContainer('opp-hand-container', oppState.hand || [], oppRole, true);
  renderHandContainer('you-hand-container', youState.hand || [], youRole, false);

  // Render Monster & Spell Zones
  renderFieldSlots('opp-monster-zone', oppState.monsters || [], oppRole, 'monster');
  renderFieldSlots('opp-spell-zone', oppState.spells || [], oppRole, 'spell');

  renderFieldSlots('you-monster-zone', youState.monsters || [], youRole, 'monster');
  renderFieldSlots('you-spell-zone', youState.spells || [], youRole, 'spell');
}

function renderHandContainer(containerId, handArray, owner, isFaceDown) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!handArray || handArray.length === 0) {
    container.innerHTML = '<div style="color:var(--gold-muted); font-size:0.85rem; padding:10px;">لا توجد أوراق في اليد</div>';
    return;
  }

  handArray.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'arena-card hand-card';

    if (isFaceDown) {
      cardEl.classList.add('face-down');
      cardEl.innerHTML = `<img src="${CARD_BACK_URL}" alt="كارت مقلوب">`;
    } else {
      const details = getCardDetailsAr(card);
      const imgUrl = card.imageUrl || card.image || CARD_BACK_URL;
      cardEl.innerHTML = `
        <img src="${imgUrl}" alt="${details.nameAr}">
        <div class="card-name-tooltip">${details.nameAr}</div>
      `;
    }

    cardEl.addEventListener('click', (e) => {
      e.stopPropagation();
      openCardContextMenu(e, card, idx, owner, isFaceDown);
    });

    container.appendChild(cardEl);
  });
}

function renderFieldSlots(containerId, slotsArray, owner, zoneType) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const slotBoxes = container.querySelectorAll('.field-slot-box');
  slotBoxes.forEach((slot, idx) => {
    slot.innerHTML = '';
    const cardInSlot = slotsArray[idx];

    if (!cardInSlot) {
      slot.className = `field-slot-box ${zoneType}-slot`;
      slot.innerHTML = `<span class="slot-number">${idx + 1}</span>`;
    } else {
      const cardEl = document.createElement('div');
      const isCardSetFaceDown = cardInSlot.isSetFaceDown;
      const isDefPos = cardInSlot.isDefPos;

      cardEl.className = `arena-card ${isCardSetFaceDown ? 'face-down' : ''} ${isDefPos ? 'defense-position' : ''}`;

      if (!isCardSetFaceDown) {
        const imgUrl = cardInSlot.imageUrl || cardInSlot.image || CARD_BACK_URL;
        cardEl.innerHTML = `
          <img src="${imgUrl}" alt="${cardInSlot.nameAr || cardInSlot.name}">
          ${zoneType === 'monster' ? `<div class="card-atk-def-badge">⚔️ ${cardInSlot.atk || 0}</div>` : ''}
        `;
      } else {
        cardEl.innerHTML = `<img src="${CARD_BACK_URL}" alt="كارت مقلوب">`;
      }

      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openFieldCardMenu(e, cardInSlot, idx, owner, zoneType);
      });

      slot.appendChild(cardEl);
      slot.className = `field-slot-box ${zoneType}-slot has-card`;
    }
  });
}

function isMonster(card) {
  if (!card) return false;
  const t = (card.type || '').toLowerCase();
  return t.includes('monster') || t.includes('وحش') || card.atk !== undefined;
}

function isSpellOrTrap(card) {
  if (!card) return false;
  const t = (card.type || '').toLowerCase();
  return t.includes('spell') || t.includes('trap') || t.includes('سحر') || t.includes('فخ');
}

function openCardContextMenu(e, card, idx, owner, isFaceDown) {
  const ctx = document.getElementById('online-context-menu');
  if (!ctx) return;

  if (isFaceDown && owner !== localPlayerRole) {
    return;
  }

  selectedCardContext = { card, idx, owner, source: 'hand' };

  const isMyTurn = (owner === activeTurn && owner === localPlayerRole);
  const cardIsMonster = isMonster(card);
  const cardIsSpell = isSpellOrTrap(card);

  toggleCtxButton('ctx-view-details', true);
  toggleCtxButton('ctx-summon-atk', cardIsMonster && isMyTurn && !turnState.hasSummonedThisTurn);
  toggleCtxButton('ctx-summon-def', cardIsMonster && isMyTurn && !turnState.hasSummonedThisTurn);
  toggleCtxButton('ctx-activate-spell', cardIsSpell && isMyTurn);
  toggleCtxButton('ctx-set-spell', cardIsSpell && isMyTurn);
  toggleCtxButton('ctx-change-position', false);
  toggleCtxButton('ctx-flip-card', false);
  toggleCtxButton('ctx-attack-monster', false);
  toggleCtxButton('ctx-attack-direct', false);
  toggleCtxButton('ctx-send-grave', isMyTurn);

  positionContextMenu(ctx, e);
}

function openFieldCardMenu(e, card, idx, owner, zoneType) {
  const ctx = document.getElementById('online-context-menu');
  if (!ctx) return;

  selectedCardContext = { card, idx, owner, zoneType, source: 'field' };

  const isMyTurn = (owner === activeTurn && owner === localPlayerRole);
  const opponent = (owner === 'P1') ? p2State : p1State;
  const oppHasMonsters = opponent.monsters && opponent.monsters.some(m => m !== null);

  const canViewDetails = !card.isSetFaceDown || (owner === localPlayerRole);
  toggleCtxButton('ctx-view-details', canViewDetails);

  toggleCtxButton('ctx-summon-atk', false);
  toggleCtxButton('ctx-summon-def', false);
  toggleCtxButton('ctx-activate-spell', false);
  toggleCtxButton('ctx-set-spell', false);

  toggleCtxButton('ctx-change-position', zoneType === 'monster' && isMyTurn);
  toggleCtxButton('ctx-flip-card', card.isSetFaceDown && isMyTurn);

  const canAttack = zoneType === 'monster' && !card.isSetFaceDown && !card.isDefPos && isMyTurn && !card.hasAttackedThisTurn;
  toggleCtxButton('ctx-attack-monster', canAttack && oppHasMonsters);
  toggleCtxButton('ctx-attack-direct', canAttack && !oppHasMonsters);

  toggleCtxButton('ctx-send-grave', isMyTurn);

  positionContextMenu(ctx, e);
}

function toggleCtxButton(id, show) {
  const btn = document.getElementById(id);
  if (btn) btn.style.display = show ? 'flex' : 'none';
}

function positionContextMenu(ctx, e) {
  ctx.style.display = 'flex';
  ctx.style.flexDirection = 'column';
  ctx.style.gap = '4px';
  ctx.style.left = `${Math.min(e.clientX, window.innerWidth - 190)}px`;
  ctx.style.top = `${Math.min(e.clientY, window.innerHeight - 250)}px`;
}

function setupContextMenuActions() {
  document.getElementById('ctx-view-details')?.addEventListener('click', () => {
    if (selectedCardContext?.card) {
      showCardDetailsModal(selectedCardContext.card);
    }
    document.getElementById('online-context-menu').style.display = 'none';
  });

  document.getElementById('ctx-summon-atk')?.addEventListener('click', () => {
    attemptSummonMonster(false);
  });

  document.getElementById('ctx-summon-def')?.addEventListener('click', () => {
    attemptSummonMonster(true);
  });

  document.getElementById('ctx-activate-spell')?.addEventListener('click', () => {
    if (!selectedCardContext) return;
    const { card, idx, owner } = selectedCardContext;
    const player = (owner === 'P1') ? p1State : p2State;

    const freeIndex = player.spells.findIndex(s => s === null);
    if (freeIndex === -1) {
      alert('منطقة السحر والفخ ممتلئة!');
      return;
    }

    player.hand.splice(idx, 1);
    player.spells[freeIndex] = { ...card, isSetFaceDown: false };
    logAction(`⚡ فعّل ${player.name} ورقة [${card.nameAr || card.name}]!`);
    document.getElementById('online-context-menu').style.display = 'none';
    renderArena();
    pushGameStateToFirebase();
  });

  document.getElementById('ctx-set-spell')?.addEventListener('click', () => {
    if (!selectedCardContext) return;
    const { card, idx, owner } = selectedCardContext;
    const player = (owner === 'P1') ? p1State : p2State;

    const freeIndex = player.spells.findIndex(s => s === null);
    if (freeIndex === -1) {
      alert('منطقة السحر والفخ ممتلئة!');
      return;
    }

    player.hand.splice(idx, 1);
    player.spells[freeIndex] = { ...card, isSetFaceDown: true };
    logAction(`🔒 وضع ${player.name} ورقة سحر/فخ مقلوبة.`);
    document.getElementById('online-context-menu').style.display = 'none';
    renderArena();
    pushGameStateToFirebase();
  });

  document.getElementById('ctx-change-position')?.addEventListener('click', () => {
    if (!selectedCardContext) return;
    const { idx, owner, zoneType } = selectedCardContext;
    const player = (owner === 'P1') ? p1State : p2State;

    if (zoneType === 'monster' && player.monsters[idx]) {
      const monster = player.monsters[idx];
      monster.isDefPos = !monster.isDefPos;
      logAction(`🔄 غير ${player.name} وضعية [${monster.nameAr || monster.name}] إلى وضع ${monster.isDefPos ? 'الدفاع 🛡️' : 'الهجوم ⚔️'}.`);
    }

    document.getElementById('online-context-menu').style.display = 'none';
    renderArena();
    pushGameStateToFirebase();
  });

  document.getElementById('ctx-flip-card')?.addEventListener('click', () => {
    if (!selectedCardContext) return;
    const { card, idx, owner, zoneType } = selectedCardContext;
    const player = (owner === 'P1') ? p1State : p2State;

    if (zoneType === 'monster' && player.monsters[idx]) {
      player.monsters[idx].isSetFaceDown = false;
      logAction(`👁️ كشف ${player.name} الكارت المقلوب: [${card.nameAr || card.name}]!`);
    } else if (zoneType === 'spell' && player.spells[idx]) {
      player.spells[idx].isSetFaceDown = false;
      logAction(`⚡ كشف وفعّل ${player.name} الورقة: [${card.nameAr || card.name}]!`);
    }

    document.getElementById('online-context-menu').style.display = 'none';
    renderArena();
    pushGameStateToFirebase();
  });

  document.getElementById('ctx-attack-monster')?.addEventListener('click', () => {
    if (!selectedCardContext) return;
    const { card, idx, owner } = selectedCardContext;
    document.getElementById('online-context-menu').style.display = 'none';

    openAttackTargetModal(card, owner, idx);
  });

  document.getElementById('ctx-attack-direct')?.addEventListener('click', () => {
    if (!selectedCardContext) return;
    const { card, idx, owner } = selectedCardContext;
    document.getElementById('online-context-menu').style.display = 'none';

    executeDirectAttack(card, owner, idx);
  });

  document.getElementById('ctx-send-grave')?.addEventListener('click', () => {
    if (!selectedCardContext) return;
    const { card, idx, owner, source, zoneType } = selectedCardContext;
    const player = (owner === 'P1') ? p1State : p2State;

    if (source === 'hand') {
      player.hand.splice(idx, 1);
    } else if (source === 'field') {
      if (zoneType === 'monster') player.monsters[idx] = null;
      if (zoneType === 'spell') player.spells[idx] = null;
    }

    player.graveyard.unshift(card);
    logAction(`💀 أرسل ${player.name} الورقة [${card.nameAr || card.name}] إلى المقبرة.`);
    document.getElementById('online-context-menu').style.display = 'none';
    renderArena();
    pushGameStateToFirebase();
  });
}

function getRequiredTributes(card) {
  const level = card?.level || card?.rank || 1;
  if (level <= 5) return 0;
  if (level === 6) return 1;
  return 2;
}

function attemptSummonMonster(isDefPos) {
  if (!selectedCardContext) return;
  const { card, idx, owner } = selectedCardContext;
  const player = (owner === 'P1') ? p1State : p2State;

  if (turnState.hasSummonedThisTurn) {
    alert('لقد قمت باستدعاء وحش في هذا الدور بالفعل! (مسموح بـ 1 استدعاء عادي لكل دور).');
    return;
  }

  const requiredTributes = getRequiredTributes(card);
  const activeMonsters = player.monsters
    .map((m, i) => ({ card: m, index: i }))
    .filter(item => item.card !== null);

  const freeIndex = player.monsters.findIndex(m => m === null);

  if (requiredTributes === 0 && freeIndex === -1) {
    alert('منطقة الوحوش ممتلئة بالكامل!');
    return;
  }

  if (activeMonsters.length < requiredTributes) {
    const cardName = card.nameAr || card.name;
    const level = card.level || 1;
    alert(`⚠️ لا يمكن استدعاء [${cardName}] (مستوى ⭐${level})!\nيتطلب هذا الوحش التضحية بـ ${requiredTributes} وحش/وحوش من الساحة، ولكن لديك حالياً ${activeMonsters.length} وحش فقط.`);
    return;
  }

  document.getElementById('online-context-menu').style.display = 'none';

  if (requiredTributes === 0) {
    executeSummon(card, idx, owner, freeIndex, isDefPos, []);
  } else {
    openTributeModal(card, idx, owner, isDefPos, requiredTributes, activeMonsters);
  }
}

function openTributeModal(card, handIdx, owner, isDefPos, requiredCount, activeMonsters) {
  pendingTributeData = { card, handIdx, owner, isDefPos, requiredCount, selectedIndices: [] };
  const modal = document.getElementById('tribute-select-modal');
  const title = document.getElementById('tribute-modal-title');
  const desc = document.getElementById('tribute-modal-desc');
  const list = document.getElementById('tribute-monsters-list');
  if (!modal || !list) return;

  const cardName = card.nameAr || card.name;
  title.innerHTML = `<i class="ph ph-fire"></i> التضحية لاستدعاء [${cardName}] (⭐${card.level || 1})`;
  desc.textContent = `اختر بالضبط ${requiredCount} وحش/وحوش من ساحتك للتضحية بها وإرسالها للمقبرة:`;

  list.innerHTML = '';
  activeMonsters.forEach(({ card: m, index }) => {
    const details = getCardDetailsAr(m);
    const mName = m.isSetFaceDown ? 'وحش مقلوب 🔒' : details.nameAr;
    const mImg = m.imageUrl || m.image || CARD_BACK_URL;

    const item = document.createElement('div');
    item.style.cssText = `
      cursor: pointer; padding: 8px; border: 2px solid rgba(255,215,0,0.2); border-radius: 8px;
      background: rgba(0,0,0,0.6); text-align: center; width: 110px; transition: all 0.2s;
    `;
    item.innerHTML = `
      <img src="${mImg}" style="width: 80px; height: 105px; object-fit: cover; border-radius: 4px; margin-bottom: 5px;">
      <div style="font-size: 0.75rem; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${mName}</div>
      <div style="font-size: 0.72rem; color: var(--gold-bright); margin-top: 2px;">ATK: ${m.atk || 0}</div>
    `;

    item.addEventListener('click', () => {
      const pos = pendingTributeData.selectedIndices.indexOf(index);
      if (pos > -1) {
        pendingTributeData.selectedIndices.splice(pos, 1);
        item.style.borderColor = 'rgba(255,215,0,0.2)';
        item.style.background = 'rgba(0,0,0,0.6)';
      } else {
        if (pendingTributeData.selectedIndices.length >= requiredCount) {
          alert(`لقد اخترت بالفعل ${requiredCount} وحش/وحوش للتضحية بها.`);
          return;
        }
        pendingTributeData.selectedIndices.push(index);
        item.style.borderColor = '#ef4444';
        item.style.background = 'rgba(239,68,68,0.3)';
      }
    });

    list.appendChild(item);
  });

  modal.style.display = 'flex';
}

function handleConfirmTribute() {
  if (!pendingTributeData) return;
  const { card, handIdx, owner, isDefPos, requiredCount, selectedIndices } = pendingTributeData;
  if (selectedIndices.length !== requiredCount) {
    alert(`يرجى تحديد بالضبط ${requiredCount} وحش/وحوش للتضحية بها.`);
    return;
  }

  const player = (owner === 'P1') ? p1State : p2State;

  selectedIndices.forEach(idx => {
    const sacrificed = player.monsters[idx];
    if (sacrificed) {
      player.graveyard.unshift(sacrificed);
      const mName = sacrificed.isSetFaceDown ? 'وحش مقلوب' : (sacrificed.nameAr || sacrificed.name);
      logAction(`🔥 تم التضحية بـ [${mName}] وإرساله إلى المقبرة!`);
      player.monsters[idx] = null;
    }
  });

  const freeIndex = player.monsters.findIndex(m => m === null);
  executeSummon(card, handIdx, owner, freeIndex, isDefPos, selectedIndices);

  document.getElementById('tribute-select-modal').style.display = 'none';
  pendingTributeData = null;
}

function executeSummon(card, handIdx, owner, targetIndex, isDefPos, tributes) {
  const player = (owner === 'P1') ? p1State : p2State;

  player.hand.splice(handIdx, 1);
  player.monsters[targetIndex] = {
    ...card,
    isSetFaceDown: isDefPos,
    isDefPos: isDefPos,
    hasAttackedThisTurn: false
  };
  turnState.hasSummonedThisTurn = true;

  const cardName = card.nameAr || card.name;
  const tributeText = tributes && tributes.length > 0 ? ` (تضحية: ${tributes.length} وحش)` : '';
  if (isDefPos) {
    logAction(`🔒 وضع ${player.name} كارت [${cardName}] مقلوب في وضع الدفاع${tributeText}.`);
  } else {
    logAction(`⚔️ استدعى ${player.name} الوحش [${cardName}] (ATK: ${card.atk || 0}) في وضع الهجوم${tributeText}!`);
  }

  renderArena();
  pushGameStateToFirebase();
}

function openPileViewer(pileType, owner) {
  const player = (owner === 'P1') ? p1State : p2State;
  const cards = (pileType === 'deck') ? player.deck : player.graveyard;

  const modal = document.getElementById('pile-viewer-modal');
  const title = document.getElementById('pile-viewer-title');
  const body = document.getElementById('pile-viewer-body');
  if (!modal || !body) return;

  const pileNameAr = (pileType === 'deck') ? 'المجموعة (Deck)' : 'المقبرة (Graveyard)';
  title.innerHTML = `<i class="ph ph-cards"></i> ${pileNameAr} - ${player.name} (${cards ? cards.length : 0} كارت)`;

  body.innerHTML = '';
  if (!cards || cards.length === 0) {
    body.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-cream); padding: 30px; font-size: 0.95rem;">لا توجد أي بطاقات في ${pileNameAr}.</div>`;
  } else {
    cards.forEach((card) => {
      const details = getCardDetailsAr(card);
      const imgUrl = card.imageUrl || card.image || CARD_BACK_URL;

      const cardCard = document.createElement('div');
      cardCard.style.cssText = `
        cursor: pointer; background: rgba(0,0,0,0.6); border: 1px solid var(--gold-primary);
        border-radius: 6px; padding: 6px; text-align: center; transition: transform 0.2s;
      `;
      cardCard.innerHTML = `
        <img src="${imgUrl}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 4px;">
        <div style="font-size: 0.75rem; color: var(--gold-bright); font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px;">${details.nameAr}</div>
        <div style="font-size: 0.68rem; color: #93c5fd;">${details.typeAr}</div>
      `;

      cardCard.addEventListener('mouseenter', () => cardCard.style.transform = 'scale(1.05)');
      cardCard.addEventListener('mouseleave', () => cardCard.style.transform = 'scale(1)');
      cardCard.addEventListener('click', () => {
        showCardDetailsModal(card);
      });

      body.appendChild(cardCard);
    });
  }

  modal.style.display = 'flex';
}

function showCardDetailsModal(card) {
  const modal = document.getElementById('card-details-modal');
  const body = document.getElementById('card-details-body');
  if (!modal || !body || !card) return;

  const details = getCardDetailsAr(card);
  const imgUrl = card.imageUrl || card.image || CARD_BACK_URL;

  body.innerHTML = `
    <div style="flex: 0 0 160px; text-align: center;">
      <img src="${imgUrl}" alt="${details.nameAr}" style="width: 100%; border-radius: 8px; border: 1.5px solid var(--gold-primary); box-shadow: 0 4px 15px rgba(0,0,0,0.8);">
    </div>
    <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 8px;">
      <h3 style="color: var(--gold-bright); margin: 0; font-size: 1.25rem; font-family: var(--font-heading);">${details.nameAr}</h3>
      ${details.nameEn ? `<p style="margin:0; font-size: 0.85rem; color: #93c5fd;"><strong>الاسم بالإنجليزي:</strong> ${details.nameEn}</p>` : ''}
      <p style="margin:0; font-size: 0.85rem;"><strong>نوع الكارت:</strong> ${details.typeAr}</p>
      ${details.attributeAr ? `<p style="margin:0; font-size: 0.85rem;"><strong>السمة:</strong> ${details.attributeAr}</p>` : ''}
      ${details.raceAr ? `<p style="margin:0; font-size: 0.85rem;"><strong>الفئة / الفصيلة:</strong> ${details.raceAr}</p>` : ''}
      ${details.level ? `<p style="margin:0; font-size: 0.85rem;"><strong>المستوى / الرتبة:</strong> ⭐ ${details.level}</p>` : ''}
      ${details.atk !== undefined && details.def !== undefined ? `<p style="margin:0; font-size: 1rem; color: var(--gold-bright);"><strong>⚔️ الهجوم (ATK):</strong> ${details.atk} &nbsp;|&nbsp; <strong>🛡️ الدفاع (DEF):</strong> ${details.def}</p>` : ''}
      <div style="margin-top: 10px; padding: 12px; background: rgba(0,0,0,0.5); border-radius: 8px; border: 1px solid rgba(255,215,0,0.2); font-size: 0.88rem; line-height: 1.6; color: var(--text-cream);">
        <strong style="color: var(--gold-bright); display: block; margin-bottom: 4px;">تأثير / وصف البطاقة:</strong>
        ${details.descAr}
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function openAttackTargetModal(attackerCard, attackerOwner, attackerIndex) {
  const modal = document.getElementById('attack-target-modal');
  const targetList = document.getElementById('target-monsters-list');
  if (!modal || !targetList) return;

  const opponent = (attackerOwner === 'P1') ? p2State : p1State;

  const oppMonsters = [];
  if (opponent.monsters) {
    opponent.monsters.forEach((m, idx) => {
      if (m !== null) oppMonsters.push({ monster: m, index: idx });
    });
  }

  if (oppMonsters.length === 0) {
    executeDirectAttack(attackerCard, attackerOwner, attackerIndex);
    return;
  }

  targetList.innerHTML = '';
  oppMonsters.forEach(item => {
    const { monster, index } = item;
    const itemEl = document.createElement('div');
    itemEl.className = 'target-select-card-item';

    const displayName = monster.isSetFaceDown ? 'كارت وحش مقلوب 🔒' : (monster.nameAr || monster.name);
    const statsText = monster.isSetFaceDown 
      ? 'وضع دفاع (مقلوب)' 
      : (monster.isDefPos ? `🛡️ DEF: ${monster.def || 0}` : `⚔️ ATK: ${monster.atk || 0}`);

    itemEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-weight:bold; color:var(--gold-bright);">خانة #${index + 1}</span>
        <div>
          <div style="font-weight:bold; font-size:0.95rem;">${displayName}</div>
          <div style="font-size:0.8rem; opacity:0.8; color:var(--gold-muted);">${statsText}</div>
        </div>
      </div>
      <button style="background:var(--gold-primary); color:#000; border:none; padding:6px 14px; border-radius:6px; font-weight:bold; cursor:pointer;">
        🎯 اختيار للقتال
      </button>
    `;

    itemEl.addEventListener('click', () => {
      modal.style.display = 'none';
      executeMonsterBattle(attackerCard, attackerOwner, attackerIndex, monster, opponent.id, index);
    });

    targetList.appendChild(itemEl);
  });

  modal.style.display = 'flex';
}

function executeMonsterBattle(attacker, attackerOwner, attackerIdx, defender, defenderOwner, defenderIdx) {
  const attackerPlayer = (attackerOwner === 'P1') ? p1State : p2State;
  const defenderPlayer = (defenderOwner === 'P1') ? p2State : p1State;

  const attackerAtk = attacker.atk || 0;
  const defenderName = defender.isSetFaceDown ? 'كارت الوحش المقلوب' : (defender.nameAr || defender.name);
  const attackerName = attacker.nameAr || attacker.name;

  let resultMsg = '';

  if (!defender.isDefPos) {
    const defenderAtk = defender.atk || 0;
    if (attackerAtk > defenderAtk) {
      const damage = attackerAtk - defenderAtk;
      defenderPlayer.lp = Math.max(0, defenderPlayer.lp - damage);
      defenderPlayer.graveyard.unshift(defender);
      defenderPlayer.monsters[defenderIdx] = null;
      resultMsg = `⚔️ [${attackerName}] (ATK: ${attackerAtk}) دمر [${defenderName}] (ATK: ${defenderAtk})! تم خصم ${damage} LP من نقاط حياة ${defenderPlayer.name}!`;
    } else if (attackerAtk < defenderAtk) {
      const damage = defenderAtk - attackerAtk;
      attackerPlayer.lp = Math.max(0, attackerPlayer.lp - damage);
      attackerPlayer.graveyard.unshift(attacker);
      attackerPlayer.monsters[attackerIdx] = null;
      resultMsg = `💥 [${attackerName}] (ATK: ${attackerAtk}) خسر أمام [${defenderName}] (ATK: ${defenderAtk}) وتدمر! تم خصم ${damage} LP من نقاط حياة ${attackerPlayer.name}!`;
    } else {
      defenderPlayer.graveyard.unshift(defender);
      defenderPlayer.monsters[defenderIdx] = null;
      attackerPlayer.graveyard.unshift(attacker);
      attackerPlayer.monsters[attackerIdx] = null;
      resultMsg = `⚔️ دمار متبادل! تم تدمير [${attackerName}] و [${defenderName}] بسبب تساوي القوة الهجومية (${attackerAtk})!`;
    }
  } else {
    const defenderDef = defender.def || 0;
    defender.isSetFaceDown = false;

    if (attackerAtk > defenderDef) {
      defenderPlayer.graveyard.unshift(defender);
      defenderPlayer.monsters[defenderIdx] = null;
      resultMsg = `⚔️ [${attackerName}] (ATK: ${attackerAtk}) دمر [${defenderName}] في وضع الدفاع (DEF: ${defenderDef})! (0 LP ضرر)`;
    } else if (attackerAtk < defenderDef) {
      const damage = defenderDef - attackerAtk;
      attackerPlayer.lp = Math.max(0, attackerPlayer.lp - damage);
      resultMsg = `🛡️ دفاع [${defenderName}] (DEF: ${defenderDef}) كان أقوى من هجوم [${attackerName}] (ATK: ${attackerAtk})! خسرت ${damage} LP!`;
    } else {
      resultMsg = `🛡️ [${defenderName}] (DEF: ${defenderDef}) صمد أمام هجوم [${attackerName}] دون أي خسائر!`;
    }
  }

  if (attackerPlayer.monsters[attackerIdx]) {
    attackerPlayer.monsters[attackerIdx].hasAttackedThisTurn = true;
  }

  logAction(resultMsg);
  renderArena();
  pushGameStateToFirebase();
  checkWinConditions();
}

function executeDirectAttack(attacker, attackerOwner, attackerIdx) {
  const attackerPlayer = (attackerOwner === 'P1') ? p1State : p2State;
  const defenderPlayer = (attackerOwner === 'P1') ? p2State : p1State;

  const damage = attacker.atk || 0;
  defenderPlayer.lp = Math.max(0, defenderPlayer.lp - damage);

  if (attackerPlayer.monsters[attackerIdx]) {
    attackerPlayer.monsters[attackerIdx].hasAttackedThisTurn = true;
  }

  logAction(`💥 هجوم مباشر من [${attacker.nameAr || attacker.name}]! تم خصم ${damage} LP من نقاط حياة ${defenderPlayer.name}!`);
  renderArena();
  pushGameStateToFirebase();
  checkWinConditions();
}

function checkWinConditions() {
  if (p1State.lp <= 0) {
    alert(`🎉 انتهت المبارزة! الفائز هو ${p2State.name}!`);
    logAction(`🏆 انتهت المبارزة بفوز ${p2State.name}!`);
  } else if (p2State.lp <= 0) {
    alert(`🎉 انتهت المبارزة! الفائز هو ${p1State.name}!`);
    logAction(`🏆 انتهت المبارزة بفوز ${p1State.name}!`);
  }
}

function logAction(msg) {
  const logBox = document.getElementById('action-log-box');
  if (!logBox) return;

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="time">[${timeStr}]</span> <span>${msg}</span>`;

  logBox.prepend(entry);
}
