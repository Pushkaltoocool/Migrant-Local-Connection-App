// Firebase init (same project)
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

const $ = s => document.querySelector(s);
const user = JSON.parse(localStorage.getItem('guesslah:user')||'null');
if (!user || !user.username) {
  alert('Please log in first.');
  location.href = 'index.html';
}

// Voucher catalog
const CATALOG = [
  { id:'fairprice5',  brand:'FairPrice',     title:'$5 Grocery Voucher',   cost:40,  value:5 },
  { id:'mcd5',        brand:"McDonald's",  title:'$5 Meal Voucher',      cost:35,  value:5 },
  { id:'toastbox3',   brand:'Toast Box',     title:'$3 Coffee Voucher',    cost:25,  value:3 },
  { id:'grab8',       brand:'Grab',          title:'$8 Ride Voucher',      cost:60,  value:8 },
  { id:'ezlink5',     brand:'EZ-Link',       title:'$5 Top-Up',            cost:50,  value:5 },
  { id:'shengsiong5', brand:'Sheng Siong',   title:'$5 Grocery Voucher',   cost:40,  value:5 },
  { id:'giant10',     brand:'Giant',         title:'$10 Grocery Voucher',  cost:80,  value:10 },
  { id:'koufu4',      brand:'Koufu',         title:'$4 Foodcourt Voucher', cost:30,  value:4 },
];

// Simple quiz bank
const QUIZ = [
  { q:'Is the game about mutual respect and empathy?', a:['Yes','No'], correct:0 },
  { q:'If someone struggles with English, what should you do?', a:['Mock them','Be patient and use simple words'], correct:1 },
  { q:'True or False: Stereotypes are helpful to know people.', a:['True','False'], correct:1 },
  { q:'The Merlion is a symbol of which country?', a:['Thailand','Singapore'], correct:1 },
  { q:'If you’re unsure about a culture, you should…', a:['Avoid them','Ask politely and learn'], correct:1 },
];

let myPoints = 0;
let myVouchers = [];
let pendingVoucher = null; // voucher object being claimed

function renderCatalog() {
  const list = $('#voucherList'); list.innerHTML = '';
  CATALOG.forEach(v => {
    const col = document.createElement('div');
    col.className = 'column is-12-mobile is-6-tablet is-4-desktop';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <header class="card-header">
        <p class="card-header-title">${v.brand}</p>
      </header>
      <div class="card-content">
        <div class="content">
          <strong>${v.title}</strong><br>
          <span class="tag is-info is-light">${v.cost} pts</span>
        </div>
      </div>
      <footer class="card-footer">
        <a class="card-footer-item claim-btn">Claim</a>
      </footer>`;

    card.querySelector('.claim-btn').addEventListener('click', () => startClaim(v));
    col.appendChild(card);
    list.appendChild(col);
  });
}

function renderClaimed() {
  const list = $('#claimedList'); list.innerHTML = '';
  if (!myVouchers || myVouchers.length === 0) {
    list.innerHTML = '<div class="column is-12"><p class="has-text-grey">No vouchers yet.</p></div>';
    return;
  }
  myVouchers.forEach(v => {
    const col = document.createElement('div');
    col.className = 'column is-12-mobile is-6-tablet is-4-desktop';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <header class="card-header">
        <p class="card-header-title">${v.brand}</p>
      </header>
      <div class="card-content">
        <div class="content">
          <strong>${v.title}</strong><br>
          <span class="tag is-success is-light">CLAIMED</span>
          <p class="is-size-7 mt-2"><strong>Code:</strong> ${v.code}</p>
          <p class="is-size-7"><strong>Date:</strong> ${new Date(v.claimedAt).toLocaleString()}</p>
        </div>
      </div>`;
    col.appendChild(card);
    list.appendChild(col);
  });
}

function startClaim(v) {
  if (myPoints < v.cost) {
    alert(`Not enough points. You need ${v.cost}.`);
    return;
  }
  pendingVoucher = v;
  openQuiz();
}

function openQuiz() {
  $('#quizError').textContent = '';
  $('#quizContainer').innerHTML = '';
  const picked = pickQuestions(3);
  picked.forEach((q, idx) => {
    const box = document.createElement('div');
    box.className = 'box';
    box.innerHTML = `<p class="mb-2"><strong>Q${idx+1}.</strong> ${q.q}</p>`;
    q.a.forEach((opt, i) => {
      const id = `q${idx}_${i}`;
      const label = document.createElement('label');
      label.className = 'radio mr-3';
      label.innerHTML = `<input type="radio" name="q${idx}" value="${i}" id="${id}"> ${opt}`;
      box.appendChild(label);
    });
    $('#quizContainer').appendChild(box);
  });
  $('#quizModal').classList.add('is-active');
  $('#quizSubmit').onclick = () => submitQuiz(picked);
  $('#quizCancel').onclick = closeQuiz;
  $('#quizClose').onclick = closeQuiz;
}

function closeQuiz() {
  $('#quizModal').classList.remove('is-active');
  pendingVoucher = null;
}

function pickQuestions(n) {
  const shuffled = QUIZ.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function submitQuiz(picked) {
  const answers = [];
  for (let i=0;i<picked.length;i++) {
    const sel = document.querySelector(`input[name="q${i}"]:checked`);
    if (!sel) { $('#quizError').textContent = 'Please answer all questions.'; return; }
    answers.push(parseInt(sel.value, 10));
  }
  const correct = answers.reduce((acc, a, i) => acc + (a === picked[i].correct ? 1 : 0), 0);
  const passed = correct >= 2; // need at least 2 correct

  const v = pendingVoucher;
  if (!v) return;

  try {
    await db.runTransaction(async tx => {
      const uRef = db.collection('users').doc(user.username);
      const uSnap = await tx.get(uRef);
      const data = uSnap.data() || {};
      const pts = data.points || 0;
      if (pts < v.cost) throw new Error('Not enough points now.');

      const updates = { points: firebase.firestore.FieldValue.increment(-v.cost) };
      if (passed) {
        const voucherObj = {
          id: v.id,
          brand: v.brand,
          title: v.title,
          value: v.value,
          code: genCode(),
          claimedAt: Date.now()
        };
        const existing = Array.isArray(data.vouchers) ? data.vouchers : [];
        // Prevent duplicate exact objects: use arrayUnion
        updates['vouchers'] = firebase.firestore.FieldValue.arrayUnion(voucherObj);
      }
      tx.update(uRef, updates);
    });

    // Reflect locally
    myPoints -= v.cost;
    $('#vPoints').textContent = myPoints;

    if (passed) {
      // Reload vouchers from DB to get the exact stored object
      await loadUser();
      alert(`✅ Passed! You claimed: ${v.title}`);
    } else {
      alert('❌ You failed the quiz. Points deducted, voucher not awarded.');
    }
  } catch (e) {
    alert('Error: ' + e.message);
  } finally {
    closeQuiz();
  }
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s=''; for (let i=0;i<10;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

async function loadUser() {
  const uRef = db.collection('users').doc(user.username);
  const snap = await uRef.get();
  const data = snap.data() || {};
  myPoints = data.points || 0;
  myVouchers = Array.isArray(data.vouchers) ? data.vouchers : [];
  $('#vUser').textContent = user.username;
  $('#vPoints').textContent = myPoints;
  $('#userBadge').textContent = user.username;
  renderCatalog();
  renderClaimed();
}

document.addEventListener('DOMContentLoaded', loadUser);
