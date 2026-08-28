const KEY = "dcc-state-v2";
const MOODS = [
  { id: "great", label: "😊 Great" },
  { id: "ok", label: "🙂 OK" },
  { id: "tired", label: "😴 Tired" },
  { id: "sad", label: "😢 Sad" },
  { id: "worried", label: "😟 Worried" }
];

const defaultState = () => ({
  profile: { name: "", photo: "", address: "", allergies: "", doctor: "", story: "" },
  helper: { name: "", phone: "" },
  note: { text: "", author: "" },
  people: [],
  reminders: [],
  schedule: [
    { id: "s1", time: "08:00", text: "Breakfast" },
    { id: "s2", time: "09:00", text: "Morning medicine" },
    { id: "s3", time: "12:00", text: "Lunch" },
    { id: "s4", time: "15:00", text: "Rest or tea" },
    { id: "s5", time: "18:00", text: "Dinner" },
    { id: "s6", time: "21:00", text: "Get ready for bed" }
  ],
  scheduleDone: {},
  meds: [
    { id: "m1", name: "Morning medicine", when: "Morning" },
    { id: "m2", name: "Evening medicine", when: "Evening" }
  ],
  medsDone: {},
  meals: { breakfast: "", lunch: "", dinner: "" },
  water: { date: "", count: 0 },
  mood: { date: "", value: "" },
  checkIn: "",
  settings: { largeText: false, highContrast: false, nightMode: false, voice: true }
});

let state = loadState();
let breathTimer = null;
let activeTab = "home";

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return deepMerge(defaultState(), JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

function deepMerge(base, extra) {
  const out = { ...base, ...extra };
  out.profile = { ...base.profile, ...(extra.profile || {}) };
  out.helper = { ...base.helper, ...(extra.helper || {}) };
  out.note = { ...base.note, ...(extra.note || {}) };
  out.settings = { ...base.settings, ...(extra.settings || {}) };
  out.meals = { ...base.meals, ...(extra.meals || {}) };
  out.water = { ...base.water, ...(extra.water || {}) };
  out.mood = { ...base.mood, ...(extra.mood || {}) };
  return out;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function phoneHref(kind) {
  const phone = String(state.helper.phone || "").replace(/[^\d+]/g, "");
  if (!phone) return "";
  if (kind === "sms") {
    const body = encodeURIComponent("I need a little help. Please call me.");
    return "sms:" + phone + "?body=" + body;
  }
  return "tel:" + phone;
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function say(text) {
  if (!state.settings.voice || !text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

function partOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function resetDaily() {
  const today = todayStr();
  if (state.water.date !== today) state.water = { date: today, count: 0 };
  if (state.mood.date !== today) state.mood = { date: today, value: "" };
  ["breakfast", "lunch", "dinner"].forEach((meal) => {
    if (state.meals[meal] && state.meals[meal] !== today) state.meals[meal] = "";
  });
  save();
}

function applySettings() {
  document.documentElement.classList.toggle("large", !!state.settings.largeText);
  document.documentElement.classList.toggle("contrast", !!state.settings.highContrast);
  document.documentElement.classList.toggle("night", !!state.settings.nightMode);
  const large = document.getElementById("optLarge");
  const contrast = document.getElementById("optContrast");
  const night = document.getElementById("optNight");
  const voice = document.getElementById("optVoice");
  if (large) large.checked = !!state.settings.largeText;
  if (contrast) contrast.checked = !!state.settings.highContrast;
  if (night) night.checked = !!state.settings.nightMode;
  if (voice) voice.checked = state.settings.voice !== false;
}

function showTab(name) {
  activeTab = name;
  document.querySelectorAll(".tab").forEach((el) => {
    el.classList.toggle("is-active", el.id === "tab-" + name);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateClock() {
  const now = new Date();
  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  document.getElementById("clock").textContent = clock;
  document.getElementById("dayText").textContent = "Today is " + day;
  document.getElementById("greeting").textContent = "Good " + partOfDay();
  const name = state.profile.name || "";
  document.getElementById("helloName").textContent = name ? "Hello, " + name : "Hello 👋";
  const place = state.profile.address
    ? "You are at home · " + state.profile.address
    : "You are safe";
  document.getElementById("placeText").textContent = place;
}

function renderNote() {
  const card = document.getElementById("noteCard");
  if (!state.note.text) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  document.getElementById("noteText").textContent = state.note.text;
  document.getElementById("noteAuthor").textContent = state.note.author ? "From " + state.note.author : "";
}

function upcomingItems() {
  const now = nowHM();
  const today = todayStr();
  const sched = state.schedule
    .filter((item) => state.scheduleDone[item.id] !== today)
    .map((item) => ({ time: item.time, text: item.text }));
  const rems = state.reminders.map((item) => ({ time: item.time, text: item.text }));
  return sched.concat(rems).sort((a, b) => a.time.localeCompare(b.time));
}

function renderNextUp() {
  const items = upcomingItems();
  const now = nowHM();
  const next = items.find((item) => item.time >= now) || items[0];
  const el = document.getElementById("nextUp");
  if (!next) {
    el.textContent = "Nothing left on today’s list. You can rest.";
    return;
  }
  el.textContent = prettyTime(next.time) + " · " + next.text;
}

function prettyTime(hm) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderSchedule() {
  const today = todayStr();
  const list = document.getElementById("scheduleList");
  if (!state.schedule.length) {
    list.innerHTML = '<p class="empty">No routine items yet.</p>';
    return;
  }
  list.innerHTML = state.schedule
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((item) => {
      const done = state.scheduleDone[item.id] === today;
      return `<div class="row-item ${done ? "is-done" : ""}">
        <div class="item-main">
          <span class="item-time">${escapeHtml(prettyTime(item.time))}</span>
          ${escapeHtml(item.text)}
        </div>
        <button class="btn btn-tiny" data-action="toggle-sched" data-id="${item.id}">${done ? "Undo" : "Done"}</button>
        <button class="btn btn-tiny" data-action="del-sched" data-id="${item.id}">Remove</button>
      </div>`;
    })
    .join("");
}

function renderMeds() {
  const today = todayStr();
  const list = document.getElementById("medList");
  list.innerHTML = state.meds.map((med) => {
    const done = state.medsDone[med.id] === today;
    return `<div class="row-item ${done ? "is-done" : ""}">
      <div class="item-main"><strong>${escapeHtml(med.when)}</strong><div>${escapeHtml(med.name)}</div></div>
      <button class="btn btn-tiny" data-action="toggle-med" data-id="${med.id}">${done ? "Undo" : "Taken"}</button>
      <button class="btn btn-tiny" data-action="del-med" data-id="${med.id}">Remove</button>
    </div>`;
  }).join("") || '<p class="empty">No medicines added.</p>';
}

function renderMeals() {
  const today = todayStr();
  const meals = [
    ["breakfast", "Breakfast"],
    ["lunch", "Lunch"],
    ["dinner", "Dinner"]
  ];
  document.getElementById("mealRow").innerHTML = meals.map(([id, label]) => {
    const on = state.meals[id] === today;
    return `<button class="chip ${on ? "is-on" : ""}" data-action="toggle-meal" data-id="${id}">${on ? "✓ " : ""}${label}</button>`;
  }).join("");
}

function renderWater() {
  const count = state.water.count || 0;
  document.getElementById("waterRow").innerHTML = Array.from({ length: 8 }, (_, i) => {
    const on = i < count;
    return `<button class="glass ${on ? "is-on" : ""}" data-action="set-water" data-count="${i + 1}" aria-label="Glass ${i + 1} of 8">${on ? "💧" : "○"}</button>`;
  }).join("");
  document.getElementById("waterText").textContent = count + " of 8 glasses today";
}

function renderMood() {
  document.getElementById("moodRow").innerHTML = MOODS.map((mood) => {
    const on = state.mood.value === mood.id;
    return `<button class="mood-btn ${on ? "is-on" : ""}" data-action="set-mood" data-id="${mood.id}">${mood.label}</button>`;
  }).join("");
  const found = MOODS.find((m) => m.id === state.mood.value);
  document.getElementById("moodText").textContent = found ? "Today you feel " + found.label : "Tap how you feel.";
}

function renderReminders() {
  const box = document.getElementById("reminders");
  if (!state.reminders.length) {
    box.innerHTML = '<p class="empty">No extra reminders yet.</p>';
    return;
  }
  box.innerHTML = state.reminders.map((item) => `
    <div class="item">
      <div class="item-main"><span class="item-time">${escapeHtml(prettyTime(item.time))}</span>${escapeHtml(item.text)}</div>
      <button class="btn btn-tiny" data-action="del-rem" data-id="${item.id}">Remove</button>
    </div>
  `).join("");
}

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

function renderPeople() {
  const grid = document.getElementById("peopleGrid");
  if (!state.people.length) {
    grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Add photos of family and friends so faces stay familiar.</p>';
    return;
  }
  grid.innerHTML = state.people.map((person) => {
    const face = person.photo
      ? `<img src="${person.photo}" alt="${escapeHtml(person.name)}">`
      : `<div class="avatar">${escapeHtml(initials(person.name))}</div>`;
    return `<button class="person" data-action="say-person" data-id="${person.id}">
      ${face}
      <strong>${escapeHtml(person.name)}</strong>
      <span>${escapeHtml(person.relation || "")}</span>
    </button>`;
  }).join("");
}

function renderMe() {
  const name = state.profile.name || "My name can be added here";
  const photo = state.profile.photo
    ? `<img src="${state.profile.photo}" alt="${escapeHtml(name)}">`
    : `<div class="avatar">${escapeHtml(initials(state.profile.name || "Me"))}</div>`;
  document.getElementById("idBody").innerHTML = `
    <div class="id-face">
      ${photo}
      <div>
        <h1 style="font-size:1.4rem;margin:0 0 6px">${escapeHtml(name)}</h1>
        <p class="sub">${escapeHtml(state.profile.address || "Home address not set yet")}</p>
        <p class="sub">Helper: ${escapeHtml(state.helper.name || "Not set")}</p>
      </div>
    </div>`;
  document.getElementById("medInfo").innerHTML = `
    <p><strong>Allergies / conditions</strong><br>${escapeHtml(state.profile.allergies || "None written yet")}</p>
    <p><strong>Doctor</strong><br>${escapeHtml(state.profile.doctor || "Not set")}</p>`;
  document.getElementById("storyText").textContent = state.profile.story || "A caregiver can write a short life story here.";
  document.getElementById("profileName").value = state.profile.name || "";
  document.getElementById("profileAddress").value = state.profile.address || "";
  document.getElementById("profileAllergies").value = state.profile.allergies || "";
  document.getElementById("profileDoctor").value = state.profile.doctor || "";
  document.getElementById("profileStory").value = state.profile.story || "";
}

function renderHelper() {
  document.getElementById("helperName").value = state.helper.name || "";
  document.getElementById("helperPhone").value = state.helper.phone || "";
  const display = document.getElementById("helperDisplay");
  if (state.helper.name || state.helper.phone) {
    display.textContent = "Saved: " + (state.helper.name || "Helper") + " · " + (state.helper.phone || "no phone");
  } else {
    display.textContent = "No helper saved yet.";
  }
  const check = document.getElementById("checkInText");
  if (!state.checkIn) {
    check.textContent = "No check-in yet.";
  } else {
    const when = new Date(state.checkIn);
    check.textContent = "Last “I am okay” was " + when.toLocaleString() + ".";
  }
}

function fillNoteForm() {
  document.getElementById("careNote").value = state.note.text || "";
  document.getElementById("careAuthor").value = state.note.author || "";
}

function renderAll() {
  resetDaily();
  applySettings();
  updateClock();
  renderNote();
  renderNextUp();
  renderSchedule();
  renderMeds();
  renderMeals();
  renderWater();
  renderMood();
  renderReminders();
  renderPeople();
  renderMe();
  renderHelper();
  fillNoteForm();
}

function orientationSpeech() {
  const now = new Date();
  const bits = [
    "You are safe.",
    "Today is " + now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + ".",
    "It is " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " in the " + partOfDay() + "."
  ];
  if (state.profile.name) bits.push("Your name is " + state.profile.name + ".");
  if (state.profile.address) bits.push("You live at " + state.profile.address + ".");
  if (state.helper.name) bits.push("Your helper is " + state.helper.name + ".");
  bits.push("You are not alone.");
  return bits.join(" ");
}

function closeOverlay() {
  if (breathTimer) {
    clearInterval(breathTimer);
    breathTimer = null;
  }
  document.getElementById("overlay").classList.add("hidden");
  document.getElementById("breathWrap").classList.add("hidden");
}

function openOverlay(title, body, actionsHtml, showBreath) {
  document.getElementById("overlayTitle").textContent = title;
  document.getElementById("overlayBody").textContent = body;
  document.getElementById("overlayActions").innerHTML = actionsHtml;
  document.getElementById("breathWrap").classList.toggle("hidden", !showBreath);
  document.getElementById("overlay").classList.remove("hidden");
}

function confusedHelp() {
  vibrate([80, 40, 80]);
  const body = orientationSpeech();
  say(body);
  openOverlay(
    "You are safe",
    body,
    `<button class="btn btn-soft" data-action="breathe">🌬️ Breathe with me</button>
     <button class="btn btn-danger" data-action="sos">🚨 Call helper</button>
     <button class="btn btn-ok" data-action="check-in">✅ I am okay</button>
     <button class="btn btn-main" data-action="close-overlay">Close</button>`,
    false
  );
}

function startBreathing() {
  closeOverlay();
  openOverlay(
    "Breathe with me",
    "Follow the circle. Slow is best.",
    `<button class="btn btn-main" data-action="close-overlay">I feel calmer</button>`,
    true
  );
  const circle = document.getElementById("breathCircle");
  const cue = document.getElementById("breathCue");
  let phase = 0;
  const steps = [
    { cls: "in", text: "Breathe in…", say: "Breathe in slowly" },
    { cls: "", text: "Breathe out…", say: "Breathe out slowly" }
  ];
  const tick = () => {
    const step = steps[phase % 2];
    circle.classList.toggle("in", !!step.cls);
    cue.textContent = step.text;
    say(step.say);
    phase += 1;
    if (phase > 8) {
      closeOverlay();
      say("Well done. You are safe.");
    }
  };
  tick();
  breathTimer = setInterval(tick, 4500);
}

function readTodayPlan() {
  const items = upcomingItems();
  if (!items.length) {
    say("There is nothing left on today’s plan. You can rest.");
    return;
  }
  const spoken = "Here is today’s plan. " + items.map((item) => prettyTime(item.time) + ", " + item.text).join(". ");
  say(spoken);
}

function sos() {
  if (!state.helper.phone) {
    say("Please save a helper phone number first.");
    showTab("more");
    return;
  }
  vibrate([200, 80, 200]);
  say("Calling " + (state.helper.name || "your helper") + " now.");
  window.location.href = phoneHref("tel");
}

function textHelper() {
  if (!state.helper.phone) {
    say("Please save a helper phone number first.");
    showTab("more");
    return;
  }
  window.location.href = phoneHref("sms");
}

function checkIn() {
  state.checkIn = new Date().toISOString();
  save();
  renderHelper();
  closeOverlay();
  say("Thank you. You are okay, and you are safe.");
  openOverlay(
    "You are okay",
    "This time was saved: " + new Date(state.checkIn).toLocaleString() + ".",
    `<button class="btn btn-main" data-action="close-overlay">Close</button>`,
    false
  );
}

function addReminder() {
  const text = document.getElementById("remText").value.trim();
  const time = document.getElementById("remTime").value;
  if (!text || !time) {
    say("Please type a reminder and a time.");
    return;
  }
  state.reminders.push({ id: uid("r"), text, time, lastFired: "" });
  document.getElementById("remText").value = "";
  document.getElementById("remTime").value = "";
  save();
  renderReminders();
  renderNextUp();
  say("Reminder saved for " + prettyTime(time));
}

function addSchedule() {
  const text = document.getElementById("schedText").value.trim();
  const time = document.getElementById("schedTime").value;
  if (!text || !time) return;
  state.schedule.push({ id: uid("s"), text, time });
  document.getElementById("schedText").value = "";
  document.getElementById("schedTime").value = "";
  save();
  renderSchedule();
  renderNextUp();
}

function addMed() {
  const name = document.getElementById("medName").value.trim();
  const when = document.getElementById("medWhen").value;
  if (!name) return;
  state.meds.push({ id: uid("m"), name, when });
  document.getElementById("medName").value = "";
  save();
  renderMeds();
}

async function fileToDataUrl(file) {
  if (!file) return "";
  const img = await blobToImage(file);
  const canvas = document.createElement("canvas");
  const max = 360;
  let { width, height } = img;
  if (width > height && width > max) {
    height = height * max / width;
    width = max;
  } else if (height > max) {
    width = width * max / height;
    height = max;
  }
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function blobToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function addPerson() {
  const name = document.getElementById("personName").value.trim();
  if (!name) return;
  const file = document.getElementById("personPhoto").files[0];
  const photo = await fileToDataUrl(file);
  state.people.push({
    id: uid("p"),
    name,
    relation: document.getElementById("personRelation").value.trim(),
    note: document.getElementById("personNote").value.trim(),
    photo
  });
  document.getElementById("personName").value = "";
  document.getElementById("personRelation").value = "";
  document.getElementById("personNote").value = "";
  document.getElementById("personPhoto").value = "";
  save();
  renderPeople();
  say(name + " has been added.");
}

function sayPerson(id) {
  const person = state.people.find((p) => p.id === id);
  if (!person) return;
  const bits = ["This is " + person.name + "."];
  if (person.relation) bits.push(person.relation + ".");
  if (person.note) bits.push(person.note + ".");
  bits.push("You know this person.");
  const text = bits.join(" ");
  say(text);
  openOverlay(
    person.name,
    text,
    `<button class="btn btn-main" data-action="close-overlay">Close</button>
     <button class="btn btn-tiny" data-action="del-person" data-id="${person.id}">Remove this person</button>`,
    false
  );
}

async function saveProfile() {
  const file = document.getElementById("profilePhoto").files[0];
  const photo = file ? await fileToDataUrl(file) : state.profile.photo;
  state.profile = {
    name: document.getElementById("profileName").value.trim(),
    address: document.getElementById("profileAddress").value.trim(),
    allergies: document.getElementById("profileAllergies").value.trim(),
    doctor: document.getElementById("profileDoctor").value.trim(),
    story: document.getElementById("profileStory").value.trim(),
    photo
  };
  document.getElementById("profilePhoto").value = "";
  save();
  renderAll();
  say("Your details are saved.");
}

function saveHelper() {
  state.helper = {
    name: document.getElementById("helperName").value.trim(),
    phone: document.getElementById("helperPhone").value.trim()
  };
  save();
  renderHelper();
  renderMe();
  say("Helper saved.");
}

function saveNote() {
  state.note = {
    text: document.getElementById("careNote").value.trim(),
    author: document.getElementById("careAuthor").value.trim()
  };
  save();
  renderNote();
  say("The note is saved on the home screen.");
}

function checkReminders() {
  const now = nowHM();
  const today = todayStr();
  state.reminders.forEach((item) => {
    if (item.time === now && item.lastFired !== today) {
      item.lastFired = today;
      save();
      vibrate([180, 80, 180, 80, 180]);
      say("Reminder. " + item.text);
      openOverlay(
        "Reminder",
        prettyTime(item.time) + " · " + item.text,
        `<button class="btn btn-ok" data-action="close-overlay">I did this</button>`,
        false
      );
      if (window.Notification && Notification.permission === "granted") {
        new Notification("Reminder", { body: item.text });
      }
    }
  });
}

function onAction(action, id, count) {
  const today = todayStr();
  switch (action) {
    case "confused": return confusedHelp();
    case "read-plan": return readTodayPlan();
    case "breathe": return startBreathing();
    case "check-in": return checkIn();
    case "sos": return sos();
    case "text-helper": return textHelper();
    case "read-calm": return say(document.getElementById("calmText").textContent);
    case "read-note": return say((state.note.text || "") + (state.note.author ? ". From " + state.note.author : ""));
    case "read-story": return say(state.profile.story || "No story has been written yet.");
    case "add-reminder": return addReminder();
    case "add-schedule": return addSchedule();
    case "add-med": return addMed();
    case "add-person": return addPerson();
    case "save-profile": return saveProfile();
    case "save-helper": return saveHelper();
    case "save-note": return saveNote();
    case "close-overlay": return closeOverlay();
    case "say-person": return sayPerson(id);
    case "toggle-sched":
      state.scheduleDone[id] = state.scheduleDone[id] === today ? "" : today;
      save(); renderSchedule(); renderNextUp(); return;
    case "del-sched":
      state.schedule = state.schedule.filter((item) => item.id !== id);
      save(); renderSchedule(); renderNextUp(); return;
    case "toggle-med":
      state.medsDone[id] = state.medsDone[id] === today ? "" : today;
      save(); renderMeds(); return;
    case "del-med":
      state.meds = state.meds.filter((item) => item.id !== id);
      save(); renderMeds(); return;
    case "del-rem":
      state.reminders = state.reminders.filter((item) => item.id !== id);
      save(); renderReminders(); renderNextUp(); return;
    case "del-person":
      state.people = state.people.filter((item) => item.id !== id);
      save(); closeOverlay(); renderPeople(); return;
    case "toggle-meal":
      state.meals[id] = state.meals[id] === today ? "" : today;
      save(); renderMeals(); return;
    case "set-water":
      state.water = { date: today, count: Number(count) };
      save(); renderWater(); return;
    case "set-mood":
      state.mood = { date: today, value: id };
      save(); renderMood();
      say("Thank you for telling me how you feel.");
      return;
    default:
      return;
  }
}

document.addEventListener("click", (event) => {
  const tabBtn = event.target.closest("[data-tab]");
  if (tabBtn) {
    showTab(tabBtn.dataset.tab);
    return;
  }
  const btn = event.target.closest("[data-action]");
  if (btn) onAction(btn.dataset.action, btn.dataset.id, btn.dataset.count);
});

["optLarge", "optContrast", "optNight", "optVoice"].forEach((id) => {
  document.getElementById(id).addEventListener("change", (event) => {
    const map = {
      optLarge: "largeText",
      optContrast: "highContrast",
      optNight: "nightMode",
      optVoice: "voice"
    };
    state.settings[map[id]] = event.target.checked;
    save();
    applySettings();
  });
});

if (window.Notification && Notification.permission === "default") {
  Notification.requestPermission();
}

renderAll();
setInterval(updateClock, 1000);
setInterval(checkReminders, 15000);
setInterval(renderNextUp, 60000);
