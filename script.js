// ---- Firebase config ----
const firebaseConfig = {
  apiKey: "AIzaSyA9wr_t79GjYxC4x3E_Hd0uYaIWYrcENR8",
  authDomain: "migrant-local-connection-17c66.firebaseapp.com",
  projectId: "migrant-local-connection-17c66",
  storageBucket: "migrant-local-connection-17c66.firebasestorage.app",
  messagingSenderId: "1048173182739",
  appId: "1:1048173182739:web:c883b74b4544626f9924e6"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ---- State ----
let me = { username: null, profile: null, points: 0 };
let roomId = null;
let myRole = null;
let timerInt = null;
let offlineMode = false;
let aiProfile = null;
let roomUnsubs = [];
let queueUnsub = null;

// ---- Helpers ----
const $ = sel => document.querySelector(sel);
function show(id) { $(id).classList.remove('is-hidden'); }
function hide(id) { $(id).classList.add('is-hidden'); }
function addBubble(text, mine=false) {
  const wrap = document.createElement('div');
  wrap.className = 'message ' + (mine ? 'me' : 'other');
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = text;
  wrap.appendChild(b);
  $('#chatArea').appendChild(wrap);
  $('#chatArea').scrollTop = $('#chatArea').scrollHeight;
}
function startTimer(sec, onEnd) {
  clearInterval(timerInt);
  let t = sec;
  $('#timerBar').max = sec;
  $('#timerBar').value = sec;
  timerInt = setInterval(() => {
    t--;
    $('#timerBar').value = t;
    if (t <= 0) {
      clearInterval(timerInt);
      onEnd && onEnd();
    }
  }, 1000);
}
function resetRoomUI() {
  $('#chatArea').innerHTML = '';
  hide('#yesnoControls'); hide('#resultBanner');
  show('#askerControls'); // default, toggled later by role
  $('#roleDisplay').textContent = '—';
  $('#roomIdDisplay').textContent = '—';
}

// ---- Presence ----
function presenceHeartbeat() {
  const ref = db.collection('presence').doc(me.username);
  async function beat() {
    await ref.set({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  beat();
  setInterval(beat, 10000);
}
function watchCounts() {
  db.collection('presence').onSnapshot(s => {
    let online = 0; const now = Date.now();
    s.forEach(d => {
      const v = d.data();
      const t = v.lastSeen && v.lastSeen.toMillis ? v.lastSeen.toMillis() : 0;
      if (now - t < 20000) online++;
    });
    $('#onlineCount').textContent = online;
  });
  db.collection('queue').where('matched','==',false).onSnapshot(s => {
    $('#queueCount').textContent = s.size;
  });
}

// ---- Entry/Login (unique username only) ----
$('#enterBtn').onclick = async () => {
  const uname = $('#entryName').value.trim();
  const profile = $('#entryProfile').value;
  if (!uname) { $('#nameError').textContent = 'Please enter a username.'; return; }
  $('#nameError').textContent = '';

  const uRef = db.collection('users').doc(uname);
  const snap = await uRef.get();
  if (snap.exists) {
    const data = snap.data();
    me = { username: uname, profile: data.profile || 'local', points: data.points || 0 };
  } else {
    await uRef.set({ profile, points: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    me = { username: uname, profile, points: 0 };
  }
  localStorage.setItem('guesslah:user', JSON.stringify(me));
  $('#displayName').textContent = me.username;
  $('#displayProfile').textContent = me.profile;
  $('#displayPoints').textContent = me.points;
  $('#navUser').textContent = me.username;

  hide('#entryPage'); show('#homePage');
  presenceHeartbeat(); watchCounts();
};

// ---- Navbar actions ----
$('#navHome').onclick = () => {
  // Leave current room if any
  if (roomId) leaveRoomOnline();
  if (queueUnsub) { queueUnsub(); queueUnsub = null; }
  hide('#matchPage'); show('#homePage');
};
$('#navLogout').onclick = () => {
  if (queueUnsub) { queueUnsub(); queueUnsub = null; }
  localStorage.removeItem('guesslah:user');
  location.reload();
};

// ---- Challenge / Matchmaking (ONLINE) ----
$('#challengeBtn').onclick = async () => {
  hide('#challengeBtn'); show('#cancelBtn'); show('#loadingSpinner');
  const myQueueRef = db.collection('queue').doc(me.username);
  await myQueueRef.set({
    username: me.username, profile: me.profile,
    ts: firebase.firestore.FieldValue.serverTimestamp(), matched: false
  });

  // Listen for match assignment (roomId set by matchmaker)
  if (queueUnsub) { queueUnsub(); }
  queueUnsub = myQueueRef.onSnapshot(snap => {
    const data = snap.data();
    if (data && data.matched && data.roomId) {
      hide('#loadingSpinner'); hide('#cancelBtn'); show('#challengeBtn');
      enterRoomOnline(data.roomId);
    }
  });

  findMatch();
};

$('#cancelBtn').onclick = async () => {
  try { await db.collection('queue').doc(me.username).delete(); } catch {}
  if (queueUnsub) { queueUnsub(); queueUnsub = null; }
  hide('#cancelBtn'); hide('#loadingSpinner'); show('#challengeBtn');
};

async function findMatch() {
  const q = await db.collection('queue').where('matched','==',false).orderBy('ts').get();
  if (q.size >= 2) {
    const partnerDoc = q.docs.find(d => d.id !== me.username);
    if (!partnerDoc) { setTimeout(findMatch, 1200); return; }
    const partner = partnerDoc.id;

    // Unique room id per match
    const rKeyBase = [me.username, partner].sort().join('_');
    const rKey = `${rKeyBase}_${Date.now()}`;

    const rRef = db.collection('rooms').doc(rKey);
    const myQRef = db.collection('queue').doc(me.username);
    const partnerQRef = db.collection('queue').doc(partner);

    await db.runTransaction(async tx => {
      const rSnap = await tx.get(rRef);
      if (!rSnap.exists) {
        const roles = Math.random() < 0.5 ? { [me.username]:'asker', [partner]:'yesno' } : { [me.username]:'yesno', [partner]:'asker' };
        tx.set(rRef, {
          state:'active',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          startAt: firebase.firestore.FieldValue.serverTimestamp(),
          deadlineSec: 30,
          members: { [me.username]: { profile: me.profile }, [partner]: { profile: partnerDoc.data().profile } },
          roles
        });
        // Mark both matched and include roomId so clients can join via their queue listener
        tx.update(myQRef, { matched: true, roomId: rKey });
        tx.update(partnerQRef, { matched: true, roomId: rKey });
      }
    });
    // Do not call enterRoomOnline here; both clients will navigate via queue listener
  } else {
    setTimeout(findMatch, 1200);
  }
}

function enterRoomOnline(id) {
  offlineMode = false;
  roomId = id;
  resetRoomUI();
  $('#roomIdDisplay').textContent = id;
  hide('#homePage'); show('#matchPage');
  hide('#offlineBanner');

  // Unsubscribe old listeners
  roomUnsubs.forEach(u => u());
  roomUnsubs = [];

  const rRef = db.collection('rooms').doc(id);

  // Room snapshot for role/timer/outcome
  roomUnsubs.push(rRef.onSnapshot(doc => {
    const d = doc.data(); if (!d) return;
    myRole = d.roles && d.roles[me.username];
    $('#roleDisplay').textContent = myRole ? myRole.toUpperCase() : '—';
    if (myRole === 'asker') { show('#askerControls'); hide('#yesnoControls'); }
    else if (myRole === 'yesno') { hide('#askerControls'); show('#yesnoControls'); }

    // start or keep timer
    if (d.startAt && d.deadlineSec) {
      const endMs = d.startAt.toMillis() + d.deadlineSec*1000;
      const remain = Math.max(0, Math.ceil((endMs - Date.now())/1000));
      startTimer(remain, tryScoreRoomOnline);
    }

    if (d.state === 'ended' && d.outcome) {
      showOutcome(d.outcome.text);
    }
    if (d.state === 'abandoned') {
      addBubble('⚠ The other participant left.');
    }
  }));

  // Messages listener
  roomUnsubs.push(
    rRef.collection('messages').orderBy('ts').onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'added') {
          const m = ch.doc.data();
          addBubble(`${m.from}: ${m.text}`, m.from === me.username);
        }
      });
    })
  );

  // Scoring tick (only by first username to avoid double-scoring)
  const firstUser = id.split('_')[0];
  const iAmScorer = me.username === firstUser;
  if (iAmScorer) {
    const tick = async () => {
      const d = (await rRef.get()).data();
      if (!d || d.state !== 'active') return;
      const endMs = (d.startAt ? d.startAt.toMillis() : Date.now()) + (d.deadlineSec || 30)*1000;
      if (Date.now() >= endMs) { await tryScoreRoomOnline(); }
      else { setTimeout(tick, 1000); }
    };
    tick();
  }
}

async function sendMessageOnline(text) {
  if (!roomId) return;
  if (myRole === 'yesno' && !/^\s*(yes|no)\s*$/i.test(text)) {
    addBubble('⚠ You can only answer Yes or No.', true);
    return;
  }
  await db.collection('rooms').doc(roomId).collection('messages')
    .add({ from: me.username, text, ts: firebase.firestore.FieldValue.serverTimestamp() });
}

async function submitGuessOnline(target) {
  if (!roomId) return;
  const rRef = db.collection('rooms').doc(roomId);
  await rRef.collection('guesses').doc(me.username)
    .set({ target, ts: firebase.firestore.FieldValue.serverTimestamp() });
  addBubble(`🧠 You guessed your partner is ${target.toUpperCase()}.`, true);
  const s = await rRef.collection('guesses').get();
  if (s.size >= 2) await tryScoreRoomOnline();
}

async function tryScoreRoomOnline() {
  if (!roomId) return;
  const rRef = db.collection('rooms').doc(roomId);
  await db.runTransaction(async tx => {
    const rSnap = await tx.get(rRef);
    const d = rSnap.data();
    if (!d || d.state !== 'active') return;

    const gSnap = await rRef.collection('guesses').get();
    const members = Object.keys(d.members || {});
    const guesses = {};
    gSnap.forEach(doc => guesses[doc.id] = doc.data().target);
    if (members.length !== 2) return;

    const [u1, u2] = members;
    const ground = { [u1]: d.members[u1].profile, [u2]: d.members[u2].profile };
    const c1 = guesses[u1] && guesses[u1] === ground[u2];
    const c2 = guesses[u2] && guesses[u2] === ground[u1];

    let text='', deltas={};
    if (c1 && c2) { deltas[u1]=10; deltas[u2]=10; text='✅ Both guessed correctly! +10 each.'; }
    else if (!c1 && !c2) { deltas[u1]=-5; deltas[u2]=-5; text='❌ Both guessed wrong. -5 each.'; }
    else { deltas[u1]=c1?5:0; deltas[u2]=c2?5:0; text=`☑️ One correct. ${u1} ${deltas[u1]>=0?'+':''}${deltas[u1]} • ${u2} ${deltas[u2]>=0?'+':''}${deltas[u2]}`; }

    // Apply outcome
    tx.update(rRef, { state:'ended', outcome:{ text } });

    // Points updates
    const u1Ref = db.collection('users').doc(u1);
    const u2Ref = db.collection('users').doc(u2);
    tx.update(u1Ref, { points: firebase.firestore.FieldValue.increment(deltas[u1]||0) });
    tx.update(u2Ref, { points: firebase.firestore.FieldValue.increment(deltas[u2]||0) });
  });
}

// Leave room handler
async function leaveRoomOnline() {
  if (!roomId) return;
  const rRef = db.collection('rooms').doc(roomId);
  try {
    const doc = await rRef.get();
    if (doc.exists && doc.data().state === 'active') {
      await rRef.update({ state: 'abandoned' });
    }
  } catch {}
  roomUnsubs.forEach(u=>u()); roomUnsubs = [];
  roomId = null; myRole = null; resetRoomUI();
}

// Bind chat controls
$('#sendBtn').onclick = () => {
  const v = $('#chatInput').value.trim();
  if (!v) return;
  $('#chatInput').value='';
  if (offlineMode) sendMessageOffline(v);
  else sendMessageOnline(v);
};
$('#btnYes').onclick = () => offlineMode ? sendMessageOffline('Yes') : sendMessageOnline('Yes');
$('#btnNo').onclick  = () => offlineMode ? sendMessageOffline('No')  : sendMessageOnline('No');

$('#guessMigrant').onclick = () => offlineMode ? submitGuessOffline('migrant') : submitGuessOnline('migrant');
$('#guessLocal').onclick   = () => offlineMode ? submitGuessOffline('local')   : submitGuessOnline('local');

// ---- Offline Mode (AI opponent always YES/NO role) ----
$('#offlineBtn').onclick = () => {
  offlineMode = true;
  aiProfile = Math.random() < 0.5 ? 'local' : 'migrant';
  roomId = 'offline_' + Date.now();
  resetRoomUI();
  $('#roomIdDisplay').textContent = roomId;
  $('#roleDisplay').textContent = 'ASKER';
  hide('#homePage'); show('#matchPage'); show('#offlineBanner');
  startTimer(30, () => {
    // user still needs to guess; no auto-score
  });
};

function sendMessageOffline(text) {
  // Player is always asker in offline mode. Display their message:
  addBubble(`${me.username}: ${text}`, true);
  // AI responds with Yes/No after a short delay
  setTimeout(() => {
    const aiAnswer = Math.random() < 0.5 ? 'Yes' : 'No';
    addBubble(`AI: ${aiAnswer}`, false);
  }, 900 + Math.floor(Math.random()*600));
}

function submitGuessOffline(target) {
  const correct = target === aiProfile;
  const delta = correct ? 10 : -5;
  me.points = (me.points || 0) + delta;
  $('#displayPoints').textContent = me.points;
  db.collection('users').doc(me.username).update({ points: me.points }).catch(()=>{});
  showOutcome(`You guessed ${target.toUpperCase()}. Opponent was ${aiProfile.toUpperCase()}. ${correct?'+10':'-5'} points.`);
}

// ---- Shared Outcome UI ----
function showOutcome(text) {
  const b = $('#resultBanner');
  b.textContent = text;
  b.classList.remove('is-hidden');
  setTimeout(() => {
    hide('#matchPage'); show('#homePage');
    b.classList.add('is-hidden');
    // Refresh my points from Firestore
    db.collection('users').doc(me.username).get().then(s=>{
      if (s.exists) { me.points = s.data().points || me.points; $('#displayPoints').textContent = me.points; }
    });
  }, 4500);
}

// Restore session if present
document.addEventListener('DOMContentLoaded', () => {
  try {
    const saved = JSON.parse(localStorage.getItem('guesslah:user')||'null');
    if (saved && saved.username) {
      me = saved;
      $('#displayName').textContent = me.username;
      $('#displayProfile').textContent = me.profile;
      $('#displayPoints').textContent = me.points || 0;
      $('#navUser').textContent = me.username;
      hide('#entryPage'); show('#homePage');
      presenceHeartbeat(); watchCounts();
    }
  } catch {}
});
