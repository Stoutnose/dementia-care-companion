// ---------- CLOCK ----------
function tick() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('clock').textContent = time;
  document.getElementById('dayText').textContent = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}
setInterval(tick, 1000);
tick();

// ---------- LOCAL STORAGE KEYS ----------
const LS_REMINDERS = 'dc_reminders';
const LS_HELPER = 'dc_helper';

// ---------- REMINDERS ----------
function getReminders() {
  return JSON.parse(localStorage.getItem(LS_REMINDERS) || '[]');
}
function saveReminders(list) {
  localStorage.setItem(LS_REMINDERS, JSON.stringify(list));
}
function renderReminders() {
  const container = document.getElementById('reminders');
  const reminders = getReminders();
  if (!reminders.length) {
    container.innerHTML = '<div class="sub">No reminders yet.</div>';
    return;
  }
  container.innerHTML = '';
  reminders.forEach(r => {
    const div = document.createElement('div');
    div.className = 'item';
    div.textContent = `⏰ ${r.time || ''} – ${r.text}`;
    container.appendChild(div);
  });
}
function addReminder() {
  const text = document.getElementById('remText').value.trim();
  const time = document.getElementById('remTime').value;
  if (!text) return alert('Please enter a reminder.');
  const reminders = getReminders();
  reminders.push({ text, time });
  saveReminders(reminders);
  document.getElementById('remText').value = '';
  document.getElementById('remTime').value = '';
  renderReminders();
}

// ---------- HELPER CONTACT ----------
function saveHelper() {
  const name = document.getElementById('helperName').value.trim();
  const phone = document.getElementById('helperPhone').value.trim();
  if (!name || !phone) return alert('Please enter both name and phone.');
  localStorage.setItem(LS_HELPER, JSON.stringify({ name, phone }));
  showHelper();
}
function showHelper() {
  const h = JSON.parse(localStorage.getItem(LS_HELPER) || 'null');
  const display = document.getElementById('helperDisplay');
  display.textContent = h ? `Helper: ${h.name} (${h.phone})` : 'No helper saved yet.';
}

// ---------- SPEECH ----------
function say(message) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(message);
    u.rate = 0.9;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } else {
    alert(message);
  }
}
function readTodayPlan() {
  const reminders = getReminders();
  if (!reminders.length) {
    say('No reminders saved for today. You can relax.');
    return;
  }
  const message = reminders
    .map(r => `${r.text} at ${r.time || 'any time'}`)
    .join('. ');
  say('Here is your plan for today. ' + message);
}
function readCalmText() {
  const text = document.getElementById('calmText').innerText;
  say(text);
}

// ---------- SOS CALL ----------
function sos() {
  const helper = JSON.parse(localStorage.getItem(LS_HELPER) || 'null');

  if (!helper || !helper.phone) {
    alert('No helper saved yet. Please add a helper contact first.');
    return;
  }

  const telNumber = helper.phone.replace(/\s+/g, '');
  const telLink = `tel:${telNumber}`;

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent);

  if (!isMobile) {
    alert(`Calling your helper ${helper.name}: ${helper.phone}.
Please open this on your Android phone to trigger the dialer.`);
    return;
  }

  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(`Calling your helper ${helper.name}.`);
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  window.location.href = telLink;
}

// ---------- INIT ----------
renderReminders();
showHelper();
