const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
const SERVER_URL = isLocal ? `http://${hostname}:3000` : 'https://TUO-RENDER-URL.onrender.com';

const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

// --- Global State ---
let myId = null;
let myUsername = localStorage.getItem('piensalo_username') || '';
let currentRoom = '';
let gameState = null;
let isPeeking = false; 

// --- DOM Elements ---
const screenOnboard = document.getElementById('screen-onboarding');
const screenNameInput = document.getElementById('screen-name-input');
const screenMenu = document.getElementById('screen-menu');
const screenLobby = document.getElementById('screen-lobby');
const screenGame = document.getElementById('screen-game');
const modalMenu = document.getElementById('modal-menu');
const modalJack = document.getElementById('modal-jack-decision');
const modalQ = document.getElementById('modal-q-decision');
const modalJolly = document.getElementById('modal-jolly-decision');
const seatBottom = document.getElementById('seat-bottom');

// --- Initialization & Setup ---
function enableFullScreen() {
  const doc = document.documentElement;
  if (doc.requestFullscreen) doc.requestFullscreen().catch(()=>{});
  else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen().catch(()=>{});
}
window.addEventListener('click', enableFullScreen, { once: true });
window.addEventListener('touchend', enableFullScreen, { once: true });

// --- Navigation & UI Events ---
document.getElementById('btn-inizia').addEventListener('click', () => {
  screenOnboard.classList.remove('active');
  if (myUsername) {
    screenMenu.classList.add('active'); 
  } else {
    screenNameInput.classList.add('active'); 
  }
});

document.getElementById('btn-save-user').addEventListener('click', () => {
  const input = document.getElementById('input-username').value.trim();
  if (input) {
    myUsername = input;
    localStorage.setItem('piensalo_username', myUsername);
    screenNameInput.classList.remove('active');
    screenMenu.classList.add('active');
  } else {
    showToast("Inserisci un nome!");
  }
});

document.getElementById('btn-new-game').addEventListener('click', () => {
  if (!socket.connected) {
    showToast("Avvio server in corso, attendi qualche secondo...");
  }
  currentRoom = Math.random().toString(36).substring(2, 7).toUpperCase();
  socket.emit('join_room', { roomId: currentRoom, username: myUsername });
});

document.getElementById('btn-participate').addEventListener('click', () => {
  document.getElementById('join-box').classList.remove('hidden');
});

document.getElementById('btn-cancel-join').addEventListener('click', () => {
  document.getElementById('join-box').classList.add('hidden');
  document.getElementById('input-roomcode').value = '';
});

document.getElementById('btn-confirm-join').addEventListener('click', () => {
  currentRoom = document.getElementById('input-roomcode').value.toUpperCase().trim();
  if (currentRoom) {
    if (!socket.connected) {
      showToast("Avvio server in corso, attendi qualche secondo...");
    }
    socket.emit('join_room', { roomId: currentRoom, username: myUsername });
  }
});

document.getElementById('btn-start').addEventListener('click', () => socket.emit('start_game'));

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
  socket.emit('leave_room');
  screenLobby.classList.remove('active');
  screenMenu.classList.add('active');
});

// --- In-Game Menu ---
document.getElementById('btn-menu-ingame').addEventListener('click', () => modalMenu.classList.remove('hidden'));
document.getElementById('btn-resume').addEventListener('click', () => modalMenu.classList.add('hidden'));
document.getElementById('btn-leave-game').addEventListener('click', () => {
  modalMenu.classList.add('hidden');
  socket.emit('leave_room');
  screenGame.classList.remove('active');
  screenMenu.classList.add('active');
});

document.getElementById('btn-return-lobby-center').addEventListener('click', () => {
  screenGame.classList.remove('active');
  screenLobby.classList.add('active');
  document.getElementById('deck').classList.remove('hidden');
  document.getElementById('discard').classList.remove('hidden');
  document.getElementById('game-over-center').classList.add('hidden');
});

// --- Decision Modals (Card Effects) ---
socket.on('prompt_jack_decision', () => modalJack.classList.remove('hidden'));
document.getElementById('btn-jack-swap').addEventListener('click', () => { modalJack.classList.add('hidden'); socket.emit('execute_jack_decision', { swap: true }); });
document.getElementById('btn-jack-keep').addEventListener('click', () => { modalJack.classList.add('hidden'); socket.emit('execute_jack_decision', { swap: false }); });

socket.on('prompt_q_decision', () => modalQ.classList.remove('hidden'));
document.getElementById('btn-q-use').addEventListener('click', () => { modalQ.classList.add('hidden'); socket.emit('execute_q_decision', { use: true }); });
document.getElementById('btn-q-skip').addEventListener('click', () => { modalQ.classList.add('hidden'); socket.emit('execute_q_decision', { use: false }); });

socket.on('prompt_jolly_decision', () => modalJolly.classList.remove('hidden'));
document.getElementById('btn-jolly-use').addEventListener('click', () => { modalJolly.classList.add('hidden'); socket.emit('execute_jolly_decision', { use: true }); });
document.getElementById('btn-jolly-skip').addEventListener('click', () => { modalJolly.classList.add('hidden'); socket.emit('execute_jolly_decision', { use: false }); });

// --- Socket Communication & Game State ---

socket.on('connect', () => { 
  myId = socket.id; 
});

let connectErrorWarned = false;
socket.on('connect_error', () => {
  if (!connectErrorWarned) {
    connectErrorWarned = true;
    showToast("Connessione al server in corso... (avvio)");
    setTimeout(() => { connectErrorWarned = false; }, 15000);
  }
});

socket.on('room_update', (room) => {
  gameState = room;
  screenMenu.classList.remove('active');
  screenNameInput.classList.remove('active');
  document.getElementById('join-box').classList.add('hidden');
  
  // Handle Lobby State
  if (room.state === 'LOBBY') {
    screenGame.classList.remove('active');
    screenLobby.classList.add('active');
    
    document.getElementById('display-roomcode').textContent = room.id;
    
    const slotColors = ['#f5e56b', '#2ba8b5', '#f7d0d6', '#e0cbf8'];
    const lobbyPlayersDiv = document.getElementById('lobby-players');
    lobbyPlayersDiv.innerHTML = '';
    
    for (let i = 0; i < 4; i++) {
      const p = room.players[i];
      if (p) {
        const isMe = p.id === myId;
        const displayName = isMe ? `${p.username} (tu)` : p.username;
        lobbyPlayersDiv.innerHTML += `
          <div class="lobby-slot">
            <span class="lobby-player-name">${displayName}</span>
            <div class="lobby-circle" style="background-color: ${slotColors[i]}; border-color: ${isMe ? '#ffffff' : '#222222'};"></div>
          </div>`;
      } else {
        lobbyPlayersDiv.innerHTML += `
          <div class="lobby-slot">
            <span class="lobby-player-name">&nbsp;</span>
            <div class="lobby-circle empty"></div>
          </div>`;
      }
    }

    if (room.players[0] && room.players[0].id === myId && room.players.length > 1) {
      document.getElementById('btn-start').classList.remove('hidden');
    } else {
      document.getElementById('btn-start').classList.add('hidden');
    }
    return;
  }

  // Handle Game State
  screenLobby.classList.remove('active');
  screenGame.classList.add('active');
  renderTable(room);
});

socket.on('room_reset_to_lobby', (msg) => {
  showToast(msg);
  screenGame.classList.remove('active');
  screenLobby.classList.add('active');
  document.getElementById('deck').classList.remove('hidden');
  document.getElementById('discard').classList.remove('hidden');
  document.getElementById('game-over-center').classList.add('hidden');
  document.getElementById('table-center-area').classList.remove('game-over-mode');
  seatBottom.classList.remove('has-drawn');
});

// --- In-Game Events & Animations ---

socket.on('countdown_tick', (num) => {
  const cd = document.getElementById('countdown-center');
  const cdOverlay = document.getElementById('countdown-overlay');
  cd.textContent = num;
  cdOverlay.classList.remove('hidden');
});

// Shows inner two cards at the beginning of the game
socket.on('auto_peek', (cardsArray) => {
  document.getElementById('countdown-overlay').classList.add('hidden');
  const cardEls = document.getElementById('my-cards').children;
  cardsArray.forEach(({ cardId, card }) => {
    const targetCard = Array.from(cardEls).find(el => el.dataset.id === cardId);
    if (targetCard) renderSingleCard(targetCard, card);
  });
  
  setTimeout(() => {
    cardsArray.forEach(({ cardId, card }) => {
      const targetCard = Array.from(cardEls).find(el => el.dataset.id === cardId);
      if (targetCard) { renderSingleCard(targetCard, { ...card, hidden: true }); }
    });
  }, 3500);
});

const drawnContainer = document.getElementById('drawn-container');
const drawnCardDisplay = document.getElementById('drawn-card-display');
const discardEl = document.getElementById('discard');

socket.on('you_drew', ({ card }) => {
  seatBottom.classList.add('has-drawn'); 
  drawnContainer.classList.remove('hidden');
  drawnCardDisplay.innerHTML = '';
  const cardEl = document.createElement('div');
  renderSingleCard(cardEl, card);
  drawnCardDisplay.appendChild(cardEl);
  discardEl.classList.add('highlight-discard');
});

// Utility function to get the UI seat container of a given player (sempre in senso orario da giù)
function getSeatIdByPlayerId(pId) {
  if (pId === myId) return 'seat-bottom';
  if (!gameState || !gameState.players) return null;
  const myIndex = gameState.players.findIndex(p => p.id === myId);
  const pIndex = gameState.players.findIndex(x => x.id === pId);
  if (myIndex === -1 || pIndex === -1) return null;
  const num = gameState.players.length;
  const diff = (pIndex - myIndex + num) % num;
  
  if (diff === 1) return 'seat-left';
  if (diff === 2) return 'seat-top';
  if (diff === 3) return 'seat-right';
  return null;
}

// Result of card effects (e.g. peeking a card)
socket.on('peek_result', ({ targetPlayerId, cardId, card }) => {
  const seatId = getSeatIdByPlayerId(targetPlayerId);
  if (seatId) {
    const container = document.getElementById(seatId).querySelector('.cards-grid');
    const targetCard = Array.from(container.children).find(el => el.dataset.id === cardId);
    if (targetCard) {
      renderSingleCard(targetCard, card);
      setTimeout(() => { renderSingleCard(targetCard, { ...card, hidden: true }); isPeeking = false; }, 3500);
    }
  }
});

// Animations for matching mechanic
socket.on('match_evaluation_start', ({ targetPlayerId, cardId }) => {
  const seatId = getSeatIdByPlayerId(targetPlayerId);
  if (seatId) {
    const container = document.getElementById(seatId).querySelector('.cards-grid');
    const cardEl = Array.from(container.children).find(c => c.dataset.id === cardId);
    if (cardEl) cardEl.classList.add('anim-match-eval');
  }
  showToast("⏳ Piensalo...");
});

socket.on('match_evaluation_result', ({ targetPlayerId, cardId, isMatch, cardObj }) => {
  const seatId = getSeatIdByPlayerId(targetPlayerId);
  if (seatId) {
    const container = document.getElementById(seatId).querySelector('.cards-grid');
    const cardEl = Array.from(container.children).find(c => c.dataset.id === cardId);
    if (cardEl) {
      cardEl.classList.remove('anim-match-eval');
      if (cardObj) renderSingleCard(cardEl, cardObj);
      if (isMatch) cardEl.classList.add('anim-match-success');
      else cardEl.classList.add('anim-match-fail');
    }
  }
  showMatchOverlay(isMatch);
});

let matchOverlayTimer = null;
function showMatchOverlay(isMatch) {
  const overlay = document.getElementById('match-overlay');
  const img = document.getElementById('match-overlay-img');
  if (!overlay || !img) return;

  img.src = isMatch ? 'assets/piensalo_bien.png' : 'assets/piensalo_mal.png';
  overlay.classList.remove('hidden');

  // Trigger animation restart
  img.style.animation = 'none';
  void img.offsetWidth;
  img.style.animation = '';

  clearTimeout(matchOverlayTimer);
  matchOverlayTimer = setTimeout(() => {
    overlay.classList.add('hidden');
  }, 1600);
}

socket.on('play_swap_animation', ({ p1Id, c1Id, p2Id, c2Id }) => {
  const s1 = getSeatIdByPlayerId(p1Id);
  const s2 = getSeatIdByPlayerId(p2Id);
  if (s1 && c1Id) {
    const el = Array.from(document.getElementById(s1).querySelector('.cards-grid').children).find(e => e.dataset.id === c1Id);
    if (el) el.classList.add('anim-swap');
  }
  if (s2 && c2Id) {
    const el = Array.from(document.getElementById(s2).querySelector('.cards-grid').children).find(e => e.dataset.id === c2Id);
    if (el) el.classList.add('anim-swap');
  }
});

socket.on('play_jolly_animation', ({ p1Id, p2Id }) => {
  const s1 = getSeatIdByPlayerId(p1Id);
  const s2 = getSeatIdByPlayerId(p2Id);
  if (s1) {
    Array.from(document.getElementById(s1).querySelector('.cards-grid').children).forEach(c => c.classList.add('anim-swap'));
  }
  if (s2) {
    Array.from(document.getElementById(s2).querySelector('.cards-grid').children).forEach(c => c.classList.add('anim-swap'));
  }
});

socket.on('msg', (text) => showToast(text));

socket.on('game_over', ({ leaderboard, winnerId, winnerName }) => {
  resetDrawnUI();
  document.getElementById('btn-knock').classList.add('hidden');
  document.getElementById('deck').classList.add('hidden');
  document.getElementById('discard').classList.add('hidden');
  document.getElementById('table-center-area').classList.add('game-over-mode');
  
  const goCenter = document.getElementById('game-over-center');
  const goTitle = document.getElementById('go-title');
  goCenter.classList.remove('hidden');
  
  if (winnerId === myId) {
    goTitle.textContent = 'HAI VINTO!';
    goTitle.style.color = '#ebf065';
  } else {
    goTitle.textContent = `HA VINTO ${winnerName.toUpperCase()}`;
    goTitle.style.color = '#ff4757';
  }

  // Reveal all cards
  leaderboard.forEach(playerData => {
    const seatId = getSeatIdByPlayerId(playerData.id);
    const seatEl = document.getElementById(seatId);
    if (seatEl) {
      const container = seatEl.querySelector('.cards-grid');
      container.innerHTML = '';
      playerData.cards.forEach(c => {
         const cardEl = document.createElement('div');
         renderSingleCard(cardEl, c);
         container.appendChild(cardEl);
      });
    }
  });
});

// --- User Interaction with Board ---

function showToast(text) {
  const t = document.getElementById('toast-msg');
  t.textContent = text;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

document.getElementById('deck').addEventListener('click', () => {
  if (gameState && gameState.state === 'PLAYING' && gameState.activePlayerId === myId) {
    socket.emit('draw_from_deck');
  }
});

discardEl.addEventListener('click', () => {
  if (gameState && gameState.drawnCard && gameState.activePlayerId === myId) {
    socket.emit('discard_drawn');
    resetDrawnUI();
  }
});

document.getElementById('btn-knock').addEventListener('click', () => socket.emit('knock'));

function resetDrawnUI() {
  seatBottom.classList.remove('has-drawn');
  drawnContainer.classList.add('hidden');
  drawnCardDisplay.innerHTML = '';
  discardEl.classList.remove('highlight-discard');
}

// --- Rendering Logic ---

/**
 * Main render function that updates the game board according to the current room state.
 */
function renderTable(room) {
  document.getElementById('deck').classList.remove('hidden');
  document.getElementById('discard').classList.remove('hidden');
  document.getElementById('game-over-center').classList.add('hidden');
  document.getElementById('deck-count').textContent = room.deckCount;
  
  if (room.state === 'PLAYING' && room.activePlayerId === myId && !room.drawnCard) document.getElementById('deck').classList.add('highlight');
  else document.getElementById('deck').classList.remove('highlight');

  if (room.discardTop) renderSingleCard(discardEl, room.discardTop);
  else { discardEl.innerHTML = ''; discardEl.style.backgroundImage = 'none'; discardEl.className = 'card-slot discard-slot'; }

  const btnKnock = document.getElementById('btn-knock');
  if (room.state === 'PLAYING' && room.activePlayerId === myId && !room.drawnCard && !room.knockerId) btnKnock.classList.remove('hidden');
  else btnKnock.classList.add('hidden');

  if (!room.drawnCard && room.activePlayerId !== myId) resetDrawnUI();

  const myIndex = room.players.findIndex(p => p.id === myId);
  const seats = [
    { id: 'seat-bottom', player: room.players[myIndex] },
    { id: 'seat-left',   player: room.players[(myIndex + 1) % room.players.length] },
    { id: 'seat-top',    player: room.players[(myIndex + 2) % room.players.length] },
    { id: 'seat-right',  player: room.players[(myIndex + 3) % room.players.length] }
  ];

  seats.forEach((seat, idx) => {
    const el = document.getElementById(seat.id);
    if (!el) return;
    if (!seat.player || idx >= room.players.length) { el.classList.add('hidden'); return; }
    
    el.classList.remove('hidden');
    
    // Highlight the active player
    if (seat.player.id === room.activePlayerId) el.classList.add('active-turn');
    else el.classList.remove('active-turn');

    const nameSpan = el.querySelector('.player-name');
    if (nameSpan) nameSpan.textContent = seat.id === 'seat-bottom' ? `${seat.player.username} (Io)` : seat.player.username;

    // Render player's cards
    const container = el.querySelector('.cards-grid');
    container.innerHTML = '';
    const cLen = seat.player.cards.length;
    if (cLen <= 4) container.style.width = '104px';       
    else if (cLen <= 6) container.style.width = '158px'; 
    else container.style.width = '212px';                
    
    seat.player.cards.forEach((c) => {
      const cardEl = document.createElement('div');
      cardEl.dataset.id = c.id; 
      
      renderSingleCard(cardEl, c);
      
      // Highlight selected cards for effects
      if (room.effectData && (room.effectData.ownId === c.id || room.effectData.oppCardId === c.id)) cardEl.classList.add('highlight-selected');
      
      // Card click handling for all game actions
      cardEl.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const amIActive = room.activePlayerId === myId;
        const topDiscardId = room.discardTop ? room.discardTop.id : null;
        
        if (seat.id === 'seat-bottom') {
          // Interactions with own cards
          if (room.state === 'WAITING_GIVE_CARD' && room.effectData?.giverId === myId) socket.emit('give_card', { cardId: c.id });
          else if (room.state === 'PLAYING' && amIActive && room.drawnCard) { socket.emit('swap_card', { cardId: c.id }); resetDrawnUI(); }
          else if (room.state === 'WAITING_PEEK_OWN' && amIActive) { if (!isPeeking) { isPeeking = true; socket.emit('execute_effect_7', { cardId: c.id }); } }
          else if (room.state === 'WAITING_J_PEEK_OWN' && amIActive) { if (!isPeeking) { isPeeking = true; socket.emit('execute_effect_J_own', { cardId: c.id }); } }
          else if (room.state === 'WAITING_Q_SELECT_OWN' && amIActive) socket.emit('execute_effect_Q_own', { cardId: c.id });
          else if (['WAITING_PEEK_OPPONENT', 'WAITING_J_PEEK_OPP', 'WAITING_Q_SELECT_OPP', 'WAITING_JOLLY_SELECT_OPP'].includes(room.state) && amIActive) showToast('Devi scegliere la carta di un AVVERSARIO!');
          else if (room.state === 'PLAYING' && topDiscardId) socket.emit('attempt_match', { targetPlayerId: myId, cardId: c.id, expectedDiscardId: topDiscardId });
        } else {
          // Interactions with opponent's cards
          if (room.state === 'WAITING_PEEK_OPPONENT' && amIActive) { if (!isPeeking) { isPeeking = true; socket.emit('execute_effect_10', { targetPlayerId: seat.player.id, cardId: c.id }); } }
          else if (room.state === 'WAITING_J_PEEK_OPP' && amIActive) { if (!isPeeking) { isPeeking = true; socket.emit('execute_effect_J_opp', { targetPlayerId: seat.player.id, cardId: c.id }); } }
          else if (room.state === 'WAITING_Q_SELECT_OPP' && amIActive) socket.emit('execute_effect_Q_opp', { targetPlayerId: seat.player.id, cardId: c.id });
          else if (room.state === 'WAITING_JOLLY_SELECT_OPP' && amIActive) socket.emit('execute_effect_JOLLY', { targetPlayerId: seat.player.id });
          else if (room.state === 'PLAYING' && topDiscardId) socket.emit('attempt_match', { targetPlayerId: seat.player.id, cardId: c.id, expectedDiscardId: topDiscardId });
        }
      });
      container.appendChild(cardEl);
    });
  });
}

/**
 * Renders the HTML structure for a single playing card.
 */
function renderSingleCard(el, cardData) {
  el.innerHTML = '';
  if (cardData.hidden) {
    el.className = 'card face-down';
    const color = cardData.color || 'red';
    el.style.backgroundImage = `url('assets/Carte/back_${color}.png')`;
  } else {
    el.className = 'card face-up';
    el.style.backgroundImage = `url('assets/Carte/${cardData.rank}_${cardData.color}.png')`;
  }
}

// --- Emoticon Reactions ---
const reactionImages = {
  smile: 'assets/interazione/smile.png',
  angry: 'assets/interazione/angry.png',
  okay: 'assets/interazione/okay.png',
  high_five: 'assets/interazione/high_five.png',
  cup: 'assets/interazione/cup.png'
};

document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const reaction = btn.dataset.reaction || btn.dataset.emoji;
    if (reaction) socket.emit('send_reaction', { emoji: reaction });
  });
});

socket.on('player_reaction', ({ playerId, emoji }) => {
  showReactionBubble(playerId, emoji);
});

function showReactionBubble(playerId, reaction) {
  const seatId = getSeatIdByPlayerId(playerId);
  if (!seatId) return;
  const seatEl = document.getElementById(seatId);
  if (!seatEl) return;
  const avatarBox = seatEl.querySelector('.avatar-box');
  if (!avatarBox) return;

  // Remove existing bubble if present
  const oldBubble = avatarBox.querySelector('.speech-bubble');
  if (oldBubble) oldBubble.remove();

  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';

  if (reactionImages[reaction]) {
    const img = document.createElement('img');
    img.src = reactionImages[reaction];
    img.alt = reaction;
    img.className = 'speech-bubble-img';
    bubble.appendChild(img);
  } else {
    bubble.textContent = reaction;
  }

  avatarBox.appendChild(bubble);

  setTimeout(() => {
    if (bubble.parentNode) bubble.remove();
  }, 2800);
}


