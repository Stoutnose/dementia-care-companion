"use strict";

/*
 * Care Companion
 * A calm companion for anyone who needs extra care and attention: older adults,
 * memory loss, chronic illness, disability, recovery after surgery or stroke, and more.
 * Everything is stored on this device only (localStorage, plus IndexedDB for memory
 * book photos and voice notes). Nothing is sent anywhere
 * unless the person taps Call, Text, Share or Send my location.
 */

const KEY = "dcc-state-v2"; // same key as earlier versions, so existing data is kept
const DAY_MS = 24 * 60 * 60 * 1000;
const CARER_MINUTES = 20;
const LOG_LIMIT = 1500;
const VITAL_LIMIT = 800;
const DUE_WINDOW = 10; // minutes after a reminder time in which it can still fire
const CHECKIN_GRACE = 5; // minutes before an unanswered check-in sounds the alarm
const VOICE_MAX_SECONDS = 180; // longest voice note for the memory book
const MEMORY_GAP = 5000; // pause between memories when playing them all

/* ---------------- care focus ---------------- */

const FOCUS = [
  { id: "memory", label: "🧠 Memory loss or dementia", card: "I have memory problems. Please be patient with me." },
  { id: "falls", label: "🦯 Falls, frailty or limited mobility", card: "I am unsteady on my feet. Please help me sit down safely." },
  { id: "heart", label: "❤️ Heart or blood pressure", card: "I have a heart condition.", vitals: ["bp", "pulse", "weight"], help: ["heart"] },
  { id: "diabetes", label: "🩸 Diabetes", card: "I have diabetes. If I seem confused, sweaty or shaky, my blood sugar may be low and I may need something sugary.", vitals: ["sugar"], help: ["lowsugar"] },
  { id: "breathing", label: "🫁 Breathing or lung problems (COPD, asthma)", card: "I have a lung condition and can get very breathless.", vitals: ["spo2", "pulse"], help: ["breathless"] },
  { id: "stroke", label: "🧩 After a stroke", card: "I have had a stroke. I may find it hard to speak or move. Please be patient.", vitals: ["bp"], help: ["stroke"] },
  { id: "seizure", label: "⚡ Epilepsy or seizures", card: "I have epilepsy. If I have a seizure, time it, keep me safe, and call an ambulance if it lasts more than 5 minutes.", help: ["seizure"] },
  { id: "parkinson", label: "🤲 Parkinson’s or tremor", card: "I have Parkinson’s. My medicines must be taken on time." },
  { id: "kidney", label: "🫘 Kidney problems", card: "I have kidney problems. Please check with a doctor before giving me any medicine.", vitals: ["bp", "weight"] },
  { id: "surgery", label: "🩹 Recovering from surgery or illness", card: "I am recovering from surgery or a recent illness.", vitals: ["temp", "pulse"], help: ["wound"] },
  { id: "mental", label: "🌧️ Anxiety, depression or other mental health needs", card: "I can get very anxious. Please speak calmly and give me space.", help: ["overwhelmed"] },
  { id: "vision", label: "👓 Low vision", card: "I have low vision. Please tell me who you are and what you are doing." },
  { id: "hearing", label: "🦻 Hard of hearing", card: "I am hard of hearing. Please face me and speak clearly, or write it down.", help: ["talk"] },
  { id: "speech", label: "💬 Trouble speaking or understanding (aphasia, autism, learning disability)", card: "I find it hard to talk or to understand. Please use short sentences and give me time.", help: ["talk"] }
];

const FOCUS_HELP = {
  heart: { label: "❤️ Chest pain or racing heart", action: "heart" },
  lowsugar: { label: "🍬 Shaky or low sugar", action: "lowsugar" },
  breathless: { label: "🫁 Hard to breathe", action: "breathless" },
  stroke: { label: "🧩 Stroke signs check", action: "stroke" },
  seizure: { label: "⏱️ Seizure timer", action: "seizure" },
  wound: { label: "🩹 Wound or fever worry", action: "wound" },
  overwhelmed: { label: "🌧️ I feel overwhelmed", action: "overwhelmed" },
  talk: { label: "🗣️ Talk for me", action: "go-talk" }
};

/* ---------------- health readings ---------------- */

// Values are stored in mg/dL (sugar) and °C (temperature). Display units can change.
const VITALS = {
  bp: { label: "Blood pressure", icon: "🩺", two: true, unit: "mmHg", fields: ["Top number (systolic)", "Bottom number (diastolic)"], range: { lo: 90, hi: 140, lo2: 60, hi2: 90 }, urgentHi: 180, urgentHi2: 120, urgentLo: 80 },
  sugar: { label: "Blood sugar", icon: "🩸", range: { lo: 70, hi: 180 }, urgentLo: 54, urgentHi: 300 },
  pulse: { label: "Pulse", icon: "💓", unit: "beats a minute", range: { lo: 50, hi: 100 }, urgentLo: 40, urgentHi: 130 },
  spo2: { label: "Oxygen level", icon: "🫁", unit: "%", range: { lo: 94, hi: 100 }, urgentLo: 88 },
  temp: { label: "Temperature", icon: "🌡️", range: { lo: 35.5, hi: 37.8 }, urgentLo: 35, urgentHi: 39.5 },
  weight: { label: "Weight", icon: "⚖️", unit: "kg", range: null }
};
const VITAL_ORDER = ["bp", "sugar", "pulse", "spo2", "temp", "weight"];

const SYMPTOMS = [
  { id: "dizzy", label: "😵 Dizzy" },
  { id: "breath", label: "🫁 Short of breath", serious: true },
  { id: "palpitations", label: "💓 Heart racing", serious: true },
  { id: "nausea", label: "🤢 Feel sick" },
  { id: "headache", label: "🤕 Headache" },
  { id: "cough", label: "😷 Cough" },
  { id: "fever", label: "🌡️ Hot or shivery" },
  { id: "swelling", label: "🦶 Swollen ankles" },
  { id: "tired", label: "🥱 Very tired" },
  { id: "appetite", label: "🍽️ Not hungry" },
  { id: "constipation", label: "🚽 Constipated" },
  { id: "diarrhoea", label: "💧 Loose stools" },
  { id: "skin", label: "🩹 Sore skin or wound" },
  { id: "tremor", label: "🤲 Shaky" },
  { id: "vision", label: "👁️ Blurry eyes" },
  { id: "anxious", label: "😟 Anxious" },
  { id: "bladder", label: "🚻 Urine problem" }
];
const SEVERITY = [
  { id: "mild", label: "A little" },
  { id: "moderate", label: "Quite bad" },
  { id: "severe", label: "Very bad" }
];

const SLEEP = [
  { id: "good", label: "😴 Slept well" },
  { id: "ok", label: "🙂 Okay" },
  { id: "poor", label: "😩 Badly" }
];

/* ---------------- talking board ---------------- */

const PHRASES = [
  { group: "I need", items: [
    ["🥤", "I am thirsty. Could I have a drink?"],
    ["🍽️", "I am hungry."],
    ["🚻", "I need the toilet."],
    ["🤕", "I am in pain."],
    ["🛏️", "I want to lie down."],
    ["🔄", "Please help me move or change position."],
    ["🥶", "I am cold."],
    ["🥵", "I am too hot."],
    ["💊", "Is it time for my medicine?"],
    ["👓", "I need my glasses."],
    ["🔕", "It is too noisy for me."],
    ["🙏", "Please help me."]
  ] },
  { group: "I feel", items: [
    ["😊", "I feel happy."],
    ["😢", "I feel sad."],
    ["😟", "I feel worried."],
    ["😠", "I feel frustrated."],
    ["😴", "I feel tired."],
    ["🤢", "I feel sick."]
  ] },
  { group: "Talking", items: [
    ["🔁", "Please say that again, slowly."],
    ["✍️", "Please write it down."],
    ["⏳", "Give me a moment to answer."],
    ["🙂", "Thank you."],
    ["📞", "Please call my family."],
    ["🚪", "I would like some time alone."]
  ] }
];

/* ---------------- moods, pain ---------------- */

const MOODS = [
  { id: "great", label: "😊 Great" },
  { id: "ok", label: "🙂 OK" },
  { id: "tired", label: "😴 Tired" },
  { id: "sad", label: "😢 Sad" },
  { id: "worried", label: "😟 Worried" },
  { id: "upset", label: "😠 Upset" }
];
const LOW_MOODS = ["sad", "worried", "upset"];

const PAIN_AREAS = [
  { id: "head", label: "🤕 Head" },
  { id: "mouth", label: "🦷 Mouth or teeth" },
  { id: "chest", label: "❤️ Chest", urgent: true },
  { id: "stomach", label: "🤢 Tummy" },
  { id: "back", label: "🧍 Back" },
  { id: "arm", label: "✋ Arm or hand" },
  { id: "leg", label: "🦶 Leg or foot" },
  { id: "toilet", label: "🚻 Toilet or bladder" },
  { id: "skin", label: "🩹 Skin or wound" },
  { id: "all", label: "😣 All over" }
];
const PAIN_LEVELS = [
  { n: 2, label: "🙂 A little" },
  { n: 5, label: "😐 Medium" },
  { n: 8, label: "😣 A lot" },
  { n: 10, label: "😭 The worst" }
];

/* ---------------- checklists ---------------- */

const SAFETY_CHECKS = [
  { id: "idcard", text: "Wears an ID bracelet or carries a card with name, conditions and helper phone" },
  { id: "meds", text: "Medicines are kept in a locked box or dispenser, so doses can’t be doubled or missed" },
  { id: "falls", text: "Loose rugs removed, night lights on, grab bars in the bathroom" },
  { id: "water", text: "Hot water set low enough that it can’t scald" },
  { id: "smoke", text: "Smoke alarm works, and there is a clear way out of the home" },
  { id: "phone", text: "The phone is charged and easy to reach, day and night" },
  { id: "stove", text: "Stove has an automatic shut-off, or the knobs come off when no one is watching", focus: ["memory"] },
  { id: "doors", text: "Outside doors have a chime or alarm, so you know if someone goes out", focus: ["memory"] },
  { id: "danger", text: "Sharp tools, cleaning chemicals and car keys are locked away", focus: ["memory", "mental"] },
  { id: "driving", text: "Driving safety has been discussed with the doctor", focus: ["memory", "seizure", "vision", "stroke", "parkinson"] },
  { id: "money", text: "Bank alerts or limits are set up to protect against scams", focus: ["memory"] },
  { id: "photo", text: "A recent photo is saved in “Me”, in case they ever go missing", focus: ["memory"] },
  { id: "shower", text: "A shower chair and raised toilet seat are in place", focus: ["falls", "parkinson", "stroke"] },
  { id: "aid", text: "Walking aid is within reach and in good repair", focus: ["falls", "parkinson", "stroke"] },
  { id: "floorcall", text: "There is a way to call for help from the floor: phone in a pocket or an alarm pendant", focus: ["falls", "parkinson", "seizure"] },
  { id: "pressure", text: "If in bed or a chair most of the day: position changed often, and heels, hips and lower back checked for red marks", focus: ["falls", "stroke", "surgery"] },
  { id: "hypo", text: "Fast sugar (juice or glucose tablets) is kept by the bed and in the bag", focus: ["diabetes"] },
  { id: "feet", text: "Feet are checked every day for cuts, blisters or sores", focus: ["diabetes"] },
  { id: "inhaler", text: "Inhalers and spacer are in date and easy to reach", focus: ["breathing"] },
  { id: "oxygen", text: "No smoking or open flames anywhere near home oxygen", focus: ["breathing"] },
  { id: "weigh", text: "Weighed at the same time each morning, if the doctor asked", focus: ["heart", "kidney"] },
  { id: "gtn", text: "Everyone knows where the chest pain spray or tablets are, if prescribed", focus: ["heart"] },
  { id: "strokesigns", text: "Everyone at home knows the stroke signs: face, arm, speech, time to call", focus: ["stroke", "heart"] },
  { id: "seizshower", text: "Showers rather than baths, and the bathroom door is left unlocked", focus: ["seizure"] },
  { id: "seizfirst", text: "Family and carers know seizure first aid", focus: ["seizure"] },
  { id: "medtime", text: "Medicine times are set as reminders in this app", focus: ["parkinson", "seizure", "diabetes"] },
  { id: "fluids", text: "Any fluid or diet limits from the doctor are written down", focus: ["kidney", "heart"] },
  { id: "light", text: "Good lighting, and bright tape on step edges", focus: ["vision"] },
  { id: "places", text: "Things are always kept in the same place", focus: ["vision", "memory"] },
  { id: "flash", text: "Doorbell and smoke alarm flash or vibrate as well as ring", focus: ["hearing"] },
  { id: "crisisplan", text: "A crisis plan is written down and shared with family", focus: ["mental"] },
  { id: "wound", text: "Wound care instructions are written down", focus: ["surgery"] },
  { id: "clots", text: "Everyone knows the warning signs of infection and blood clots after surgery", focus: ["surgery"] },
  { id: "board", text: "The Talk tab or a picture board is always within reach", focus: ["speech", "stroke", "hearing"] }
];

const PLAN_CHECKS = [
  { id: "diagnosis", text: "We understand the main diagnosis and what to expect over time" },
  { id: "records", text: "Medical reports, scans and discharge papers are kept together in one folder" },
  { id: "poa", text: "Someone is legally able to help with money and paperwork if needed" },
  { id: "health", text: "A healthcare decision-maker is named" },
  { id: "will", text: "The will is up to date" },
  { id: "wishes", text: "Wishes about hospital care, resuscitation and end of life are written down" },
  { id: "insurance", text: "Health insurance and any government health schemes or benefits have been checked" },
  { id: "future", text: "We have talked about future care: home help, therapy, day care or a care home" }
];

/* ---------------- event log ---------------- */

const LOG_LABELS = {
  confused: "🧘 Felt confused",
  lost: "🧭 Felt lost",
  pain: "🤕 Reported pain",
  fall: "⚠️ Had a fall",
  unwell: "🤒 Felt unwell",
  sos: "🚨 Called helper",
  call: "📞 Called someone",
  text: "💬 Texted helper",
  location: "📍 Sent location",
  emergency: "🚑 Called emergency number",
  checkin: "✅ Said “I am okay”",
  missed: "⏰ Missed a check-in",
  alarm: "📢 Sounded the alarm",
  mood: "🙂 Mood",
  med: "💊 Took medicine",
  prn: "💊 Took as-needed medicine",
  activity: "🎨 Did an activity",
  question: "❓ Asked a question",
  symptom: "🩺 Symptom",
  vital: "📈 Health reading",
  sleep: "😴 Sleep",
  bowel: "🚽 Bowels opened",
  exercise: "🏃 Did an exercise",
  seizure: "⚡ Seizure",
  lowsugar: "🍬 Low sugar steps",
  breathless: "🫁 Breathless",
  heart: "❤️ Chest pain or racing heart",
  stroke: "🧩 Stroke signs check",
  overwhelmed: "🌧️ Felt overwhelmed",
  talk: "🗣️ Said with Talk",
  memory: "📖 Looked at a memory"
};
const DISTRESS = ["confused", "lost", "pain", "fall", "sos", "emergency", "unwell", "breathless", "heart", "seizure", "overwhelmed"];

// Rough hour by which a medicine should usually have been taken
const MED_DUE_HOUR = { Morning: 11, Afternoon: 16, Evening: 21, Night: 23 };

const DEFAULT_ACTIVITIES = [
  "Look at family photos together",
  "Listen to a favourite old song",
  "Fold the towels",
  "Water the plants",
  "Have a cup of tea and a biscuit",
  "Go for a short walk with someone"
];

const defaultState = () => ({
  setupDone: false,
  focus: [],
  profile: {
    name: "", photo: "", address: "", diagnosis: "", allergies: "", avoid: "", doctor: "", story: "",
    dob: "", blood: "", devices: "", language: "", howTo: "", wishes: ""
  },
  helper: { name: "", phone: "", backupName: "", backupPhone: "", emergency: "112", crisisName: "", crisisPhone: "" },
  note: { text: "", author: "" },
  people: [],
  memories: [], // { id, title, year, caption, by, photo: bool, voice: bool, at } – media lives in IndexedDB
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
  medsDone: {}, // { medId: { date: "YYYY-MM-DD", at: ISO string } }
  prnDoses: {}, // { medId: [ISO, ...] }
  meals: { breakfast: "", lunch: "", dinner: "" },
  water: { date: "", count: 0 },
  mood: { date: "", value: "" },
  sleep: { date: "", quality: "", hours: "" },
  vitals: [], // { t, type, v, v2, note }
  exercises: [],
  exercisesDone: {},
  appointments: [],
  timers: [], // one-off timers { id, at, text }
  phrases: [],
  checkTimes: [],
  pendingCheck: null, // { at, key, escalated }
  journal: [],
  checkIn: "",
  qa: [],
  activities: DEFAULT_ACTIVITIES.map((text, i) => ({ id: "a" + i, text })),
  checks: {},
  log: [],
  fired: {},
  lastDay: "",
  pin: "",
  units: { sugar: "mgdl", temp: "C" },
  ranges: {},
  settings: {
    textSize: "normal",
    highContrast: false,
    nightMode: false,
    autoEvening: true,
    voice: true,
    vibrate: true,
    rate: 0.85,
    voiceName: "",
    waterGoal: 8
  }
});

let state = loadState();
let breathTimer = null;
let seizureTimer = null;
let carerUntil = 0;
let lastActivityId = "";
let audioCtx = null;
let alarmNodes = null;
let alarmStopTimer = null;
let recognizer = null;
let groundStep = 0;
let memoryIndex = 0;
let memoryAuto = false;
let memoryTimer = null;
let memoryAudio = null;
let recorder = null;
let recordStream = null;
let recordTimer = null;
let pendingVoice = null; // Blob of a voice note waiting to be saved
const mediaUrls = {}; // IndexedDB key -> object URL, kept while the page is open

/* ---------------- storage ---------------- */

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function merge(base, extra) {
  const out = { ...base };
  Object.keys(extra || {}).forEach((k) => {
    if (isPlainObject(base[k]) && isPlainObject(extra[k])) out[k] = { ...base[k], ...extra[k] };
    else if (extra[k] !== undefined && extra[k] !== null) out[k] = extra[k];
  });
  return out;
}

function migrate(s) {
  // Old versions saved medsDone[id] = "YYYY-MM-DD". Now it is { date, at }.
  Object.keys(s.medsDone || {}).forEach((id) => {
    const v = s.medsDone[id];
    if (typeof v === "string") s.medsDone[id] = v ? { date: v, at: "" } : null;
  });
  ["log", "qa", "activities", "vitals", "exercises", "appointments", "timers", "phrases", "checkTimes", "journal", "focus", "people", "memories", "reminders", "schedule", "meds"]
    .forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
  ["prnDoses", "exercisesDone", "fired", "checks", "scheduleDone", "medsDone", "ranges"]
    .forEach((k) => { if (!isPlainObject(s[k])) s[k] = {}; });
  if (!s.helper.emergency) s.helper.emergency = "112";
  // Old "larger text" switch becomes the text size setting
  if (s.settings.largeText && (!s.settings.textSize || s.settings.textSize === "normal")) s.settings.textSize = "large";
  delete s.settings.largeText;
  // Anyone who already used the earlier version has done setup
  if (!s.setupDone && (s.profile.name || s.helper.phone || s.log.length)) s.setupDone = true;
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return migrate(merge(defaultState(), JSON.parse(raw)));
  } catch {
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    openOverlay({
      title: "The phone’s storage for this app is full",
      body: "Remove some people or photos, or clear old history in Care, then try again. A backup file can keep a copy safe.",
      actions: btn("btn-main", "close-overlay", "Close")
    });
    return false;
  }
}

/* ---------------- small helpers ---------------- */

const $ = (id) => document.getElementById(id);

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// Local date, not UTC. (toISOString would switch days at 5:30am in India.)
function localDate(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function todayStr() {
  return localDate(new Date());
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
}

function dayOf(iso) {
  return localDate(new Date(iso));
}

function nowHM() {
  const d = new Date();
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function prettyTime(hm) {
  const [h, m] = String(hm).split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function clockOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function prettyDate(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  if (ymd === todayStr()) return "Today";
  if (ymd === dateOffset(1)) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function shortDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + " " + clockOf(iso);
}

function minutesSince(hm) {
  const [h, m] = String(hm).split(":").map(Number);
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() - (h * 60 + m);
}

function isDue(hm) {
  if (!hm) return false;
  const m = minutesSince(hm);
  return m >= 0 && m < DUE_WINDOW;
}

function addMinutesHM(hm, add) {
  const [h, m] = String(hm).split(":").map(Number);
  const total = ((h * 60 + m + add) % 1440 + 1440) % 1440;
  return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function btn(cls, action, label, extra = "") {
  return `<button class="btn ${cls}" type="button" data-action="${action}" ${extra}>${label}</button>`;
}

function closeBtn(label = "Close") {
  return btn("btn-main", "close-overlay", label);
}

function cleanPhone(p) {
  return String(p || "").replace(/[^\d+]/g, "");
}

function phoneHref(kind, body, phone) {
  const num = cleanPhone(phone || state.helper.phone);
  if (!num) return "";
  if (kind === "sms") return "sms:" + num + "?body=" + encodeURIComponent(body || "I need a little help. Please call me.");
  return "tel:" + num;
}

function vibrate(pattern) {
  if (state.settings.vibrate !== false && navigator.vibrate) navigator.vibrate(pattern);
}

function pickVoice() {
  if (!window.speechSynthesis || !state.settings.voiceName) return null;
  return speechSynthesis.getVoices().find((v) => v.name === state.settings.voiceName) || null;
}

function say(text, force = false) {
  if ((!state.settings.voice && !force) || !text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = Number(state.settings.rate) || 0.85;
  u.pitch = 1;
  const v = pickVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  }
  window.speechSynthesis.speak(u);
}

function logEvent(type, detail = "") {
  state.log.push({ t: new Date().toISOString(), type, detail });
  if (state.log.length > LOG_LIMIT) state.log = state.log.slice(-LOG_LIMIT);
  save();
}

function partOfDay(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function isCalmHours() {
  const h = new Date().getHours();
  return h >= 17 || h < 7;
}

function helperName() {
  return state.helper.name || "your helper";
}

function hasFocus(id) {
  return state.focus.includes(id);
}

function emergencyLabel() {
  return "🚑 Call " + escapeHtml(state.helper.emergency || "emergency");
}

function ageOf(dob) {
  if (!dob) return "";
  const b = new Date(dob);
  if (isNaN(b)) return "";
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return a >= 0 && a < 130 ? String(a) : "";
}

/* ---------------- units & ranges ---------------- */

function rangeOf(type) {
  const base = VITALS[type].range;
  if (!base) return null;
  return { ...base, ...(state.ranges[type] || {}) };
}

function sugarUnit() {
  return state.units.sugar === "mmol" ? "mmol/L" : "mg/dL";
}

function tempUnit() {
  return state.units.temp === "F" ? "°F" : "°C";
}

// Convert a stored value to what the person sees
function toDisplay(type, v) {
  if (v === "" || v === null || v === undefined || isNaN(v)) return "";
  if (type === "sugar" && state.units.sugar === "mmol") return Math.round((v / 18) * 10) / 10;
  if (type === "temp" && state.units.temp === "F") return Math.round((v * 9 / 5 + 32) * 10) / 10;
  if (type === "temp" || type === "weight") return Math.round(v * 10) / 10;
  return Math.round(v);
}

// Convert what the person typed back to the stored unit
function fromDisplay(type, v) {
  const n = Number(v);
  if (type === "sugar" && state.units.sugar === "mmol") return n * 18;
  if (type === "temp" && state.units.temp === "F") return (n - 32) * 5 / 9;
  return n;
}

function unitOf(type) {
  if (type === "sugar") return sugarUnit();
  if (type === "temp") return tempUnit();
  return VITALS[type].unit || "";
}

function formatVital(r) {
  if (r.type === "bp") return Math.round(r.v) + "/" + Math.round(r.v2) + " " + unitOf("bp");
  return toDisplay(r.type, r.v) + " " + unitOf(r.type);
}

// "urgent" | "high" | "low" | "ok"
function vitalStatus(r) {
  const def = VITALS[r.type];
  const rg = rangeOf(r.type);
  if (!def || !rg) return "ok";
  if (r.type === "bp") {
    if (r.v >= def.urgentHi || r.v2 >= def.urgentHi2 || r.v < def.urgentLo) return "urgent";
    if (r.v > rg.hi || r.v2 > rg.hi2) return "high";
    if (r.v < rg.lo || r.v2 < rg.lo2) return "low";
    return "ok";
  }
  if ((def.urgentLo !== undefined && r.v < def.urgentLo) || (def.urgentHi !== undefined && r.v >= def.urgentHi)) return "urgent";
  if (r.v > rg.hi) return "high";
  if (r.v < rg.lo) return "low";
  return "ok";
}

const STATUS_TEXT = { urgent: "Needs attention now", high: "Higher than usual", low: "Lower than usual", ok: "In the usual range" };

/* ---------------- caregiver lock ---------------- */

function isCarer() {
  return !state.pin || Date.now() < carerUntil;
}

function applyCarerMode() {
  document.documentElement.classList.toggle("carer", isCarer());
  const text = $("lockText");
  if (!text) return;
  if (!state.pin) {
    text.textContent = "Caregiver tools are open. Set a PIN below so settings can’t be changed or deleted by accident.";
  } else if (isCarer()) {
    text.textContent = "Unlocked. Locks again automatically after " + CARER_MINUTES + " minutes without use.";
  } else {
    text.textContent = "These tools are for family and carers.";
  }
}

function askPin() {
  openOverlay({
    title: "Caregiver tools",
    body: "Enter the caregiver PIN.",
    actions:
      `<input id="pinInput" class="input pin-input" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN">` +
      btn("btn-main", "pin-submit", "Unlock") +
      btn("btn-soft", "close-overlay", "Cancel")
  });
  setTimeout(() => $("pinInput") && $("pinInput").focus(), 50);
}

function pinSubmit() {
  const input = $("pinInput");
  if (!input) return;
  if (input.value === state.pin) {
    carerUntil = Date.now() + CARER_MINUTES * 60000;
    closeOverlay();
    applyCarerMode();
  } else {
    $("overlayBody").textContent = "That PIN is not right. Try again.";
    input.value = "";
    input.focus();
  }
}

function savePin() {
  const v = $("newPin").value.trim();
  if (v && !/^\d{4,8}$/.test(v)) {
    openOverlay({ title: "PIN not saved", body: "Use 4 to 8 digits.", actions: closeBtn() });
    return;
  }
  state.pin = v;
  $("newPin").value = "";
  carerUntil = v ? Date.now() + CARER_MINUTES * 60000 : 0;
  save();
  applyCarerMode();
  openOverlay({
    title: v ? "PIN saved" : "Lock turned off",
    body: v ? "Remember this PIN. Tap “Lock now” when you hand the phone back." : "Caregiver tools are open to everyone.",
    actions: closeBtn()
  });
}

function lockNow() {
  if (!state.pin) {
    openOverlay({ title: "No PIN set", body: "Set a PIN first, then the tools can be locked.", actions: closeBtn() });
    return;
  }
  carerUntil = 0;
  applyCarerMode();
  showTab("home");
}

/* ---------------- settings & tabs ---------------- */

function applySettings() {
  const s = state.settings;
  const root = document.documentElement;
  root.classList.toggle("large", s.textSize === "large");
  root.classList.toggle("xlarge", s.textSize === "xlarge");
  root.classList.toggle("contrast", !!s.highContrast);
  root.classList.toggle("night", !!s.nightMode || (!!s.autoEvening && isCalmHours() && !s.highContrast));
  $("optSize").value = s.textSize || "normal";
  $("optContrast").checked = !!s.highContrast;
  $("optNight").checked = !!s.nightMode;
  $("optEvening").checked = !!s.autoEvening;
  $("optVoice").checked = s.voice !== false;
  $("optVibrate").checked = s.vibrate !== false;
  $("optRate").value = String(s.rate || 0.85);
  $("optWater").value = String(s.waterGoal || 8);
  $("unitSugar").value = state.units.sugar || "mgdl";
  $("unitTemp").value = state.units.temp || "C";
}

function fillVoices() {
  if (!window.speechSynthesis) return;
  const sel = $("optVoiceName");
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  const lang = (navigator.language || "en").slice(0, 2);
  const sorted = voices.slice().sort((a, b) => {
    const pa = a.lang.startsWith(lang) ? 0 : a.lang.startsWith("en") ? 1 : 2;
    const pb = b.lang.startsWith(lang) ? 0 : b.lang.startsWith("en") ? 1 : 2;
    return pa - pb || a.name.localeCompare(b.name);
  });
  sel.innerHTML = '<option value="">Phone’s default voice</option>' +
    sorted.map((v) => `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join("");
  sel.value = state.settings.voiceName || "";
}

function showTab(name) {
  document.querySelectorAll(".tab").forEach((el) => {
    el.classList.toggle("is-active", el.id === "tab-" + name);
  });
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.tab === name);
    if (b.dataset.tab === name) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------- daily reset ---------------- */

function resetDaily() {
  const today = todayStr();
  if (state.lastDay === today) return false;
  state.lastDay = today;
  if (state.water.date !== today) state.water = { date: today, count: 0 };
  if (state.mood.date !== today) state.mood = { date: today, value: "" };
  ["breakfast", "lunch", "dinner"].forEach((meal) => {
    if (state.meals[meal] && state.meals[meal] !== today) state.meals[meal] = "";
  });
  // Forget fired markers from earlier days, and appointments more than a week old
  Object.keys(state.fired).forEach((k) => {
    if (state.fired[k] !== today && state.fired[k] !== "done") delete state.fired[k];
  });
  const weekAgo = dateOffset(-7);
  state.appointments = state.appointments.filter((a) => a.date >= weekAgo);
  Object.keys(state.fired).forEach((k) => {
    if (/^ap[12]:/.test(k) && !state.appointments.some((a) => k.endsWith(":" + a.id))) delete state.fired[k];
  });
  if (state.pendingCheck && dayOf(state.pendingCheck.at) !== today) state.pendingCheck = null;
  save();
  return true;
}

/* ---------------- home ---------------- */

function updateClock() {
  const now = new Date();
  const pod = partOfDay(now);
  $("clock").textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  $("dayText").textContent = "Today is " + now.toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  $("greeting").textContent = pod === "night" ? "It is night time" : "Good " + pod;
  const name = state.profile.name;
  $("helloName").textContent = name ? "Hello, " + name : "Hello 👋";
  $("placeText").textContent = state.profile.address ? "Your home is " + state.profile.address : "You are safe";

  const hint = $("timeHint");
  let hintText = "";
  if (pod === "night") hintText = "🌙 It is dark outside. It is time to rest. Everyone is safe.";
  else if (pod === "evening") hintText = "🌆 The day is winding down. A quiet, calm evening.";
  hint.textContent = hintText;
  hint.classList.toggle("hidden", !hintText);
}

function renderNote() {
  const card = $("noteCard");
  if (!state.note.text) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  $("noteText").textContent = state.note.text;
  $("noteAuthor").textContent = state.note.author ? "From " + state.note.author : "";
}

function scheduledMeds() {
  return state.meds.filter((m) => m.when !== "As needed");
}

function todaysItems() {
  const today = todayStr();
  const sched = state.schedule
    .filter((item) => state.scheduleDone[item.id] !== today)
    .map((item) => ({ time: item.time, text: item.text, kind: "routine" }));
  const rems = state.reminders.map((item) => ({ time: item.time, text: item.text, kind: "reminder" }));
  const meds = scheduledMeds()
    .filter((m) => m.time && !medRecord(m.id))
    .map((m) => ({ time: m.time, text: "💊 " + m.name + (m.dose ? " (" + m.dose + ")" : ""), kind: "med" }));
  const appts = state.appointments
    .filter((a) => a.date === today && a.time)
    .map((a) => ({ time: a.time, text: "🏥 " + a.title + (a.place ? ", " + a.place : ""), kind: "appt" }));
  return sched.concat(rems, meds, appts).sort((a, b) => a.time.localeCompare(b.time));
}

function remainingItems() {
  const now = nowHM();
  return todaysItems().filter((item) => item.time >= now);
}

function renderNextUp() {
  const el = $("nextUp");
  const now = nowHM();
  // A routine item or medicine from the last 90 minutes that is not done yet
  const overdue = todaysItems().filter((i) => (i.kind === "routine" || i.kind === "med") && i.time < now && minutesSince(i.time) <= 90);
  const next = remainingItems()[0];
  const parts = [];
  overdue.slice(0, 2).forEach((o) => {
    parts.push(`<div class="overdue">Not done yet: ${escapeHtml(prettyTime(o.time))} · ${escapeHtml(o.text)}</div>`);
  });
  if (next) parts.push(`<div>${escapeHtml(prettyTime(next.time))} · ${escapeHtml(next.text)}</div>`);
  const tomorrow = state.appointments.filter((a) => a.date === dateOffset(1));
  if (tomorrow.length && new Date().getHours() >= 12) {
    parts.push(`<div class="next-later">Tomorrow: ${escapeHtml(tomorrow.map((a) => (a.time ? prettyTime(a.time) + " " : "") + a.title).join(", "))}</div>`);
  }
  if (!parts.length) parts.push("<div>Nothing more on today’s list. You can rest.</div>");
  el.innerHTML = parts.join("");

  // Small progress strip
  const meds = scheduledMeds();
  const taken = meds.filter((m) => medRecord(m.id)).length;
  const goal = Number(state.settings.waterGoal) || 8;
  const meals = ["breakfast", "lunch", "dinner"].filter((m) => state.meals[m] === todayStr()).length;
  const cells = [];
  if (meds.length) cells.push(["💊", taken + " of " + meds.length, "medicines"]);
  cells.push(["💧", (state.water.count || 0) + " of " + goal, "glasses"]);
  cells.push(["🍽️", meals + " of 3", "meals"]);
  $("dayProgress").innerHTML = cells.map(([i, n, l]) =>
    `<button class="prog" type="button" data-tab="today"><span class="prog-icon">${i}</span><strong>${escapeHtml(n)}</strong><span>${l}</span></button>`
  ).join("");
}

function renderFocusHelp() {
  const ids = [];
  state.focus.forEach((f) => {
    const def = FOCUS.find((x) => x.id === f);
    (def && def.help || []).forEach((h) => { if (!ids.includes(h)) ids.push(h); });
  });
  $("focusHelp").innerHTML = ids.map((id) => {
    const h = FOCUS_HELP[id];
    return `<button class="btn btn-soft" type="button" data-action="${h.action}">${h.label}</button>`;
  }).join("");
  $("focusHelp").classList.toggle("hidden", !ids.length);
}

function renderQA() {
  $("qaCard").classList.toggle("hidden", !state.qa.length);
  $("qaList").innerHTML = state.qa.map((item) =>
    `<button class="btn btn-soft qa-btn" type="button" data-action="ask-qa" data-id="${item.id}">❓ ${escapeHtml(item.q)}</button>`
  ).join("");
  $("todoBtn").classList.toggle("hidden", !state.activities.length);
}

/* ---------------- today ---------------- */

function renderSchedule() {
  const today = todayStr();
  const list = $("scheduleList");
  if (!state.schedule.length) {
    list.innerHTML = '<p class="empty">No routine items yet.</p>';
    return;
  }
  list.innerHTML = state.schedule
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((item) => {
      const done = state.scheduleDone[item.id] === today;
      const main = done
        ? `<button class="btn btn-tiny carer-only" type="button" data-action="toggle-sched" data-id="${item.id}">Undo</button>`
        : `<button class="btn btn-tiny btn-done" type="button" data-action="toggle-sched" data-id="${item.id}">Done</button>`;
      return `<div class="row-item ${done ? "is-done" : ""}">
        <div class="item-main">
          <span class="item-time">${escapeHtml(prettyTime(item.time))}</span>
          ${escapeHtml(item.text)}
        </div>
        ${main}
        <button class="btn btn-tiny carer-only" type="button" data-action="del-sched" data-id="${item.id}">Remove</button>
      </div>`;
    })
    .join("");
}

function medRecord(id) {
  const rec = state.medsDone[id];
  return rec && rec.date === todayStr() ? rec : null;
}

function prnToday(id) {
  const today = todayStr();
  return (state.prnDoses[id] || []).filter((t) => dayOf(t) === today);
}

function lastPrn(id) {
  const list = state.prnDoses[id] || [];
  return list.length ? list[list.length - 1] : "";
}

function renderMeds() {
  const list = $("medList");
  if (!state.meds.length) {
    list.innerHTML = '<p class="empty">No medicines added.</p>';
    return;
  }
  const order = { Morning: 0, Afternoon: 1, Evening: 2, Night: 3, "As needed": 4 };
  list.innerHTML = state.meds.slice().sort((a, b) =>
    (order[a.when] ?? 5) - (order[b.when] ?? 5) || String(a.time || "").localeCompare(String(b.time || ""))
  ).map((med) => {
    const prn = med.when === "As needed";
    const details = [med.dose, med.instr].filter(Boolean).map(escapeHtml).join(". ");
    const stock = typeof med.stock === "number"
      ? `<div class="med-status ${med.stock <= 7 ? "warn" : ""}">${med.stock <= 7 ? "⚠️ Only " : ""}${med.stock} left${med.stock <= 7 ? ". Order more soon." : ""}</div>`
      : "";
    let status;
    let action;
    if (prn) {
      const doses = prnToday(med.id);
      const last = lastPrn(med.id);
      status = `<div class="med-status">${doses.length ? doses.length + (doses.length === 1 ? " dose" : " doses") + " today, last at " + escapeHtml(clockOf(last)) : "No doses today"}${med.gap ? ". Wait " + escapeHtml(med.gap) + " hours between doses" : ""}</div>`;
      action = `<button class="btn btn-tiny btn-done" type="button" data-action="take-prn" data-id="${med.id}">Took a dose</button>`;
    } else {
      const rec = medRecord(med.id);
      status = rec
        ? `<div class="med-status ok">✓ Taken${rec.at ? " at " + escapeHtml(clockOf(rec.at)) : " today"}</div>`
        : `<div class="med-status">Not taken yet today${med.time ? ". Due " + escapeHtml(prettyTime(med.time)) : ""}</div>`;
      action = rec
        ? `<button class="btn btn-tiny carer-only" type="button" data-action="undo-med" data-id="${med.id}">Undo</button>`
        : `<button class="btn btn-tiny btn-done" type="button" data-action="take-med" data-id="${med.id}">Taken</button>`;
    }
    const taken = !prn && medRecord(med.id);
    return `<div class="row-item med-item ${taken ? "is-taken" : ""}">
      <div class="item-main"><strong>${escapeHtml(med.when)}${med.time ? " · " + escapeHtml(prettyTime(med.time)) : ""}</strong>
        <div>${escapeHtml(med.name)}</div>
        ${details ? `<div class="med-status">${details}</div>` : ""}
        ${status}${stock}</div>
      ${action}
      <button class="btn btn-tiny carer-only" type="button" data-action="stock-med" data-id="${med.id}">Doses left</button>
      <button class="btn btn-tiny carer-only" type="button" data-action="del-med" data-id="${med.id}">Remove</button>
    </div>`;
  }).join("");
}

function useStock(med, delta) {
  if (typeof med.stock === "number") med.stock = Math.max(0, med.stock + delta);
}

function takeMed(id) {
  const med = state.meds.find((m) => m.id === id);
  if (!med) return;
  const rec = medRecord(id);
  if (rec) {
    // Guard against double dosing
    const when = rec.at ? clockOf(rec.at) : "earlier today";
    const text = "You already took your " + med.name + " today, at " + when + ". You do not need to take it again.";
    say(text);
    openOverlay({ title: "Already taken", body: text, actions: btn("btn-main", "close-overlay", "Okay") });
    return;
  }
  const at = new Date().toISOString();
  state.medsDone[id] = { date: todayStr(), at };
  useStock(med, -1);
  logEvent("med", med.name);
  renderMeds();
  renderNextUp();
  renderPatterns();
  closeOverlay();
  say("Well done. " + med.name + " is marked as taken at " + clockOf(at) + ".");
}

function takePrn(id, force = false) {
  const med = state.meds.find((m) => m.id === id);
  if (!med) return;
  const last = lastPrn(id);
  const gapH = Number(med.gap) || 0;
  const doses = prnToday(id);
  const max = Number(med.max) || 0;
  if (!force && last && gapH && Date.now() - new Date(last).getTime() < gapH * 3600000) {
    const nextAt = new Date(new Date(last).getTime() + gapH * 3600000);
    const text = "The last dose of " + med.name + " was at " + clockOf(last) + ". The next dose can be taken after " +
      nextAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ". If you still feel bad, tell " + helperName() + ".";
    say(text);
    openOverlay({
      title: "Too soon for another dose",
      body: text,
      actions: btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) +
        `<button class="btn btn-tiny carer-only" type="button" data-action="take-prn-force" data-id="${id}">Carer: record it anyway</button>` +
        btn("btn-main", "close-overlay", "Okay")
    });
    return;
  }
  if (!force && max && doses.length >= max) {
    const text = "You have already had " + doses.length + " doses of " + med.name + " today. That is the most for one day. Please ask " + helperName() + " or the doctor.";
    say(text);
    openOverlay({
      title: "Most doses for today reached",
      body: text,
      actions: btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) +
        `<button class="btn btn-tiny carer-only" type="button" data-action="take-prn-force" data-id="${id}">Carer: record it anyway</button>` +
        btn("btn-main", "close-overlay", "Okay")
    });
    return;
  }
  const at = new Date().toISOString();
  state.prnDoses[id] = (state.prnDoses[id] || []).concat(at).slice(-30);
  useStock(med, -1);
  logEvent("prn", med.name);
  closeOverlay();
  renderMeds();
  renderPatterns();
  say(med.name + " is recorded at " + clockOf(at) + ".");
}

function editStock(id) {
  const med = state.meds.find((m) => m.id === id);
  if (!med) return;
  openOverlay({
    title: "Pack for " + med.name,
    body: "How many doses are left? Leave empty to stop counting.",
    actions:
      `<input id="stockInput" class="input pin-input" type="number" min="0" max="9999" value="${typeof med.stock === "number" ? med.stock : ""}" aria-label="Doses left">` +
      btn("btn-main", "stock-save", "Save", `data-id="${id}"`) +
      btn("btn-soft", "close-overlay", "Cancel")
  });
}

function saveStock(id) {
  const med = state.meds.find((m) => m.id === id);
  const v = $("stockInput") ? $("stockInput").value.trim() : "";
  if (!med) return;
  if (v === "") delete med.stock;
  else med.stock = Math.max(0, Math.round(Number(v)) || 0);
  save();
  closeOverlay();
  renderMeds();
  renderPatterns();
}

function renderMeals() {
  const today = todayStr();
  const meals = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"]];
  $("mealRow").innerHTML = meals.map(([id, label]) => {
    const on = state.meals[id] === today;
    return `<button class="chip ${on ? "is-on" : ""}" type="button" data-action="toggle-meal" data-id="${id}" aria-pressed="${on}">${on ? "✓ " : ""}${label}</button>`;
  }).join("");
}

function renderWater() {
  const count = state.water.count || 0;
  const goal = Number(state.settings.waterGoal) || 8;
  $("waterRow").innerHTML = Array.from({ length: goal }, (_, i) => {
    const on = i < count;
    return `<button class="glass ${on ? "is-on" : ""}" type="button" data-action="set-water" data-count="${on && i + 1 === count ? i : i + 1}" aria-label="Glass ${i + 1} of ${goal}">${on ? "💧" : "○"}</button>`;
  }).join("");
  let text = count + " of " + goal + " glasses today";
  if (count < goal / 2 && new Date().getHours() >= 15) text += ". Time for a drink of water?";
  if (count >= goal) text += ". Well done!";
  $("waterText").textContent = text;
}

function renderMood() {
  $("moodRow").innerHTML = MOODS.map((mood) => {
    const on = state.mood.value === mood.id;
    return `<button class="mood-btn ${on ? "is-on" : ""}" type="button" data-action="set-mood" data-id="${mood.id}" aria-pressed="${on}">${mood.label}</button>`;
  }).join("");
  const found = MOODS.find((m) => m.id === state.mood.value);
  $("moodText").textContent = found ? "Today you feel " + found.label : "Tap how you feel.";
}

function setMood(id) {
  state.mood = { date: todayStr(), value: id };
  logEvent("mood", id);
  renderMood();
  renderPatterns();
  if (LOW_MOODS.includes(id)) {
    const text = "Thank you for telling me. It is okay to feel this way. Would you like to breathe together, or talk to " + helperName() + "?";
    say(text);
    openOverlay({
      title: "Thank you for telling me",
      body: text,
      actions:
        btn("btn-soft", "breathe", "🌬️ Breathe with me") +
        btn("btn-soft", "grounding", "🖐️ Notice 5 things") +
        btn("btn-soft", "something-to-do", "🎨 Something to do") +
        btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) +
        closeBtn()
    });
  } else {
    say("Thank you for telling me how you feel.");
  }
}

function renderReminders() {
  const box = $("reminders");
  if (!state.reminders.length) {
    box.innerHTML = '<p class="empty">No extra reminders yet.</p>';
    return;
  }
  box.innerHTML = state.reminders
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((item) => `
      <div class="item">
        <div class="item-main"><span class="item-time">${escapeHtml(prettyTime(item.time))}</span>${escapeHtml(item.text)}</div>
        <button class="btn btn-tiny carer-only" type="button" data-action="del-rem" data-id="${item.id}">Remove</button>
      </div>`)
    .join("");
}

function apptRow(a, removable) {
  return `<div class="item appt-item">
    <div class="item-main">
      <strong>${escapeHtml(prettyDate(a.date))}${a.time ? ", " + escapeHtml(prettyTime(a.time)) : ""}</strong>
      <div>${escapeHtml(a.title)}</div>
      ${a.place ? `<div class="sub">📍 ${escapeHtml(a.place)}</div>` : ""}
      ${a.note ? `<div class="sub">📝 ${escapeHtml(a.note)}</div>` : ""}
    </div>
    ${removable ? `<button class="btn btn-tiny carer-only" type="button" data-action="del-appt" data-id="${a.id}">Remove</button>` : ""}
  </div>`;
}

function renderAppointments() {
  const today = todayStr();
  const upcoming = state.appointments
    .filter((a) => a.date >= today)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  $("apptList").innerHTML = upcoming.length
    ? upcoming.map((a) => apptRow(a, true)).join("")
    : '<p class="empty">No appointments coming up.</p>';
  const soon = upcoming.filter((a) => a.date <= dateOffset(2));
  $("apptTodayCard").classList.toggle("hidden", !soon.length);
  $("apptSoon").innerHTML = soon.map((a) => apptRow(a, false)).join("");
}

/* ---------------- health ---------------- */

function focusVitals() {
  const out = [];
  state.focus.forEach((f) => {
    const def = FOCUS.find((x) => x.id === f);
    (def && def.vitals || []).forEach((v) => { if (!out.includes(v)) out.push(v); });
  });
  return out;
}

function readingsOf(type) {
  return state.vitals.filter((r) => r.type === type).sort((a, b) => a.t.localeCompare(b.t));
}

function sparkline(list) {
  const pts = list.slice(-12);
  if (pts.length < 2) return "";
  const vals = pts.map((r) => r.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 120;
  const h = 34;
  const coords = pts.map((r, i) => {
    const x = (i / (pts.length - 1)) * (w - 6) + 3;
    const y = h - 4 - ((r.v - min) / span) * (h - 8);
    return x.toFixed(1) + "," + y.toFixed(1);
  });
  const last = coords[coords.length - 1].split(",");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <polyline points="${coords.join(" ")}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="currentColor"/></svg>`;
}

function renderVitals() {
  const shown = focusVitals();
  VITAL_ORDER.forEach((t) => { if (!shown.includes(t) && state.vitals.some((r) => r.type === t)) shown.push(t); });
  const box = $("vitalCards");
  if (!shown.length) {
    box.innerHTML = '<p class="empty" style="grid-column:1/-1">No readings yet. Tap “Add a reading” below after measuring blood pressure, sugar, pulse, oxygen, temperature or weight.</p>';
  } else {
    box.innerHTML = shown.map((type) => {
      const def = VITALS[type];
      const list = readingsOf(type);
      const last = list[list.length - 1];
      const status = last ? vitalStatus(last) : "";
      return `<button class="vital ${status ? "v-" + status : ""}" type="button" data-action="vital-detail" data-id="${type}">
        <span class="vital-name">${def.icon} ${escapeHtml(def.label)}</span>
        <strong class="vital-value">${last ? escapeHtml(formatVital(last)) : "No reading"}</strong>
        <span class="vital-when">${last ? escapeHtml(shortDateTime(last.t)) : "Tap to add"}</span>
        ${last && status !== "ok" ? `<span class="vital-flag">${escapeHtml(STATUS_TEXT[status])}</span>` : ""}
        ${sparkline(list)}
      </button>`;
    }).join("");
  }
  // Form options: focus types first
  const order = focusVitals().concat(VITAL_ORDER.filter((t) => !focusVitals().includes(t)));
  const sel = $("vitalType");
  const cur = sel.value;
  sel.innerHTML = order.map((t) => `<option value="${t}">${VITALS[t].icon} ${escapeHtml(VITALS[t].label)}</option>`).join("");
  if (cur && order.includes(cur)) sel.value = cur;
  renderVitalInputs();
}

function renderVitalInputs() {
  const type = $("vitalType").value || "bp";
  const def = VITALS[type];
  const unit = unitOf(type);
  const step = type === "temp" || type === "weight" || (type === "sugar" && state.units.sugar === "mmol") ? "0.1" : "1";
  if (def.two) {
    $("vitalInputs").innerHTML = `<div class="two-col">
      <div><label class="label" for="vitalV1">${def.fields[0]}</label><input id="vitalV1" class="input" type="number" inputmode="decimal" step="1" placeholder="120"></div>
      <div><label class="label" for="vitalV2">${def.fields[1]}</label><input id="vitalV2" class="input" type="number" inputmode="decimal" step="1" placeholder="80"></div>
    </div>`;
  } else {
    $("vitalInputs").innerHTML = `<label class="label" for="vitalV1">${escapeHtml(def.label)} (${escapeHtml(unit)})</label>
      <input id="vitalV1" class="input" type="number" inputmode="decimal" step="${step}">`;
  }
}

function addVital() {
  const type = $("vitalType").value;
  const def = VITALS[type];
  const a = $("vitalV1").value.trim();
  const b = def.two ? $("vitalV2").value.trim() : "";
  if (a === "" || (def.two && b === "") || isNaN(a) || (def.two && isNaN(b))) {
    openOverlay({ title: "Reading not saved", body: "Type the number" + (def.two ? "s" : "") + " first.", actions: closeBtn() });
    return;
  }
  const r = { t: new Date().toISOString(), type, v: fromDisplay(type, a), note: $("vitalNote").value.trim() };
  if (def.two) r.v2 = Number(b);
  if (def.two && r.v2 > r.v) {
    openOverlay({ title: "Please check the numbers", body: "The top number is usually bigger than the bottom number. Check the reading and try again.", actions: closeBtn() });
    return;
  }
  state.vitals.push(r);
  if (state.vitals.length > VITAL_LIMIT) state.vitals = state.vitals.slice(-VITAL_LIMIT);
  logEvent("vital", type + ":" + formatVital(r));
  $("vitalV1").value = "";
  if ($("vitalV2")) $("vitalV2").value = "";
  $("vitalNote").value = "";
  renderVitals();
  renderPatterns();
  vitalFeedback(r);
}

function vitalFeedback(r) {
  const status = vitalStatus(r);
  const label = VITALS[r.type].label;
  const value = formatVital(r);
  if (status === "ok") {
    say(label + " saved. " + value + ". That is in the usual range.");
    openOverlay({ title: "Saved", html: `<p class="big-line">${escapeHtml(value)}</p><p>${escapeHtml(label)} is in the usual range.</p>`, actions: closeBtn() });
    return;
  }
  if (r.type === "sugar" && (status === "low" || status === "urgent" && r.v < VITALS.sugar.urgentLo)) return lowSugarHelp();
  if (r.type === "spo2" && status === "urgent") return breathlessHelp();
  let advice = "";
  if (status === "urgent") {
    if (r.type === "bp" && r.v >= VITALS.bp.urgentHi || r.type === "bp" && r.v2 >= VITALS.bp.urgentHi2) {
      advice = "This is very high. Sit quietly for 5 minutes, then measure again. If it is still this high, or you have chest pain, a bad headache, confusion, weakness, or trouble seeing or speaking, call the emergency number now.";
    } else if (r.type === "bp") {
      advice = "This is very low. Sit or lie down. If you feel faint, confused or unwell, get help now.";
    } else if (r.type === "pulse") {
      advice = "This pulse is far from the usual range. Sit down and rest. If you feel faint, dizzy, breathless or have chest pain, call the emergency number now. Otherwise tell " + helperName() + " and the doctor today.";
    } else if (r.type === "temp") {
      advice = r.v >= VITALS.temp.urgentHi
        ? "This is a high fever. Drink fluids and tell " + helperName() + " and the doctor now. Get urgent help if there is confusion, a stiff neck, a rash, or trouble breathing."
        : "This temperature is low. Warm up with blankets and a warm drink, and tell " + helperName() + " now.";
    } else if (r.type === "sugar") {
      advice = "This blood sugar is very high. Drink water and tell " + helperName() + " or the doctor now. Get urgent help if there is vomiting, deep fast breathing, or drowsiness.";
    } else {
      advice = "This reading needs attention. Tell " + helperName() + " or the doctor now.";
    }
  } else {
    advice = (status === "high" ? "This is higher" : "This is lower") + " than the usual range. Take it again later. If it stays like this, or you feel unwell, tell " + helperName() + " or the doctor.";
  }
  say(label + ". " + value + ". " + advice);
  openOverlay({
    title: STATUS_TEXT[status],
    html: `<p class="big-line">${escapeHtml(value)}</p><p>${escapeHtml(advice)}</p>`,
    actions: (status === "urgent" ? btn("btn-danger", "emergency", emergencyLabel()) : "") +
      btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) +
      btn("btn-warn", "text-reading", "💬 Send reading to " + escapeHtml(helperName()), `data-id="${escapeHtml(label + ": " + value)}"`) +
      closeBtn()
  });
}

function vitalDetail(type) {
  const def = VITALS[type];
  const list = readingsOf(type).slice(-10).reverse();
  const rg = rangeOf(type);
  let range = "";
  if (rg) {
    range = type === "bp"
      ? `Usual range: ${rg.lo}–${rg.hi} / ${rg.lo2}–${rg.hi2} mmHg`
      : `Usual range: ${toDisplay(type, rg.lo)}–${toDisplay(type, rg.hi)} ${unitOf(type)}`;
  }
  const rows = list.length
    ? list.map((r) => {
        const s = vitalStatus(r);
        return `<div class="log-row"><span class="log-time">${escapeHtml(shortDateTime(r.t))}</span>
          <span><strong>${escapeHtml(formatVital(r))}</strong>${s !== "ok" ? " · " + escapeHtml(STATUS_TEXT[s]) : ""}${r.note ? " · " + escapeHtml(r.note) : ""}</span></div>`;
      }).join("")
    : '<p class="empty">No readings yet.</p>';
  openOverlay({
    title: def.icon + " " + def.label,
    html: `<div class="med-card">${range ? `<p class="sub">${escapeHtml(range)}</p>` : ""}<div class="log-list">${rows}</div></div>`,
    actions: btn("btn-main", "vital-add-type", "Add a reading", `data-id="${type}"`) +
      (list.length ? `<button class="btn btn-tiny carer-only" type="button" data-action="vital-del-last" data-id="${type}">Remove the last reading</button>` : "") +
      btn("btn-soft", "close-overlay", "Close")
  });
}

function openVitalForm(type) {
  closeOverlay();
  showTab("health");
  $("vitalType").value = type;
  renderVitalInputs();
  $("vitalForm").open = true;
  setTimeout(() => {
    $("vitalForm").scrollIntoView({ behavior: "smooth", block: "center" });
    $("vitalV1") && $("vitalV1").focus();
  }, 300);
}

function renderSymptoms() {
  $("symptomGrid").innerHTML = SYMPTOMS.map((s) =>
    `<button class="chip sym" type="button" data-action="symptom" data-id="${s.id}">${s.label}</button>`
  ).join("");
  const today = todayStr();
  const todays = state.log.filter((e) => e.type === "symptom" && dayOf(e.t) === today);
  $("symptomToday").textContent = todays.length
    ? "Noted today: " + todays.map((e) => symptomText(e.detail)).join(", ") + "."
    : "";
}

function symptomText(detail) {
  const [id, sev] = String(detail).split(":");
  const s = SYMPTOMS.find((x) => x.id === id);
  const v = SEVERITY.find((x) => x.id === sev);
  return (s ? s.label.replace(/^\S+\s/, "") : id) + (v ? " (" + v.label.toLowerCase() + ")" : "");
}

function askSymptom(id) {
  const s = SYMPTOMS.find((x) => x.id === id);
  if (!s) return;
  say(s.label.replace(/^\S+\s/, "") + ". How bad is it?");
  openOverlay({
    title: s.label,
    body: "How bad is it?",
    actions: `<div class="pain-grid three">${SEVERITY.map((v) =>
      `<button class="btn btn-soft" type="button" data-action="symptom-save" data-id="${id}:${v.id}">${v.label}</button>`).join("")}</div>` +
      btn("btn-soft", "close-overlay", "Cancel")
  });
}

function saveSymptom(detail) {
  const [id, sev] = detail.split(":");
  const s = SYMPTOMS.find((x) => x.id === id);
  logEvent("symptom", detail);
  renderSymptoms();
  renderPatterns();
  if (id === "bladder") return bladderHelp();
  if (s && s.serious && sev === "severe") {
    if (id === "breath") return breathlessHelp();
    return heartHelp();
  }
  const text = sev === "severe"
    ? "Thank you. That sounds hard. Let’s tell " + helperName() + " now."
    : "Thank you. It is written down for " + helperName() + " and the doctor.";
  say(text);
  openOverlay({
    title: "Written down",
    body: text,
    actions: (sev === "severe" ? btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) : "") +
      btn("btn-warn", "text-symptom", "💬 Tell " + escapeHtml(helperName()), `data-id="${escapeHtml(symptomText(detail))}"`) +
      closeBtn()
  });
}

function renderSleep() {
  const today = todayStr();
  const s = state.sleep.date === today ? state.sleep : { quality: "", hours: "" };
  $("sleepRow").innerHTML = SLEEP.map((q) =>
    `<button class="mood-btn ${s.quality === q.id ? "is-on" : ""}" type="button" data-action="set-sleep" data-id="${q.id}" aria-pressed="${s.quality === q.id}">${q.label}</button>`
  ).join("");
  if (document.activeElement !== $("sleepHours")) $("sleepHours").value = s.hours || "";
  const poor = new Set(state.log.filter((e) => e.type === "sleep" && e.detail.startsWith("poor") && Date.now() - new Date(e.t) < 7 * DAY_MS).map((e) => dayOf(e.t))).size;
  $("sleepText").textContent = poor >= 3 ? "Poor sleep on " + poor + " nights this week. Tell the doctor; pain, worry, needing the toilet at night and some medicines can all affect sleep." : "";
}

function setSleep(quality, hours) {
  const today = todayStr();
  const prev = state.sleep.date === today ? state.sleep : { quality: "", hours: "" };
  state.sleep = { date: today, quality: quality ?? prev.quality, hours: hours ?? prev.hours };
  // Keep one sleep entry per day in the log
  state.log = state.log.filter((e) => !(e.type === "sleep" && dayOf(e.t) === today));
  logEvent("sleep", (state.sleep.quality || "") + (state.sleep.hours ? ":" + state.sleep.hours : ""));
  renderSleep();
  if (quality) say("Thank you.");
}

function lastBowel() {
  const e = state.log.filter((x) => x.type === "bowel").pop();
  return e ? e.t : "";
}

function renderBowel() {
  const last = lastBowel();
  if (!last) {
    $("bowelText").textContent = "Nothing recorded yet.";
    return;
  }
  const days = Math.floor((new Date(todayStr()) - new Date(dayOf(last))) / DAY_MS);
  $("bowelText").textContent = "Last recorded: " + (days === 0 ? "today" : days === 1 ? "yesterday" : days + " days ago") + ".";
}

function bladderHelp() {
  const text = "Pain or burning, needing to go very often, or cloudy or smelly urine can be a urine infection. It can also make people confused. Tell " + helperName() + " and the doctor today. If you cannot pass urine at all, or there is a lot of blood, get help now.";
  say(text);
  openOverlay({
    title: "Problem passing urine",
    body: text,
    actions: btn("btn-warn", "text-symptom", "💬 Tell " + escapeHtml(helperName()), 'data-id="a problem passing urine"') +
      btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) + closeBtn()
  });
}

function renderExercises() {
  const today = todayStr();
  const list = $("exerciseList");
  if (!state.exercises.length) {
    list.innerHTML = '<p class="empty">No exercises added. A carer can add the ones a physio or doctor suggested.</p>';
    return;
  }
  list.innerHTML = state.exercises.map((ex) => {
    const done = state.exercisesDone[ex.id] === today;
    return `<div class="row-item ${done ? "is-taken" : ""}">
      <button class="item-main link-plain" type="button" data-action="read-ex" data-id="${ex.id}">
        <strong>${escapeHtml(ex.text)}</strong>${ex.how ? `<div class="sub">${escapeHtml(ex.how)}</div>` : ""}
        ${done ? '<div class="med-status ok">✓ Done today</div>' : ""}</button>
      ${done ? "" : `<button class="btn btn-tiny btn-done" type="button" data-action="done-ex" data-id="${ex.id}">Done</button>`}
      <button class="btn btn-tiny carer-only" type="button" data-action="del-ex" data-id="${ex.id}">Remove</button>
    </div>`;
  }).join("");
}

/* ---------------- talk ---------------- */

function renderPhrases() {
  const groups = PHRASES.map((g) => ({ group: g.group, items: g.items.map(([icon, text]) => ({ icon, text })) }));
  if (state.phrases.length) groups.unshift({ group: "My phrases", items: state.phrases });
  $("phraseBoard").innerHTML = groups.map((g) => `<h3>${escapeHtml(g.group)}</h3>
    <div class="phrase-grid">${g.items.map((p) =>
      `<button class="phrase" type="button" data-action="say-phrase" data-text="${escapeHtml(p.text)}"><span class="phrase-icon">${escapeHtml(p.icon || "💬")}</span><span>${escapeHtml(p.text)}</span></button>`
    ).join("")}</div>`).join("");
  $("phraseEdit").innerHTML = state.phrases.map((p) => `<div class="item">
      <div class="item-main">${escapeHtml(p.icon || "💬")} ${escapeHtml(p.text)}</div>
      <button class="btn btn-tiny" type="button" data-action="del-phrase" data-id="${p.id}">Remove</button>
    </div>`).join("");
}

function sayPhrase(text) {
  if (!text) return;
  say(text, true);
  logEvent("talk", text);
  openOverlay({
    title: "",
    html: `<p class="talk-big">${escapeHtml(text)}</p>`,
    actions: btn("btn-soft", "say-phrase", "🔊 Say it again", `data-text="${escapeHtml(text)}"`) + closeBtn("Done")
  });
}

function showBig(text) {
  if (!text) return;
  openOverlay({ title: "", html: `<p class="talk-big">${escapeHtml(text)}</p>`, actions: closeBtn("Done") });
}

function toggleCaptions() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const box = $("captionBox");
  const b = $("captionBtn");
  if (recognizer) {
    recognizer.stop();
    return;
  }
  if (!Rec) {
    box.classList.remove("hidden");
    box.textContent = "This phone’s browser can’t listen. Try Chrome, or ask the person to type in “Type it” above.";
    return;
  }
  recognizer = new Rec();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = navigator.language || "en-IN";
  let finalText = "";
  box.classList.remove("hidden");
  box.textContent = "Listening…";
  b.textContent = "⏹️ Stop listening";
  recognizer.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finalText += t + " ";
      else interim += t;
    }
    const words = (finalText + interim).trim().split(/\s+/);
    box.textContent = words.slice(-40).join(" ");
  };
  recognizer.onerror = (ev) => {
    if (ev.error === "not-allowed") box.textContent = "The microphone is blocked. Allow it in the phone’s settings for this app.";
  };
  recognizer.onend = () => {
    recognizer = null;
    b.textContent = "👂 Start listening";
  };
  try {
    recognizer.start();
  } catch {
    recognizer = null;
    b.textContent = "👂 Start listening";
  }
}

/* ---------------- people & me ---------------- */

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

function renderPeople() {
  const grid = $("peopleGrid");
  if (!state.people.length) {
    grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Add photos of family, friends and carers so faces stay familiar and calls are one tap away.</p>';
    return;
  }
  grid.innerHTML = state.people.map((person) => {
    const face = person.photo
      ? `<img src="${escapeHtml(person.photo)}" alt="${escapeHtml(person.name)}">`
      : `<div class="avatar">${escapeHtml(initials(person.name))}</div>`;
    return `<button class="person" type="button" data-action="say-person" data-id="${person.id}">
      ${face}
      <strong>${escapeHtml(person.name)}</strong>
      <span>${escapeHtml(person.relation || "")}</span>
      ${person.phone ? '<span class="person-call">📞</span>' : ""}
    </button>`;
  }).join("");
}

function renderMe() {
  const p = state.profile;
  const name = p.name || "My name can be added here";
  const age = ageOf(p.dob);
  const photo = p.photo
    ? `<img src="${escapeHtml(p.photo)}" alt="${escapeHtml(name)}">`
    : `<div class="avatar">${escapeHtml(initials(p.name || "Me"))}</div>`;
  $("idBody").innerHTML = `
    <div class="id-face">
      ${photo}
      <div>
        <h1 class="id-name">${escapeHtml(name)}</h1>
        ${age ? `<p class="sub">Age ${escapeHtml(age)}</p>` : ""}
        <p class="sub">${escapeHtml(p.address || "Home address not set yet")}</p>
        <p class="sub">Helper: ${escapeHtml(state.helper.name || "Not set")}${state.helper.phone ? " · " + escapeHtml(state.helper.phone) : ""}</p>
      </div>
    </div>`;
  const medNames = state.meds.map((m) => m.name + (m.dose ? " " + m.dose : "") + " (" + m.when.toLowerCase() + ")").join(", ");
  const row = (label, value, empty) => `<p><strong>${label}</strong><br>${escapeHtml(value || empty)}</p>`;
  $("medInfo").innerHTML =
    row("Health conditions", p.diagnosis, "Not written yet") +
    row("Allergies", p.allergies, "None written yet") +
    row("Medicines to avoid", p.avoid, "None written yet") +
    row("Current medicines", medNames, "None listed") +
    (p.blood ? row("Blood group", p.blood, "") : "") +
    (p.devices ? row("Devices and aids", p.devices, "") : "") +
    (p.howTo ? row("How best to help me", p.howTo, "") : "") +
    row("Doctor", p.doctor, "Not set");
  $("storyText").textContent = p.story || "A caregiver can write a short life story here.";
  const map = {
    profileName: "name", profileAddress: "address", profileDiagnosis: "diagnosis", profileAllergies: "allergies",
    profileAvoid: "avoid", profileDoctor: "doctor", profileStory: "story", profileDob: "dob", profileBlood: "blood",
    profileDevices: "devices", profileLanguage: "language", profileHowTo: "howTo", profileWishes: "wishes"
  };
  Object.keys(map).forEach((id) => { $(id).value = p[map[id]] || ""; });
}

/* ---------------- caregiver tab ---------------- */

function renderFocus() {
  $("focusList").innerHTML = FOCUS.map((f) => `<label class="check-row">
      <input type="checkbox" data-focus="${f.id}" ${hasFocus(f.id) ? "checked" : ""}>
      <span>${escapeHtml(f.label)}</span>
    </label>`).join("");
}

function renderHelper() {
  const h = state.helper;
  $("helperName").value = h.name || "";
  $("helperPhone").value = h.phone || "";
  $("backupName").value = h.backupName || "";
  $("backupPhone").value = h.backupPhone || "";
  $("emergencyNumber").value = h.emergency || "";
  $("crisisName").value = h.crisisName || "";
  $("crisisPhone").value = h.crisisPhone || "";
  $("helperDisplay").textContent = h.name || h.phone
    ? "Saved: " + (h.name || "Helper") + " · " + (h.phone || "no phone") + (h.backupPhone ? ". Backup: " + (h.backupName || "backup") + " · " + h.backupPhone : "")
    : "No helper saved yet. The SOS button needs a phone number.";
  $("checkInText").textContent = state.checkIn
    ? "Last “I am okay” was " + new Date(state.checkIn).toLocaleString() + "."
    : "No check-in yet.";
}

function renderCheckTimes() {
  $("checkTimes").innerHTML = state.checkTimes.length
    ? state.checkTimes.slice().sort().map((t) => `<div class="item">
        <div class="item-main"><span class="item-time">${escapeHtml(prettyTime(t))}</span>Are you okay?</div>
        <button class="btn btn-tiny" type="button" data-action="del-checktime" data-id="${escapeHtml(t)}">Remove</button>
      </div>`).join("")
    : '<p class="empty">No check-in times set.</p>';
}

function renderJournal() {
  const list = state.journal.slice(-30).reverse();
  $("journalList").innerHTML = list.length
    ? list.map((j) => `<div class="log-row"><span class="log-time">${escapeHtml(shortDateTime(j.t))}${j.author ? " · " + escapeHtml(j.author) : ""}</span>
        <span>${escapeHtml(j.text)}</span></div>`).join("")
    : '<p class="empty">No handover notes yet.</p>';
}

function fillNoteForm() {
  $("careNote").value = state.note.text || "";
  $("careAuthor").value = state.note.author || "";
}

function renderEditors() {
  $("qaEdit").innerHTML = state.qa.length
    ? state.qa.map((item) => `<div class="item">
        <div class="item-main"><strong>${escapeHtml(item.q)}</strong><div class="sub">${escapeHtml(item.a)}</div></div>
        <button class="btn btn-tiny" type="button" data-action="del-qa" data-id="${item.id}">Remove</button>
      </div>`).join("")
    : '<p class="empty">No questions yet.</p>';
  $("actEdit").innerHTML = state.activities.length
    ? state.activities.map((item) => `<div class="item">
        <div class="item-main">${escapeHtml(item.text)}</div>
        <button class="btn btn-tiny" type="button" data-action="del-act" data-id="${item.id}">Remove</button>
      </div>`).join("")
    : '<p class="empty">No activities yet.</p>';
}

function renderRanges() {
  $("rangeEdit").innerHTML = VITAL_ORDER.filter((t) => VITALS[t].range).map((t) => {
    const rg = rangeOf(t);
    const def = VITALS[t];
    const step = t === "temp" || (t === "sugar" && state.units.sugar === "mmol") ? "0.1" : "1";
    const pair = (key, label) => `<div><label class="label" for="rg-${t}-${key}">${label}</label>
      <input id="rg-${t}-${key}" class="input" type="number" step="${step}" value="${t === "bp" ? rg[key] : toDisplay(t, rg[key])}"></div>`;
    return `<h3>${def.icon} ${escapeHtml(def.label)} (${escapeHtml(unitOf(t))})</h3>
      <div class="two-col">${pair("lo", t === "bp" ? "Top number, lowest" : "Lowest")}${pair("hi", t === "bp" ? "Top number, highest" : "Highest")}</div>
      ${t === "bp" ? `<div class="two-col">${pair("lo2", "Bottom number, lowest")}${pair("hi2", "Bottom number, highest")}</div>` : ""}`;
  }).join("");
}

function saveRanges() {
  VITAL_ORDER.filter((t) => VITALS[t].range).forEach((t) => {
    const keys = t === "bp" ? ["lo", "hi", "lo2", "hi2"] : ["lo", "hi"];
    const out = {};
    keys.forEach((k) => {
      const el = $("rg-" + t + "-" + k);
      if (el && el.value !== "" && !isNaN(el.value)) out[k] = t === "bp" ? Number(el.value) : fromDisplay(t, el.value);
    });
    state.ranges[t] = out;
  });
  save();
  renderRanges();
  renderVitals();
  renderPatterns();
  openOverlay({ title: "Ranges saved", body: "Readings outside these ranges will be marked.", actions: closeBtn() });
}

function renderChecks() {
  const row = (item) => `<label class="check-row">
      <input type="checkbox" data-check="${item.id}" ${state.checks[item.id] ? "checked" : ""}>
      <span>${escapeHtml(item.text)}</span>
    </label>`;
  const safety = SAFETY_CHECKS.filter((c) => !c.focus || c.focus.some(hasFocus));
  $("safetyList").innerHTML = safety.map(row).join("") +
    (state.focus.length ? "" : '<p class="sub">Choose a care focus above to see more checks for specific conditions.</p>');
  $("planList").innerHTML = PLAN_CHECKS.map(row).join("");
}

function painLabel(id) {
  const [area, level] = String(id).split(":");
  const a = PAIN_AREAS.find((p) => p.id === area);
  return (a ? a.label.replace(/^\S+\s/, "") : area) + (level ? ", " + level + " out of 10" : "");
}

function eventDetail(e) {
  if (e.type === "mood") {
    const m = MOODS.find((x) => x.id === e.detail);
    return m ? m.label : e.detail;
  }
  if (e.type === "pain") return painLabel(e.detail);
  if (e.type === "symptom") return symptomText(e.detail);
  if (e.type === "vital") {
    const [t, ...rest] = String(e.detail).split(":");
    return VITALS[t] ? VITALS[t].label + " " + rest.join(":") : e.detail;
  }
  if (e.type === "sleep") {
    const [q, h] = String(e.detail).split(":");
    const s = SLEEP.find((x) => x.id === q);
    return (s ? s.label.replace(/^\S+\s/, "") : "") + (h ? (s ? ", " : "") + h + " hours" : "");
  }
  if (e.type === "question") {
    const q = state.qa.find((x) => x.id === e.detail);
    return q ? q.q : "";
  }
  if (e.type === "location") return "";
  return e.detail || "";
}

/* ---------------- patterns & warning signs ---------------- */

function medAdherence(days) {
  const meds = scheduledMeds();
  if (!meds.length) return null;
  const now = Date.now();
  const names = new Set(meds.map((m) => m.name));
  // Only whole days before today count, so a new day doesn't look like missed doses
  const today = todayStr();
  const inWindow = state.log.filter((e) => now - new Date(e.t).getTime() < days * DAY_MS && dayOf(e.t) !== today);
  if (!inWindow.length) return null;
  const span = new Set(inWindow.map((e) => dayOf(e.t))).size;
  const taken = inWindow.filter((e) => e.type === "med" && names.has(e.detail)).length;
  return Math.min(100, Math.round((taken / (meds.length * span)) * 100));
}

function buildAlerts() {
  const now = Date.now();
  const today = todayStr();
  const age = (e) => now - new Date(e.t).getTime();
  const recent = state.log.filter((e) => age(e) < 14 * DAY_MS);
  const week = recent.filter((e) => age(e) < 7 * DAY_MS);
  const alerts = [];

  // 1. Sudden worsening: possible delirium or acute illness
  const distressToday = recent.filter((e) => DISTRESS.includes(e.type) && dayOf(e.t) === today).length;
  const priorWeek = recent.filter((e) => DISTRESS.includes(e.type) && dayOf(e.t) !== today && age(e) < 8 * DAY_MS).length;
  if (distressToday >= 3 && distressToday >= 2 * Math.max(priorWeek / 7, 1)) {
    alerts.push(["danger", "Much more distress or confusion today than usual. A sudden change over hours or days can be delirium or a new illness, often caused by an infection (such as a urine or chest infection), dehydration, constipation, pain or a new medicine. Contact the doctor today."]);
  }

  // 2. Urgent readings in the last 2 days
  const urgent = state.vitals.filter((r) => now - new Date(r.t).getTime() < 2 * DAY_MS && vitalStatus(r) === "urgent");
  if (urgent.length) {
    alerts.push(["danger", "Reading" + (urgent.length > 1 ? "s" : "") + " that needed attention in the last 2 days: " +
      urgent.map((r) => VITALS[r.type].label.toLowerCase() + " " + formatVital(r) + " (" + shortDateTime(r.t) + ")").join("; ") + ". Make sure the doctor knows."]);
  }

  // 3. Falls
  const falls = week.filter((e) => e.type === "fall").length;
  if (falls) {
    alerts.push(["danger", falls + (falls === 1 ? " fall" : " falls") + " in the last 7 days. Tell the doctor, especially after any knock to the head or if blood thinners are taken, and check the home for trip hazards."]);
  }

  // 4. Seizures
  const seiz = week.filter((e) => e.type === "seizure");
  if (seiz.length) {
    alerts.push(["danger", seiz.length + (seiz.length === 1 ? " seizure" : " seizures") + " recorded this week (" + seiz.map((e) => e.detail).filter(Boolean).join(", ") + "). Share this with the doctor."]);
  }

  // 5. Missed check-ins
  const missed = week.filter((e) => e.type === "missed").length;
  if (missed) {
    alerts.push(["warn", missed + " check-in" + (missed === 1 ? " was" : "s were") + " not answered this week."]);
  }

  // 6. Medicines not marked as taken
  const hour = new Date().getHours();
  const notTaken = scheduledMeds().filter((m) => {
    if (medRecord(m.id)) return false;
    if (m.time) return minutesSince(m.time) > 120;
    return hour >= (MED_DUE_HOUR[m.when] || 23);
  });
  if (notTaken.length) {
    alerts.push(["warn", "Not marked as taken yet today: " + notTaken.map((m) => m.name).join(", ") + "."]);
  }
  const adh = medAdherence(7);
  if (adh !== null && adh < 80) {
    alerts.push(["warn", "Medicines were marked as taken about " + adh + "% of the time this week. Missed doses are common; a pill organiser, alarms, or asking the doctor for a simpler plan can help."]);
  }

  // 7. Running low on medicine
  const low = state.meds.filter((m) => typeof m.stock === "number" && m.stock <= 7);
  if (low.length) {
    alerts.push(["warn", "Order more soon: " + low.map((m) => m.name + " (" + m.stock + " left)").join(", ") + "."]);
  }

  // 8. As-needed medicine used a lot
  state.meds.filter((m) => m.when === "As needed").forEach((m) => {
    const n = (state.prnDoses[m.id] || []).filter((t) => now - new Date(t).getTime() < 7 * DAY_MS).length;
    if (n >= 10) alerts.push(["warn", m.name + " (as needed) was taken " + n + " times this week. Ask the doctor whether the plan needs to change."]);
  });

  // 9. Low water late in the day
  const goal = Number(state.settings.waterGoal) || 8;
  if (hour >= 17 && (state.water.count || 0) < Math.ceil(goal / 2)) {
    alerts.push(["warn", "Only " + (state.water.count || 0) + " glasses of water logged today. Not drinking enough can quickly cause dizziness, constipation, urine infections and confusion."]);
  }

  // 10. Out-of-range readings this week (not urgent)
  const off = {};
  state.vitals.filter((r) => now - new Date(r.t).getTime() < 7 * DAY_MS).forEach((r) => {
    const s = vitalStatus(r);
    if (s === "high" || s === "low") off[r.type] = (off[r.type] || 0) + 1;
  });
  Object.keys(off).forEach((t) => {
    if (off[t] >= 2) alerts.push(["warn", VITALS[t].label + " was outside the usual range " + off[t] + " times this week. Mention it to the doctor."]);
  });

  // 11. Quick weight gain (fluid build-up) for heart or kidney
  if (hasFocus("heart") || hasFocus("kidney")) {
    const w = readingsOf("weight").filter((r) => now - new Date(r.t).getTime() < 4 * DAY_MS);
    if (w.length >= 2 && w[w.length - 1].v - Math.min(...w.map((r) => r.v)) >= 2) {
      alerts.push(["danger", "Weight went up by 2 kg or more in about 3 days. With heart or kidney problems this can mean fluid is building up. Call the doctor today."]);
    }
  }

  // 12. Low blood sugar episodes
  const hypos = state.vitals.filter((r) => r.type === "sugar" && now - new Date(r.t).getTime() < 7 * DAY_MS && r.v < (rangeOf("sugar") || {}).lo).length +
    week.filter((e) => e.type === "lowsugar").length;
  if (hypos >= 2) {
    alerts.push(["warn", "Low blood sugar " + hypos + " times this week. Tell the diabetes doctor or nurse; the medicine dose may need changing."]);
  }

  // 13. Sundowning
  const confusedEvents = recent.filter((e) => e.type === "confused" || e.type === "lost");
  const evening = confusedEvents.filter((e) => {
    const h = new Date(e.t).getHours();
    return h >= 16 && h < 22;
  }).length;
  if (confusedEvents.length >= 4 && evening / confusedEvents.length >= 0.6) {
    alerts.push(["warn", "Most confused moments happen in the late afternoon or evening (often called sundowning). Daylight and activity in the day, a calm evening routine, good lighting, fewer naps and no caffeine after lunch can help. Mention it to the doctor."]);
  }

  // 14. Low mood
  const lowDays = new Set(week.filter((e) => (e.type === "mood" && LOW_MOODS.includes(e.detail)) || e.type === "overwhelmed").map((e) => dayOf(e.t))).size;
  if (lowDays >= 3) {
    alerts.push(["warn", "Sad, worried, upset or overwhelmed on " + lowDays + " of the last 7 days. Low mood and anxiety are common with long-term illness, and they can be treated. Tell the doctor."]);
  }

  // 15. Pain
  const pains = week.filter((e) => e.type === "pain");
  if (pains.length >= 2) {
    const areas = [...new Set(pains.map((p) => painLabel(String(p.detail).split(":")[0])))].join(", ");
    alerts.push(["warn", "Pain reported " + pains.length + " times this week (" + areas + "). Pain that isn’t treated can show up as agitation, poor sleep or not eating. Ask the doctor to check."]);
  }

  // 16. Constipation
  const lastB = lastBowel();
  if (lastB && now - new Date(lastB).getTime() >= 3 * DAY_MS) {
    const d = Math.floor((now - new Date(lastB).getTime()) / DAY_MS);
    alerts.push(["warn", "No bowel movement recorded for " + d + " days. Constipation is common, especially with some medicines, and can cause pain and confusion. Check fluids, fibre and movement, and ask the doctor or pharmacist if it continues."]);
  }

  // 17. Poor sleep
  const poorNights = new Set(week.filter((e) => e.type === "sleep" && String(e.detail).startsWith("poor")).map((e) => dayOf(e.t))).size;
  if (poorNights >= 3) {
    alerts.push(["warn", "Poor sleep on " + poorNights + " nights this week. Pain, worry, breathlessness, night-time toilet trips and some medicines can all affect sleep."]);
  }

  // 18. Repeated symptoms
  const symCount = {};
  week.filter((e) => e.type === "symptom").forEach((e) => {
    const id = String(e.detail).split(":")[0];
    symCount[id] = (symCount[id] || 0) + 1;
  });
  const repeated = Object.keys(symCount).filter((id) => symCount[id] >= 3);
  if (repeated.length) {
    alerts.push(["warn", "Symptoms noted 3 or more times this week: " + repeated.map((id) => symptomText(id) + " (" + symCount[id] + ")").join(", ") + "."]);
  }

  // Most urgent first
  return alerts.sort((x, y) => (x[0] === "danger" ? 0 : 1) - (y[0] === "danger" ? 0 : 1));
}

function renderPatterns() {
  const now = Date.now();
  const age = (e) => now - new Date(e.t).getTime();
  const week = state.log.filter((e) => age(e) < 7 * DAY_MS);
  const alerts = buildAlerts();

  $("alerts").innerHTML = alerts.length
    ? alerts.map(([level, text]) => `<div class="alert alert-${level}">${escapeHtml(text)}</div>`).join("")
    : '<div class="alert alert-ok">No warning signs found in the last two weeks.</div>';

  // Weekly counts
  const statTypes = ["confused", "pain", "fall", "sos", "symptom", "checkin"];
  const adh = medAdherence(7);
  $("stats").innerHTML = statTypes.map((type) => {
    const n = week.filter((e) => e.type === type).length;
    return `<div class="stat"><strong>${n}</strong><span>${escapeHtml(LOG_LABELS[type])}</span></div>`;
  }).join("") +
    (adh !== null ? `<div class="stat stat-wide"><strong>${adh}%</strong><span>💊 Medicines marked as taken</span></div>` : "") +
    '<p class="sub stat-note">Counts for the last 7 days.</p>';

  // Most repeated questions
  const qCounts = {};
  week.filter((e) => e.type === "question").forEach((e) => { qCounts[e.detail] = (qCounts[e.detail] || 0) + 1; });
  const top = Object.entries(qCounts)
    .map(([id, n]) => ({ q: (state.qa.find((x) => x.id === id) || {}).q, n }))
    .filter((x) => x.q)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  $("topQuestions").innerHTML = top.length
    ? "<h3>Most asked this week</h3>" + top.map((x) => `<p class="sub">“${escapeHtml(x.q)}”: ${x.n} times</p>`).join("")
    : "";

  // Recent events
  const last = state.log.slice(-40).reverse();
  $("logList").innerHTML = last.length
    ? last.map((e) => {
        const detail = eventDetail(e);
        return `<div class="log-row"><span class="log-time">${escapeHtml(shortDateTime(e.t))}</span>
          <span>${escapeHtml(LOG_LABELS[e.type] || e.type)}${detail ? ": " + escapeHtml(detail) : ""}</span></div>`;
      }).join("")
    : '<p class="empty">Nothing recorded yet.</p>';
}

/* ---------------- doctor summary ---------------- */

function reportData(days) {
  const now = Date.now();
  const inRange = (t) => now - new Date(t).getTime() < days * DAY_MS;
  const log = state.log.filter((e) => inRange(e.t));
  const count = (type) => log.filter((e) => e.type === type).length;
  const p = state.profile;
  const vit = VITAL_ORDER.map((t) => {
    const list = state.vitals.filter((r) => r.type === t && inRange(r.t));
    if (!list.length) return null;
    const avg = list.reduce((s, r) => s + r.v, 0) / list.length;
    const avg2 = t === "bp" ? list.reduce((s, r) => s + r.v2, 0) / list.length : 0;
    const lo = list.reduce((a, b) => (a.v <= b.v ? a : b));
    const hi = list.reduce((a, b) => (a.v >= b.v ? a : b));
    const off = list.filter((r) => vitalStatus(r) !== "ok").length;
    const fmt = (v, v2) => (t === "bp" ? Math.round(v) + "/" + Math.round(v2) + " mmHg" : toDisplay(t, v) + " " + unitOf(t));
    return {
      label: VITALS[t].label, n: list.length, avg: fmt(avg, avg2), low: formatVital(lo), high: formatVital(hi),
      last: formatVital(list[list.length - 1]), off
    };
  }).filter(Boolean);
  const symptoms = {};
  log.filter((e) => e.type === "symptom").forEach((e) => {
    const k = symptomText(String(e.detail).split(":")[0]);
    symptoms[k] = (symptoms[k] || 0) + 1;
  });
  const pains = {};
  log.filter((e) => e.type === "pain").forEach((e) => {
    const k = painLabel(String(e.detail).split(":")[0]);
    pains[k] = (pains[k] || 0) + 1;
  });
  const moods = {};
  log.filter((e) => e.type === "mood").forEach((e) => {
    const m = MOODS.find((x) => x.id === e.detail);
    const k = m ? m.label.replace(/^\S+\s/, "") : e.detail;
    moods[k] = (moods[k] || 0) + 1;
  });
  const sleeps = log.filter((e) => e.type === "sleep");
  const hours = sleeps.map((e) => Number(String(e.detail).split(":")[1])).filter((n) => n > 0);
  const prn = state.meds.filter((m) => m.when === "As needed").map((m) => ({
    name: m.name, n: (state.prnDoses[m.id] || []).filter(inRange).length
  })).filter((x) => x.n);
  return {
    days, p, vit, symptoms, pains, moods, prn,
    sleepPoor: sleeps.filter((e) => String(e.detail).startsWith("poor")).length,
    sleepAvg: hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null,
    falls: log.filter((e) => e.type === "fall").map((e) => shortDateTime(e.t)),
    seizures: log.filter((e) => e.type === "seizure").map((e) => shortDateTime(e.t) + (e.detail ? " (" + e.detail + ")" : "")),
    counts: {
      confused: count("confused") + count("lost"), sos: count("sos") + count("emergency"),
      missed: count("missed"), unwell: count("unwell"), breathless: count("breathless"), heart: count("heart"), lowsugar: count("lowsugar")
    },
    adherence: medAdherence(days),
    alerts: buildAlerts(),
    journal: state.journal.filter((j) => inRange(j.t)).slice(-8)
  };
}

function reportHtml(d) {
  const p = d.p;
  const sec = (title, inner) => inner ? `<h3>${title}</h3>${inner}` : "";
  const list = (items) => items.length ? `<ul class="tight">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "";
  const entries = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]).map((k) => k + ": " + o[k]);
  const age = ageOf(p.dob);
  const meds = state.meds.map((m) => m.name + (m.dose ? " " + m.dose : "") + " (" + m.when.toLowerCase() + (m.time ? ", " + prettyTime(m.time) : "") + ")");
  const events = [];
  if (d.counts.confused) events.push("Confused or lost: " + d.counts.confused);
  if (d.counts.unwell) events.push("Felt unwell: " + d.counts.unwell);
  if (d.counts.breathless) events.push("Breathless: " + d.counts.breathless);
  if (d.counts.heart) events.push("Chest pain or racing heart: " + d.counts.heart);
  if (d.counts.lowsugar) events.push("Low sugar steps used: " + d.counts.lowsugar);
  if (d.counts.sos) events.push("Called for help: " + d.counts.sos);
  if (d.counts.missed) events.push("Check-ins not answered: " + d.counts.missed);
  d.falls.forEach((f) => events.push("Fall: " + f));
  d.seizures.forEach((s) => events.push("Seizure: " + s));
  const vitals = d.vit.length
    ? `<div class="table-wrap"><table class="report-table"><thead><tr><th>Reading</th><th>Average</th><th>Lowest to highest</th><th>Outside usual range</th></tr></thead><tbody>${
        d.vit.map((v) => `<tr><td>${escapeHtml(v.label)}<br><span class="sub">${v.n} ${v.n === 1 ? "reading" : "readings"}</span></td><td>${escapeHtml(v.avg)}</td><td>${escapeHtml(v.low)} to ${escapeHtml(v.high)}</td><td>${v.off} of ${v.n}</td></tr>`).join("")
      }</tbody></table></div>`
    : "";
  return `<div class="report">
    <p class="sub">Care Companion summary for the last ${d.days} days, made ${escapeHtml(new Date().toLocaleString())}.</p>
    ${sec("Patient", list([
      (p.name || "Name not set") + (age ? ", age " + age : ""),
      p.diagnosis ? "Conditions: " + p.diagnosis : "",
      p.allergies ? "Allergies: " + p.allergies : "",
      p.avoid ? "Medicines to avoid: " + p.avoid : "",
      p.blood ? "Blood group: " + p.blood : "",
      p.devices ? "Devices and aids: " + p.devices : ""
    ].filter(Boolean)))}
    ${sec("Medicines", list(meds.concat(
      d.adherence !== null ? ["Scheduled medicines marked as taken: about " + d.adherence + "%"] : [],
      d.prn.map((x) => x.name + " (as needed) taken " + x.n + (x.n === 1 ? " time" : " times"))
    )))}
    ${sec("Health readings", vitals)}
    ${sec("Symptoms noted", list(entries(d.symptoms)))}
    ${sec("Pain reported", list(entries(d.pains)))}
    ${sec("Events", list(events))}
    ${sec("Mood", list(entries(d.moods)))}
    ${sec("Sleep", list([
      d.sleepAvg !== null ? "Average sleep: " + d.sleepAvg + " hours" : "",
      d.sleepPoor ? "Poor nights: " + d.sleepPoor : ""
    ].filter(Boolean)))}
    ${sec("Warning signs", list(d.alerts.map((a) => a[1])))}
    ${sec("Carer notes", list(d.journal.map((j) => shortDateTime(j.t) + (j.author ? " (" + j.author + ")" : "") + ": " + j.text)))}
    <p class="sub">Recorded by the patient and carers in the app. Readings are as typed in and have not been checked by a professional.</p>
  </div>`;
}

function reportText(d) {
  const tmp = document.createElement("div");
  tmp.innerHTML = reportHtml(d).replace(/<\/(h3|p|li|tr)>/g, "\n").replace(/<li>/g, "• ").replace(/<\/t[dh]>/g, " | ");
  return tmp.textContent.replace(/\n\s*\n+/g, "\n").replace(/^[ \t]+/gm, "").trim();
}

let lastReportDays = 7;

function showReport(days) {
  lastReportDays = Number(days) || 7;
  const d = reportData(lastReportDays);
  openOverlay({
    title: "Summary for the doctor",
    html: reportHtml(d),
    actions: btn("btn-main", "report-print", "🖨️ Print or save as PDF") +
      btn("btn-soft", "report-share", "📤 Share or copy") +
      btn("btn-soft", "close-overlay", "Close")
  });
}

function printReport() {
  const d = reportData(lastReportDays);
  $("printArea").innerHTML = `<h1>Care Companion</h1>` + reportHtml(d);
  window.print();
}

async function shareReport() {
  const text = reportText(reportData(lastReportDays));
  try {
    if (navigator.share) {
      await navigator.share({ title: "Care Companion summary", text });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(text);
    openOverlay({ title: "Copied", body: "The summary is copied. Paste it into a message or email.", actions: closeBtn() });
  } catch {
    openOverlay({ title: "Could not share", body: "Use “Print or save as PDF” instead.", actions: closeBtn() });
  }
}

/* ---------------- notifications ---------------- */

function renderNotify() {
  const el = $("notifyText");
  if (!window.Notification) {
    el.textContent = "This browser can’t show alerts. Reminders will still speak and pop up while the app is open.";
  } else if (Notification.permission === "granted") {
    el.textContent = "Alerts are allowed.";
  } else if (Notification.permission === "denied") {
    el.textContent = "Alerts are blocked. Allow them in the phone’s settings for this app.";
  } else {
    el.textContent = "Alerts are not allowed yet.";
  }
}

function enableNotify() {
  if (!window.Notification) return renderNotify();
  Notification.requestPermission().then(renderNotify);
}

async function notify(title, body) {
  if (!window.Notification || Notification.permission !== "granted") return;
  try {
    // Android Chrome only allows notifications through the service worker
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) reg.showNotification(title, { body, tag: "care-reminder", renotify: true, icon: "icon-192.png", requireInteraction: true });
    else new Notification(title, { body });
  } catch {
    /* ignore */
  }
}

function renderAll() {
  resetDaily();
  applySettings();
  applyCarerMode();
  updateClock();
  renderNote();
  renderNextUp();
  renderFocusHelp();
  renderQA();
  renderSchedule();
  renderMeds();
  renderMeals();
  renderWater();
  renderMood();
  renderReminders();
  renderAppointments();
  renderVitals();
  renderSymptoms();
  renderSleep();
  renderBowel();
  renderExercises();
  renderPhrases();
  renderPeople();
  renderMemories();
  renderMe();
  renderFocus();
  renderHelper();
  renderCheckTimes();
  renderJournal();
  fillNoteForm();
  renderEditors();
  renderRanges();
  renderChecks();
  renderPatterns();
  renderNotify();
}

/* ---------------- overlay ---------------- */

function stopTimers() {
  if (breathTimer) {
    clearInterval(breathTimer);
    breathTimer = null;
  }
  if (seizureTimer) {
    clearInterval(seizureTimer);
    seizureTimer = null;
  }
  stopMemoryPlayback();
}

function closeOverlay() {
  stopTimers();
  stopAlarm();
  $("overlay").classList.add("hidden");
  $("overlay").classList.remove("is-urgent");
  $("breathWrap").classList.add("hidden");
}

function openOverlay({ title, body = "", html = "", actions = "", breath = false, urgent = false }) {
  stopTimers();
  $("overlayTitle").textContent = title;
  $("overlayTitle").classList.toggle("hidden", !title);
  if (html) $("overlayBody").innerHTML = html;
  else $("overlayBody").textContent = body;
  $("overlayActions").innerHTML = actions;
  $("breathWrap").classList.toggle("hidden", !breath);
  $("overlay").classList.toggle("is-urgent", !!urgent);
  $("overlay").classList.remove("hidden");
  const card = $("overlay").querySelector(".overlay-card");
  card.scrollTop = 0;
  setTimeout(() => {
    const first = $("overlayActions").querySelector("button, a, input");
    if (first && document.activeElement && !$("overlay").contains(document.activeElement)) first.focus({ preventScroll: true });
  }, 30);
}

function needHelper() {
  const text = "No helper phone number is saved yet. Please ask your family or carer to add one.";
  say(text);
  openOverlay({ title: "No helper saved", body: text, actions: closeBtn() });
}

/* ---------------- loud alarm ---------------- */

function unlockAudio() {
  if (audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    audioCtx = new Ctx();
  } catch {
    audioCtx = null;
  }
}

function startAlarm(minutes = 2) {
  unlockAudio();
  stopAlarm();
  vibrate([600, 200, 600, 200, 600, 200, 600]);
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.value = 0.5;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  let hi = true;
  const sweep = setInterval(() => {
    hi = !hi;
    osc.frequency.setValueAtTime(hi ? 880 : 620, audioCtx.currentTime);
    if (hi) vibrate([400, 100, 400]);
  }, 450);
  alarmNodes = { osc, gain, sweep };
  alarmStopTimer = setTimeout(stopAlarm, minutes * 60000);
}

function stopAlarm() {
  if (alarmStopTimer) {
    clearTimeout(alarmStopTimer);
    alarmStopTimer = null;
  }
  if (!alarmNodes) return;
  clearInterval(alarmNodes.sweep);
  try {
    alarmNodes.osc.stop();
  } catch {
    /* already stopped */
  }
  alarmNodes = null;
  if (navigator.vibrate) navigator.vibrate(0);
}

function loudAlarm() {
  logEvent("alarm");
  renderPatterns();
  openOverlay({
    title: "📢 Alarm is sounding",
    html: `<p class="big-line">Help! Please come.</p><p>The loud sound tells people nearby that you need help.</p>`,
    actions: btn("btn-danger", "sos", "📞 Call " + escapeHtml(helperName())) + btn("btn-main", "close-overlay", "⏹️ Stop the alarm"),
    urgent: true
  });
  startAlarm(2);
}

/* ---------------- help flows ---------------- */

function orientationSpeech() {
  const now = new Date();
  const pod = partOfDay(now);
  const bits = [
    "You are safe.",
    "Today is " + now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) + ".",
    pod === "night"
      ? "It is " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ". It is night time, and time to sleep."
      : "It is " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " in the " + pod + "."
  ];
  if (state.profile.name) bits.push("Your name is " + state.profile.name + ".");
  if (state.profile.address) bits.push("Your home is " + state.profile.address + ".");
  if (state.helper.name) bits.push("Your helper is " + state.helper.name + ".");
  const next = remainingItems()[0];
  if (next && pod !== "night") bits.push("Next, at " + prettyTime(next.time) + ": " + next.text.replace(/\p{Extended_Pictographic}/gu, "").trim() + ".");
  if (state.note.text) bits.push((state.note.author || "Someone") + " left you a note: " + state.note.text);
  bits.push("You are not alone.");
  return bits.join(" ");
}

function confusedHelp() {
  vibrate([80, 40, 80]);
  logEvent("confused");
  renderPatterns();
  const body = orientationSpeech();
  say(body);
  openOverlay({
    title: "You are safe",
    body,
    actions:
      btn("btn-soft", "breathe", "🌬️ Breathe with me") +
      (state.memories.length ? btn("btn-soft", "memory-play", "📖 Look at my memories") : "") +
      btn("btn-danger", "sos", "🚨 Call helper") +
      btn("btn-ok", "check-in", "✅ I am okay") +
      closeBtn()
  });
}

function lostHelp() {
  vibrate([120, 60, 120]);
  logEvent("lost");
  renderPatterns();
  const p = state.profile;
  const spoken = ["You are safe. Stay where you are for a moment and take a slow breath."];
  if (p.name) spoken.push("Your name is " + p.name + ".");
  if (p.address) spoken.push("Your home is " + p.address + ".");
  spoken.push(state.helper.phone
    ? "Press the button to call " + helperName() + "."
    : "You can show this screen to someone nearby, like a shop worker or police officer.");
  say(spoken.join(" "));
  openOverlay({
    title: "Help is close",
    html: `<p class="big-line">${escapeHtml(p.name || "")}</p>
      <p>Home: <strong>${escapeHtml(p.address || "not written yet")}</strong></p>
      <p>Stay where you are. Call ${escapeHtml(helperName())}, or show this screen to a shop worker or police officer.</p>`,
    actions:
      btn("btn-danger", "sos", "📞 Call " + escapeHtml(helperName())) +
      btn("btn-warn", "send-location", "📍 Send my location") +
      btn("btn-soft", "show-card", "🪪 Show to someone") +
      closeBtn()
  });
}

function cardLines() {
  const p = state.profile;
  const h = state.helper;
  const lines = ["Please help me."];
  state.focus.forEach((f) => {
    const def = FOCUS.find((x) => x.id === f);
    if (def && def.card) lines.push(def.card);
  });
  if (!state.focus.length && p.diagnosis) lines.push("I have " + p.diagnosis + ".");
  if (p.name) lines.push("My name is " + p.name + ".");
  if (p.address) lines.push("I live at " + p.address + ".");
  if (p.language) lines.push("I speak " + p.language + ".");
  if (p.howTo) lines.push(p.howTo);
  if (h.phone) lines.push("Please call " + (h.name || "my helper") + " on " + h.phone + ".");
  else if (h.backupPhone) lines.push("Please call " + (h.backupName || "my helper") + " on " + h.backupPhone + ".");
  return lines;
}

function showToSomeone() {
  const p = state.profile;
  openOverlay({
    title: "Please help me",
    html: `<div class="show-card">${p.photo ? `<img src="${escapeHtml(p.photo)}" alt="">` : ""}${cardLines().slice(1).map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>`,
    actions: btn("btn-soft", "read-card", "🔊 Read it out") + closeBtn()
  });
}

function sendLocation() {
  if (!state.helper.phone) return needHelper();
  const base = "I need help. I may be lost.";
  const go = (msg, detail) => {
    logEvent("location", detail);
    closeOverlay();
    window.location.href = phoneHref("sms", msg);
  };
  if (!navigator.geolocation) return go(base + " Please call me.", "no location");
  openOverlay({ title: "Finding where you are…", body: "Please wait a moment.", actions: btn("btn-soft", "close-overlay", "Cancel") });
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const link = "https://maps.google.com/?q=" + pos.coords.latitude.toFixed(5) + "," + pos.coords.longitude.toFixed(5);
      go(base + " I am here: " + link, link);
    },
    () => go(base + " Please call me.", "location not available"),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  );
}

function hurtHelp() {
  say("Where does it hurt? Tap the picture.");
  openOverlay({
    title: "Where does it hurt?",
    body: "Tap the place that hurts.",
    actions:
      `<div class="pain-grid">${PAIN_AREAS.map((a) =>
        `<button class="btn btn-soft" type="button" data-action="pain" data-id="${a.id}">${a.label}</button>`).join("")}</div>` +
      closeBtn()
  });
}

function painLevel(id) {
  const area = PAIN_AREAS.find((a) => a.id === id);
  if (!area) return;
  if (area.urgent) return painReport(id, 8);
  say("How much does it hurt?");
  openOverlay({
    title: "How much does it hurt?",
    body: painLabel(id),
    actions: `<div class="pain-grid">${PAIN_LEVELS.map((l) =>
      `<button class="btn btn-soft" type="button" data-action="pain-level" data-id="${id}" data-n="${l.n}">${l.label}</button>`).join("")}</div>` +
      btn("btn-soft", "close-overlay", "Cancel")
  });
}

function painReport(id, level) {
  const area = PAIN_AREAS.find((a) => a.id === id);
  if (!area) return;
  logEvent("pain", id + ":" + level);
  renderPatterns();
  const where = painLabel(id).toLowerCase();
  const sms = phoneHref("sms", "I have pain: " + where + ", " + level + " out of 10. Please call me.");
  if (area.urgent) return heartHelp();
  const severe = level >= 8;
  const text = severe
    ? "That sounds very painful. Let’s get " + helperName() + " to help now."
    : "Thank you for telling me. Let’s tell " + helperName() + " about the pain.";
  say(text);
  openOverlay({
    title: "Pain: " + where,
    body: text,
    actions:
      (sms ? `<a class="btn btn-warn link-btn" href="${escapeHtml(sms)}" data-log="text">💬 Text ${escapeHtml(helperName())}</a>` : "") +
      btn(severe ? "btn-danger" : "btn-soft", "sos", "📞 Call " + escapeHtml(helperName())) +
      closeBtn()
  });
}

function fallHelp() {
  vibrate([200, 80, 200]);
  logEvent("fall");
  renderPatterns();
  const text = "Stay still for a moment. Take a slow breath. Do not rush to get up. If you are hurt, or hit your head, call for help.";
  say(text);
  openOverlay({
    title: "Stay still for a moment",
    body: text,
    actions:
      btn("btn-danger", "sos", "📞 Call " + escapeHtml(helperName())) +
      btn("btn-danger", "emergency", emergencyLabel()) +
      btn("btn-warn", "alarm", "📢 Loud alarm") +
      btn("btn-ok", "fall-ok", "I am not hurt"),
    urgent: true
  });
}

function fallOk() {
  const text = "Get up slowly. Roll onto your side, then onto your hands and knees. Hold on to a strong chair and rest before you stand. Please tell " + helperName() + " that you fell.";
  say(text);
  openOverlay({
    title: "Get up slowly",
    body: text,
    actions: btn("btn-warn", "text-fall", "💬 Tell " + escapeHtml(helperName())) + closeBtn()
  });
}

function unwellHelp() {
  logEvent("unwell");
  renderPatterns();
  const text = "I am sorry you feel unwell. Let’s write down how you feel, or tell " + helperName() + ".";
  say(text);
  openOverlay({
    title: "You feel unwell",
    body: text,
    actions:
      btn("btn-soft", "go-symptoms", "🩺 Say how my body feels") +
      btn("btn-soft", "go-reading", "📈 Take a reading") +
      btn("btn-warn", "text-unwell", "💬 Text " + escapeHtml(helperName())) +
      btn("btn-danger", "sos", "📞 Call " + escapeHtml(helperName())) +
      closeBtn()
  });
}

function heartHelp() {
  logEvent("heart");
  renderPatterns();
  vibrate([200, 80, 200]);
  const text = "Sit down and rest now. Loosen tight clothing. If the chest pain is strong, feels like pressure or squeezing, spreads to the arm, jaw or back, or comes with breathlessness, sweating or feeling sick, call the emergency number now. If the doctor gave you a spray or tablet for chest pain, use it as they told you.";
  say(text);
  openOverlay({
    title: "Sit down and rest",
    body: text,
    actions:
      btn("btn-danger", "emergency", emergencyLabel()) +
      btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) +
      btn("btn-soft", "vital-add-type", "💓 Record my pulse", 'data-id="pulse"') +
      closeBtn(),
    urgent: true
  });
}

function lowSugarHelp() {
  logEvent("lowsugar");
  renderPatterns();
  const low = state.units.sugar === "mmol" ? "4" : "70";
  const html = `<p class="big-line">Have something sugary now</p>
    <ol class="steps">
      <li>If you can, check your blood sugar. Low is under ${low} ${escapeHtml(sugarUnit())}.</li>
      <li>Have fast sugar: half a glass of fruit juice or regular soft drink, 3 to 4 glucose tablets, or 1 tablespoon of sugar in water.</li>
      <li>Wait 15 minutes, then check again. If it is still low, have fast sugar again.</li>
      <li>When you feel better, eat a snack or your next meal.</li>
    </ol>
    <p class="alert alert-danger">If the person is very drowsy, can’t swallow safely, or is unconscious, do not give food or drink. Call the emergency number.</p>`;
  say("Have something sugary now. Half a glass of juice, glucose tablets, or a spoon of sugar in water. Wait 15 minutes, then check again.");
  openOverlay({
    title: "🍬 Low sugar steps",
    html,
    actions:
      btn("btn-main", "timer", "⏱️ Remind me in 15 minutes", 'data-min="15" data-text="Check your blood sugar again."') +
      btn("btn-soft", "vital-add-type", "🩸 Record my sugar", 'data-id="sugar"') +
      btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) +
      btn("btn-danger", "emergency", emergencyLabel()) +
      closeBtn(),
    urgent: true
  });
}

function breathlessHelp() {
  logEvent("breathless");
  renderPatterns();
  const html = `<ol class="steps">
      <li>Sit upright. Lean forward a little with your hands on your knees.</li>
      <li>Breathe in gently through your nose. Breathe out slowly through pursed lips, as if blowing out a candle.</li>
      <li>If the doctor gave you a reliever inhaler, use it as they told you.</li>
      <li>Open a window or use a fan on your face.</li>
    </ol>
    <p class="alert alert-danger">Call the emergency number now if lips or face turn blue or grey, you can’t speak in full sentences, you feel drowsy or confused, or it keeps getting worse.</p>`;
  say("Sit upright and lean forward a little. Breathe in through your nose, and out slowly through pursed lips. If you can't speak in sentences, or your lips turn blue, call the emergency number now.");
  openOverlay({
    title: "🫁 Hard to breathe",
    html,
    actions:
      btn("btn-danger", "emergency", emergencyLabel()) +
      btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) +
      btn("btn-soft", "vital-add-type", "🫁 Record my oxygen", 'data-id="spo2"') +
      closeBtn(),
    urgent: true
  });
}

function strokeHelp() {
  logEvent("stroke");
  renderPatterns();
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const html = `<p>Look for any of these, starting suddenly:</p>
    <ul class="steps">
      <li><strong>Face</strong>: one side droops. Ask them to smile.</li>
      <li><strong>Arms</strong>: one arm is weak or drifts down. Ask them to raise both.</li>
      <li><strong>Speech</strong>: slurred, strange, or can’t find words.</li>
      <li><strong>Balance or eyes</strong>: sudden dizziness, falling, or loss of sight.</li>
    </ul>
    <p class="alert alert-danger">If you see any sign, call the emergency number now. Every minute matters. The time now is ${escapeHtml(time)}; tell them when the signs began.</p>`;
  say("Check the face, the arms, and the speech. If any of these changed suddenly, call the emergency number now.");
  openOverlay({
    title: "🧩 Stroke signs",
    html,
    actions: btn("btn-danger", "emergency", emergencyLabel()) + btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) + closeBtn(),
    urgent: true
  });
}

function seizureHelp() {
  const start = Date.now();
  const html = `<p class="seizure-clock" id="seizureClock">0:00</p>
    <ul class="steps">
      <li>Stay with them. Move hard or sharp things away.</li>
      <li>Cushion their head. Loosen anything tight around the neck.</li>
      <li>Do not hold them down. Do not put anything in their mouth.</li>
      <li>If they have emergency seizure medicine, give it as the doctor planned.</li>
    </ul>
    <p class="alert alert-danger" id="seizureWarn">Call the emergency number if it lasts more than 5 minutes, another seizure starts, they are injured, or they don’t wake up.</p>`;
  openOverlay({
    title: "⏱️ Seizure timer",
    html,
    actions: btn("btn-ok", "seizure-stop", "It has stopped", `data-start="${start}"`) +
      btn("btn-danger", "emergency", emergencyLabel()) +
      btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())),
    urgent: true
  });
  say("Timer started. Stay with them and keep them safe.");
  let warned = false;
  seizureTimer = setInterval(() => {
    const s = Math.floor((Date.now() - start) / 1000);
    const el = $("seizureClock");
    if (!el) return;
    el.textContent = Math.floor(s / 60) + ":" + pad(s % 60);
    if (s >= 300 && !warned) {
      warned = true;
      el.classList.add("over");
      vibrate([500, 200, 500, 200, 500]);
      say("It has been 5 minutes. Call the emergency number now.", true);
    }
  }, 1000);
}

function seizureStop(start) {
  const s = Math.max(0, Math.floor((Date.now() - Number(start)) / 1000));
  const dur = Math.floor(s / 60) + " min " + pad(s % 60) + " s";
  logEvent("seizure", dur);
  renderPatterns();
  const text = "The seizure lasted " + Math.floor(s / 60) + " minutes and " + (s % 60) + " seconds. Gently roll them onto their side. Stay with them, and speak calmly, until they are fully awake. Call the emergency number if they are hurt, have trouble breathing, or do not wake up.";
  say(text);
  openOverlay({
    title: "After the seizure",
    html: `<p class="big-line">${escapeHtml(dur)}</p><p>${escapeHtml(text.replace(/^The seizure lasted [^.]+\. /, ""))}</p>`,
    actions: btn("btn-danger", "emergency", emergencyLabel()) +
      btn("btn-warn", "text-seizure", "💬 Tell " + escapeHtml(helperName()), `data-id="${escapeHtml(dur)}"`) + closeBtn()
  });
}

function woundHelp() {
  const html = `<p>Call the doctor or surgery team today if you notice:</p>
    <ul class="steps">
      <li>Redness or swelling that is spreading, or the wound feels hot</li>
      <li>Pus, a bad smell, or the wound opening</li>
      <li>A temperature of 38°C (100.4°F) or more, or shivering</li>
      <li>One calf that is swollen, red or painful</li>
    </ul>
    <p class="alert alert-danger">Call the emergency number for sudden breathlessness, chest pain, or heavy bleeding that doesn’t stop with firm pressure.</p>`;
  say("Here are the signs to watch for. Call the doctor today if the wound is red, hot, oozing or opening, or if you have a fever.");
  openOverlay({
    title: "🩹 Wound or fever worry",
    html,
    actions: btn("btn-soft", "vital-add-type", "🌡️ Record my temperature", 'data-id="temp"') +
      btn("btn-soft", "symptom", "📝 Note sore skin or wound", 'data-id="skin"') +
      btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) + closeBtn()
  });
}

function overwhelmedHelp() {
  logEvent("overwhelmed");
  renderPatterns();
  const crisis = cleanPhone(state.helper.crisisPhone);
  const text = "Thank you for telling me. Strong feelings pass. You don't have to deal with this alone. Let's slow down together.";
  say(text);
  openOverlay({
    title: "You are not alone",
    html: `<p>${escapeHtml(text)}</p><p class="sub">If you might hurt yourself, or you are in danger, call the emergency number now.</p>`,
    actions:
      btn("btn-soft", "breathe", "🌬️ Breathe with me") +
      btn("btn-soft", "grounding", "🖐️ Notice 5 things") +
      btn("btn-warn", "sos", "📞 Call " + escapeHtml(helperName())) +
      (crisis ? `<a class="btn btn-warn link-btn" href="tel:${escapeHtml(crisis)}" data-log="call">📞 Call ${escapeHtml(state.helper.crisisName || "support line")}</a>` : "") +
      btn("btn-danger", "emergency", emergencyLabel()) +
      closeBtn()
  });
}

const GROUND_STEPS = [
  ["👀", "Look around. Find 5 things you can see. Say them out loud, or in your head."],
  ["✋", "Find 4 things you can touch. Feel your chair, your clothes, the floor under your feet."],
  ["👂", "Listen. Find 3 things you can hear."],
  ["👃", "Find 2 things you can smell, or 2 smells you like."],
  ["👅", "Find 1 thing you can taste, or take a sip of water."],
  ["💙", "Well done. You are here, right now, and you are safe."]
];

function groundingStep(step) {
  groundStep = step;
  const [icon, text] = GROUND_STEPS[step];
  say(text);
  const last = step === GROUND_STEPS.length - 1;
  openOverlay({
    title: "Notice what is around you",
    html: `<p class="ground-icon">${icon}</p><p class="big-line">${escapeHtml(text)}</p><p class="sub">Step ${step + 1} of ${GROUND_STEPS.length}</p>`,
    actions: (last ? "" : btn("btn-main", "ground-next", "Next")) + btn(last ? "btn-main" : "btn-soft", "close-overlay", last ? "I feel calmer" : "Stop")
  });
}

function medicalCard() {
  const p = state.profile;
  const h = state.helper;
  const meds = state.meds.map((m) => {
    const rec = medRecord(m.id);
    const prn = m.when === "As needed" && lastPrn(m.id);
    return escapeHtml(m.name + (m.dose ? " " + m.dose : "")) + " (" + escapeHtml(m.when.toLowerCase()) + ")" +
      (rec && rec.at ? ". Taken today at " + escapeHtml(clockOf(rec.at)) : "") +
      (prn && dayOf(prn) === todayStr() ? ". Last dose " + escapeHtml(clockOf(prn)) : "");
  });
  const latest = VITAL_ORDER.map((t) => {
    const list = readingsOf(t);
    const r = list[list.length - 1];
    return r && Date.now() - new Date(r.t).getTime() < 3 * DAY_MS ? escapeHtml(VITALS[t].label + ": " + formatVital(r) + " (" + shortDateTime(r.t) + ")") : "";
  }).filter(Boolean);
  const age = ageOf(p.dob);
  const row = (label, value) => `<p><strong>${label}</strong><br>${value}</p>`;
  openOverlay({
    title: "Medical information",
    html: `<div class="med-card">
      ${row("Name", escapeHtml((p.name || "Not set") + (age ? ", age " + age : "")))}
      ${p.dob ? row("Date of birth", escapeHtml(new Date(p.dob).toLocaleDateString())) : ""}
      ${row("Health conditions", escapeHtml(p.diagnosis || "Not written"))}
      ${row("Allergies", escapeHtml(p.allergies || "None written"))}
      ${row("Medicines to avoid", escapeHtml(p.avoid || "None written"))}
      ${row("Current medicines", meds.length ? meds.join("<br>") : "None listed")}
      ${latest.length ? row("Recent readings", latest.join("<br>")) : ""}
      ${p.blood ? row("Blood group", escapeHtml(p.blood)) : ""}
      ${p.devices ? row("Devices and aids", escapeHtml(p.devices)) : ""}
      ${p.language ? row("Languages", escapeHtml(p.language)) : ""}
      ${p.howTo ? row("How best to help me", escapeHtml(p.howTo)) : ""}
      ${p.wishes ? row("Important wishes", escapeHtml(p.wishes)) : ""}
      ${row("Doctor", escapeHtml(p.doctor || "Not set"))}
      ${row("Contact", escapeHtml((h.name || "Helper") + " " + (h.phone || "")) + (h.backupPhone ? "<br>" + escapeHtml((h.backupName || "Backup") + " " + h.backupPhone) : ""))}
    </div>`,
    actions: closeBtn()
  });
}

function startBreathing() {
  openOverlay({
    title: "Breathe with me",
    body: "Follow the circle. Slow is best.",
    actions: btn("btn-main", "close-overlay", "I feel calmer"),
    breath: true
  });
  const circle = $("breathCircle");
  const cue = $("breathCue");
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
  const items = remainingItems();
  if (!items.length) {
    say("There is nothing more on today’s plan. You can rest.");
    return;
  }
  say("Here is the rest of today. " + items.map((item) => prettyTime(item.time) + ", " + item.text.replace(/\p{Extended_Pictographic}/gu, "").trim()).join(". "));
}

function somethingToDo() {
  if (!state.activities.length) return;
  const pool = state.activities.length > 1
    ? state.activities.filter((a) => a.id !== lastActivityId)
    : state.activities;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastActivityId = pick.id;
  say("How about this? " + pick.text + ".");
  openOverlay({
    title: "How about this?",
    html: `<p class="big-line">${escapeHtml(pick.text)}</p>`,
    actions:
      btn("btn-ok", "activity-done", "👍 Let’s do it", `data-id="${pick.id}"`) +
      btn("btn-soft", "something-to-do", "🔄 Another idea") +
      closeBtn()
  });
}

function askQuestion(id) {
  const item = state.qa.find((x) => x.id === id);
  if (!item) return;
  logEvent("question", id);
  say(item.a);
  openOverlay({
    title: item.q,
    html: `<p class="big-line">${escapeHtml(item.a)}</p>`,
    actions: btn("btn-soft", "ask-qa", "🔊 Hear it again", `data-id="${id}"`) + closeBtn()
  });
}

function sos(phone, name) {
  const num = phone || state.helper.phone;
  if (!num) return needHelper();
  vibrate([200, 80, 200]);
  logEvent("sos", name || state.helper.name);
  say("Calling " + (name || helperName()) + " now.");
  window.location.href = phoneHref("tel", "", num);
}

function callEmergency() {
  const num = state.helper.emergency || "112";
  logEvent("emergency", num);
  window.location.href = "tel:" + cleanPhone(num);
}

function textHelper(body) {
  if (!state.helper.phone) return needHelper();
  logEvent("text", body || "");
  window.location.href = phoneHref("sms", body);
}

function checkIn() {
  state.checkIn = new Date().toISOString();
  state.pendingCheck = null;
  stopAlarm();
  logEvent("checkin");
  renderHelper();
  renderPatterns();
  say("Thank you. You are okay, and you are safe.");
  openOverlay({
    title: "You are okay",
    body: "This time was saved: " + new Date(state.checkIn).toLocaleString() + ".",
    actions: closeBtn()
  });
}

function checkInPrompt(key) {
  state.pendingCheck = { at: new Date().toISOString(), key, escalated: false };
  save();
  vibrate([200, 100, 200]);
  say("Hello. Are you okay? Please tap a button.");
  openOverlay({
    title: "Are you okay?",
    html: `<p class="big-line">Please tap a button.</p>`,
    actions: btn("btn-ok", "check-in", "✅ Yes, I am okay") + btn("btn-danger", "checkin-help", "🙋 I need help"),
    urgent: true
  });
  notify("Are you okay?", "Tap to answer the check-in.");
}

function escalateCheckIn() {
  if (!state.pendingCheck || state.pendingCheck.escalated) return;
  state.pendingCheck.escalated = true;
  logEvent("missed", prettyTime(state.pendingCheck.key || nowHM()));
  renderPatterns();
  openOverlay({
    title: "No answer to the check-in",
    html: `<p class="big-line">Is everyone okay?</p><p>${escapeHtml(state.profile.name || "The person")} did not answer the ${escapeHtml(prettyTime(state.pendingCheck.key || nowHM()))} check-in. Please check on them${state.helper.phone ? " and call " + escapeHtml(helperName()) : ""}.</p>`,
    actions: btn("btn-ok", "check-in", "✅ I am okay – stop alarm") + btn("btn-danger", "sos", "📞 Call " + escapeHtml(helperName())),
    urgent: true
  });
  startAlarm(2);
  notify("No answer to the check-in", "Please check on " + (state.profile.name || "the person") + ".");
}

function startTimer(min, text) {
  const at = new Date(Date.now() + Number(min) * 60000).toISOString();
  state.timers.push({ id: uid("t"), at, text });
  save();
  say("I will remind you at " + clockOf(at) + ".");
  openOverlay({ title: "Timer set", body: "I will remind you at " + clockOf(at) + ": " + text, actions: closeBtn() });
}

/* ---------------- editing ---------------- */

function addReminder() {
  const text = $("remText").value.trim();
  const time = $("remTime").value;
  if (!text || !time) {
    say("Please type a reminder and a time.");
    openOverlay({ title: "Reminder not saved", body: "Type what to remember and choose a time.", actions: closeBtn() });
    return;
  }
  state.reminders.push({ id: uid("r"), text, time, lastFired: "" });
  $("remText").value = "";
  $("remTime").value = "";
  save();
  renderReminders();
  renderNextUp();
  say("Reminder saved for " + prettyTime(time));
}

function addSchedule() {
  const text = $("schedText").value.trim();
  const time = $("schedTime").value;
  if (!text || !time) return;
  state.schedule.push({ id: uid("s"), text, time });
  $("schedText").value = "";
  $("schedTime").value = "";
  save();
  renderSchedule();
  renderNextUp();
}

function addMed() {
  const name = $("medName").value.trim();
  if (!name) {
    openOverlay({ title: "Medicine not saved", body: "Type the medicine name first.", actions: closeBtn() });
    return;
  }
  const med = {
    id: uid("m"),
    name,
    when: $("medWhen").value,
    dose: $("medDose").value.trim(),
    time: $("medTime").value,
    instr: $("medInstr").value.trim()
  };
  if (med.when === "As needed") {
    med.time = "";
    if ($("medGap").value) med.gap = Number($("medGap").value);
    if ($("medMax").value) med.max = Number($("medMax").value);
  }
  if ($("medStock").value !== "") med.stock = Math.max(0, Math.round(Number($("medStock").value)) || 0);
  state.meds.push(med);
  ["medName", "medDose", "medTime", "medInstr", "medGap", "medMax", "medStock"].forEach((id) => { $(id).value = ""; });
  save();
  renderMeds();
  renderMe();
  renderNextUp();
  say(name + " has been added.");
}

function addAppointment() {
  const title = $("apptTitle").value.trim();
  const date = $("apptDate").value;
  if (!title || !date) {
    openOverlay({ title: "Appointment not saved", body: "Type what it is and choose a date.", actions: closeBtn() });
    return;
  }
  state.appointments.push({
    id: uid("ap"), title, date, time: $("apptTime").value,
    place: $("apptPlace").value.trim(), note: $("apptNote").value.trim()
  });
  ["apptTitle", "apptDate", "apptTime", "apptPlace", "apptNote"].forEach((id) => { $(id).value = ""; });
  save();
  renderAppointments();
  renderNextUp();
  say("Appointment saved for " + prettyDate(date) + ".");
}

function addExercise() {
  const text = $("exText").value.trim();
  if (!text) return;
  state.exercises.push({ id: uid("e"), text, how: $("exHow").value.trim() });
  $("exText").value = "";
  $("exHow").value = "";
  save();
  renderExercises();
}

function addPhrase() {
  const text = $("phraseText").value.trim();
  if (!text) return;
  state.phrases.push({ id: uid("ph"), text, icon: $("phraseIcon").value.trim() || "💬" });
  $("phraseText").value = "";
  $("phraseIcon").value = "";
  save();
  renderPhrases();
}

function addJournal() {
  const text = $("jText").value.trim();
  if (!text) return;
  state.journal.push({ id: uid("j"), t: new Date().toISOString(), author: $("jAuthor").value.trim(), text });
  if (state.journal.length > 300) state.journal = state.journal.slice(-300);
  $("jText").value = "";
  save();
  renderJournal();
}

function addCheckTime() {
  const t = $("checkTime").value;
  if (!t || state.checkTimes.includes(t)) return;
  state.checkTimes.push(t);
  $("checkTime").value = "";
  save();
  renderCheckTimes();
}

async function scaledCanvas(file, max) {
  const img = await blobToImage(file);
  const canvas = document.createElement("canvas");
  let { width, height } = img;
  if (width > height && width > max) {
    height = height * max / width;
    width = max;
  } else if (height > max) {
    width = width * max / height;
    height = max;
  }
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // JPEG has no transparency; keep see-through parts white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function fileToDataUrl(file) {
  if (!file) return "";
  return (await scaledCanvas(file, 360)).toDataURL("image/jpeg", 0.72);
}

async function fileToJpegBlob(file, max) {
  const canvas = await scaledCanvas(file, max);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/jpeg", 0.8);
  });
}

function blobToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function safePhoto(file) {
  try {
    return await fileToDataUrl(file);
  } catch {
    openOverlay({ title: "Photo not added", body: "That photo could not be opened. Try a different picture.", actions: closeBtn() });
    return "";
  }
}

async function addPerson() {
  const name = $("personName").value.trim();
  if (!name) return;
  const photo = await safePhoto($("personPhoto").files[0]);
  state.people.push({
    id: uid("p"),
    name,
    relation: $("personRelation").value.trim(),
    note: $("personNote").value.trim(),
    phone: $("personPhone").value.trim(),
    photo
  });
  if (!save()) {
    state.people.pop();
    return;
  }
  ["personName", "personRelation", "personNote", "personPhone", "personPhoto"].forEach((id) => { $(id).value = ""; });
  renderPeople();
  say(name + " has been added.");
}

function sayPerson(id) {
  const person = state.people.find((p) => p.id === id);
  if (!person) return;
  const bits = ["This is " + person.name + "."];
  if (person.relation) bits.push(person.relation + ".");
  if (person.note) bits.push(person.note + ".");
  if (hasFocus("memory")) bits.push("You know this person.");
  const text = bits.join(" ");
  say(text);
  const tel = person.phone ? phoneHref("tel", "", person.phone) : "";
  openOverlay({
    title: person.name,
    html: (person.photo ? `<img class="overlay-photo" src="${escapeHtml(person.photo)}" alt="">` : "") + `<p>${escapeHtml(text)}</p>`,
    actions:
      (tel ? `<a class="btn btn-ok link-btn" href="${escapeHtml(tel)}" data-log="call" data-detail="${escapeHtml(person.name)}">📞 Call ${escapeHtml(person.name)}</a>` : "") +
      closeBtn() +
      `<button class="btn btn-tiny carer-only" type="button" data-action="del-person" data-id="${person.id}">Remove this person</button>`
  });
}

/* ---------------- memory book ---------------- */

// Photos and voice notes are too big for localStorage, so they are kept in IndexedDB.
// Keys are "ph:<memoryId>" and "vo:<memoryId>".

let mediaDb = null;

function openMediaDb() {
  if (mediaDb) return mediaDb;
  mediaDb = new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("no indexedDB"));
    const req = indexedDB.open("care-companion-media", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("media");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  mediaDb.catch(() => { mediaDb = null; });
  return mediaDb;
}

async function mediaTx(mode, fn) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("media", mode);
    const result = fn(tx.objectStore("media"));
    tx.oncomplete = () => resolve(result && "result" in result ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const mediaGet = (key) => mediaTx("readonly", (store) => store.get(key));
const mediaPut = (key, blob) => mediaTx("readwrite", (store) => { store.put(blob, key); });
const mediaDel = (keys) => mediaTx("readwrite", (store) => { keys.forEach((k) => store.delete(k)); });

async function mediaUrl(key) {
  if (mediaUrls[key]) return mediaUrls[key];
  const blob = await mediaGet(key);
  if (!blob) return "";
  mediaUrls[key] = URL.createObjectURL(blob);
  return mediaUrls[key];
}

function forgetMediaUrls(keys) {
  keys.forEach((k) => {
    if (mediaUrls[k]) URL.revokeObjectURL(mediaUrls[k]);
    delete mediaUrls[k];
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function exportMedia() {
  const out = {};
  for (const m of state.memories) {
    for (const [flag, key] of [[m.photo, "ph:" + m.id], [m.voice, "vo:" + m.id]]) {
      if (!flag) continue;
      const blob = await mediaGet(key);
      if (blob) out[key] = await blobToDataUrl(blob);
    }
  }
  return out;
}

async function importMedia(media) {
  const keys = Object.keys(media).filter((k) => /^(ph|vo):/.test(k) && typeof media[k] === "string" && media[k].startsWith("data:"));
  for (const key of keys) {
    const blob = await (await fetch(media[key])).blob();
    forgetMediaUrls([key]);
    await mediaPut(key, blob);
  }
}

function memoryMeta(m) {
  return [m.year, m.by ? "Voice of " + m.by : ""].filter(Boolean).join(" · ");
}

function renderMemories() {
  const grid = $("memoryGrid");
  $("memoryPlayBtn").classList.toggle("hidden", !state.memories.length);
  $("calmMemoryBtn").classList.toggle("hidden", !state.memories.length);
  if (!state.memories.length) {
    grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Add old photos with a few words, or a voice note from family. Familiar faces and voices can bring comfort on hard days.</p>';
    return;
  }
  grid.innerHTML = state.memories.map((m) => `<button class="memory" type="button" data-action="memory-open" data-id="${m.id}">
      <span class="memory-thumb" data-photo="${m.photo ? "ph:" + m.id : ""}">${m.photo ? "" : "📖"}</span>
      <strong>${escapeHtml(m.title)}</strong>
      <span>${escapeHtml(m.year || "")}${m.voice ? " 🔊" : ""}</span>
    </button>`).join("");
  grid.querySelectorAll("[data-photo]").forEach(async (el) => {
    const key = el.dataset.photo;
    if (!key) return;
    try {
      const url = await mediaUrl(key);
      if (url) el.style.backgroundImage = `url("${url}")`;
    } catch { /* thumbnail stays plain */ }
  });
}

function stopMemoryPlayback() {
  if (memoryTimer) {
    clearTimeout(memoryTimer);
    memoryTimer = null;
  }
  if (memoryAudio) {
    memoryAudio.onended = null;
    memoryAudio.pause();
    memoryAudio = null;
  }
}

function memorySpeech(m) {
  return [m.title, m.year ? "In " + m.year + "." : "", m.caption].filter(Boolean).join(". ").replace(/\.\./g, ".");
}

// Plays the family voice note, or reads the words aloud if there is no voice note
async function playMemoryVoice(m, auto) {
  if (!m) return;
  stopMemoryPlayback();
  const next = () => {
    if (auto && memoryAuto) memoryTimer = setTimeout(() => openMemory(memoryIndex + 1, true), MEMORY_GAP);
  };
  if (m.voice) {
    try {
      const url = await mediaUrl("vo:" + m.id);
      if (url && state.memories[memoryIndex] === m) {
        window.speechSynthesis && speechSynthesis.cancel();
        memoryAudio = new Audio(url);
        memoryAudio.onended = next;
        await memoryAudio.play();
        return;
      }
    } catch { /* fall back to reading the words */ }
  }
  say(memorySpeech(m), true);
  // Rough reading time, so the slideshow does not move on mid-sentence
  if (auto) memoryTimer = setTimeout(next, Math.max(4000, memorySpeech(m).split(" ").length * 500));
}

async function openMemory(index, auto) {
  const count = state.memories.length;
  if (!count || index < 0) return;
  if (auto && index >= count) {
    memoryAuto = false;
    say("That was all your memories. You are loved.", true);
    return openOverlay({
      title: "That was all of them",
      html: '<p class="big-line">You are loved.</p>',
      actions: btn("btn-soft", "memory-play", "🔁 Watch again") + closeBtn()
    });
  }
  memoryIndex = (index + count) % count;
  const m = state.memories[memoryIndex];
  openOverlay({
    title: m.title,
    html: `<div class="memory-photo-wrap">${m.photo ? '<img class="memory-photo" id="memoryPhoto" alt="">' : '<div class="memory-photo memory-blank">📖</div>'}</div>
      ${memoryMeta(m) ? `<p class="sub">${escapeHtml(memoryMeta(m))}</p>` : ""}
      ${m.caption ? `<p class="memory-caption">${escapeHtml(m.caption)}</p>` : ""}
      <p class="sub">${memoryIndex + 1} of ${count}</p>`,
    actions:
      `<div class="help-grid">${btn("btn-soft", "memory-prev", "⏮ Back")}${btn("btn-soft", "memory-next", "Next ⏭")}</div>` +
      btn("btn-soft", "memory-voice", m.voice ? "🔊 Hear the voice again" : "🔊 Read it again") +
      (auto ? btn("btn-soft", "memory-stop-auto", "⏸ Stop the slideshow") : btn("btn-soft", "memory-play", "▶️ Play all memories")) +
      closeBtn() +
      `<button class="btn btn-tiny carer-only" type="button" data-action="del-memory" data-id="${m.id}">Remove this memory</button>`
  });
  memoryAuto = !!auto;
  if (m.photo) {
    mediaUrl("ph:" + m.id).then((url) => {
      const img = $("memoryPhoto");
      if (img && url && state.memories[memoryIndex] === m) img.src = url;
    }).catch(() => {});
  }
  logEvent("memory", m.title);
  playMemoryVoice(m, auto);
}

/* recording a voice note */

function voiceMime() {
  if (!window.MediaRecorder) return "";
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function setVoiceStatus(text) {
  $("memVoiceStatus").textContent = text;
  $("memVoiceRecord").classList.toggle("hidden", !!recorder);
  $("memVoiceStop").classList.toggle("hidden", !recorder);
  $("memVoiceClear").classList.toggle("hidden", !pendingVoice || !!recorder);
  const preview = $("memVoicePreview");
  if (preview.src) URL.revokeObjectURL(preview.src);
  if (pendingVoice && !recorder) {
    preview.src = URL.createObjectURL(pendingVoice);
    preview.classList.remove("hidden");
  } else {
    preview.removeAttribute("src");
    preview.classList.add("hidden");
  }
}

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    return openOverlay({ title: "Recording is not available", body: "This browser can’t record sound. You can choose a voice note file instead, such as one sent on WhatsApp.", actions: closeBtn() });
  }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return openOverlay({ title: "Microphone not allowed", body: "Allow the microphone for this app in the browser or phone settings, then try again.", actions: closeBtn() });
  }
  const type = voiceMime();
  const chunks = [];
  recorder = new MediaRecorder(recordStream, type ? { mimeType: type } : undefined);
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    recordStream.getTracks().forEach((t) => t.stop());
    recordStream = null;
    clearInterval(recordTimer);
    pendingVoice = chunks.length ? new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" }) : null;
    recorder = null;
    $("memVoiceFile").value = "";
    setVoiceStatus(pendingVoice ? "Voice note ready. Play it below to check it." : "Nothing was recorded. Try again.");
  };
  const started = Date.now();
  recorder.start();
  setVoiceStatus("Recording… 0:00");
  recordTimer = setInterval(() => {
    const secs = Math.floor((Date.now() - started) / 1000);
    if (secs >= VOICE_MAX_SECONDS) return stopRecording();
    $("memVoiceStatus").textContent = "Recording… " + Math.floor(secs / 60) + ":" + pad(secs % 60);
  }, 500);
}

function stopRecording() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
}

function clearPendingVoice() {
  pendingVoice = null;
  $("memVoiceFile").value = "";
  setVoiceStatus("");
}

function useVoiceFile(file) {
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    $("memVoiceFile").value = "";
    return openOverlay({ title: "Not a sound file", body: "Choose a voice recording or other sound file.", actions: closeBtn() });
  }
  pendingVoice = file;
  setVoiceStatus("Voice note ready. Play it below to check it.");
}

let savingMemory = false;

async function addMemory() {
  if (savingMemory) return; // a big photo can take a moment; ignore a second tap
  savingMemory = true;
  try {
    await saveMemoryForm();
  } finally {
    savingMemory = false;
  }
}

async function saveMemoryForm() {
  const title = $("memTitle").value.trim();
  const file = $("memPhoto").files[0];
  if (!title) {
    say("Please write a short title first.");
    return $("memTitle").focus();
  }
  if (recorder) return say("Please stop the recording first.");
  const m = {
    id: uid("mem"),
    title,
    year: $("memYear").value.trim(),
    caption: $("memCaption").value.trim(),
    by: $("memBy").value.trim(),
    photo: false,
    voice: false,
    at: new Date().toISOString()
  };
  try {
    if (file) {
      let photo;
      try {
        photo = await fileToJpegBlob(file, 1024);
      } catch {
        return openOverlay({ title: "Photo not added", body: "That photo could not be opened. Try a different picture.", actions: closeBtn() });
      }
      await mediaPut("ph:" + m.id, photo);
      m.photo = true;
    }
    if (pendingVoice) {
      await mediaPut("vo:" + m.id, pendingVoice);
      m.voice = true;
    }
  } catch {
    mediaDel(["ph:" + m.id, "vo:" + m.id]).catch(() => {});
    return openOverlay({ title: "Memory not saved", body: "The phone’s storage for this app may be full, or this browser is in private mode. Try a smaller photo or a shorter voice note.", actions: closeBtn() });
  }
  state.memories.push(m);
  if (!save()) {
    state.memories.pop();
    mediaDel(["ph:" + m.id, "vo:" + m.id]).catch(() => {});
    return;
  }
  // Ask the browser not to clear the app's storage when space runs low
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  ["memTitle", "memYear", "memCaption", "memBy", "memPhoto"].forEach((id) => { $(id).value = ""; });
  clearPendingVoice();
  renderMemories();
  say("The memory has been added.");
}

function deleteMemory(id) {
  const keys = ["ph:" + id, "vo:" + id];
  state.memories = state.memories.filter((m) => m.id !== id);
  save();
  closeOverlay();
  forgetMediaUrls(keys);
  mediaDel(keys).catch(() => {});
  renderMemories();
}

async function saveProfile() {
  const file = $("profilePhoto").files[0];
  const photo = file ? (await safePhoto(file)) || state.profile.photo : state.profile.photo;
  const v = (id) => $(id).value.trim();
  state.profile = {
    name: v("profileName"),
    dob: v("profileDob"),
    address: v("profileAddress"),
    diagnosis: v("profileDiagnosis"),
    allergies: v("profileAllergies"),
    avoid: v("profileAvoid"),
    blood: v("profileBlood"),
    devices: v("profileDevices"),
    language: v("profileLanguage"),
    howTo: v("profileHowTo"),
    doctor: v("profileDoctor"),
    wishes: v("profileWishes"),
    story: v("profileStory"),
    photo
  };
  $("profilePhoto").value = "";
  save();
  renderAll();
  say("Your details are saved.");
}

function saveHelper() {
  state.helper = {
    name: $("helperName").value.trim(),
    phone: $("helperPhone").value.trim(),
    backupName: $("backupName").value.trim(),
    backupPhone: $("backupPhone").value.trim(),
    emergency: $("emergencyNumber").value.trim() || "112",
    crisisName: $("crisisName").value.trim(),
    crisisPhone: $("crisisPhone").value.trim()
  };
  save();
  renderHelper();
  renderMe();
  say("Contacts saved.");
}

function saveNote() {
  state.note = { text: $("careNote").value.trim(), author: $("careAuthor").value.trim() };
  save();
  renderNote();
  say("The note is saved on the home screen.");
}

function addQA() {
  const q = $("qaQ").value.trim();
  const a = $("qaA").value.trim();
  if (!q || !a) return;
  state.qa.push({ id: uid("q"), q, a });
  $("qaQ").value = "";
  $("qaA").value = "";
  save();
  renderQA();
  renderEditors();
}

function addActivity() {
  const text = $("actText").value.trim();
  if (!text) return;
  state.activities.push({ id: uid("a"), text });
  $("actText").value = "";
  save();
  renderQA();
  renderEditors();
}

async function exportData() {
  const backup = { ...state };
  try {
    backup.media = await exportMedia();
  } catch {
    backup.media = {};
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "care-companion-backup-" + todayStr() + ".json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!isPlainObject(data) || !isPlainObject(data.profile)) throw new Error("bad file");
      const media = isPlainObject(data.media) ? data.media : {};
      delete data.media;
      await importMedia(media);
      state = migrate(merge(defaultState(), data));
      state.lastDay = "";
      state.setupDone = true;
      save();
      renderAll();
      openOverlay({ title: "Backup restored", body: "Everything from the backup file is back.", actions: closeBtn() });
    } catch {
      openOverlay({ title: "Backup not restored", body: "That file is not a Care Companion backup.", actions: closeBtn() });
    }
    $("importFile").value = "";
  };
  reader.readAsText(file);
}

/* ---------------- first-time setup ---------------- */

function startSetup() {
  openOverlay({
    title: "Welcome to Care Companion",
    html: `<div class="setup-flow">
      <p>A few details make the help buttons work. Everything stays on this phone, and you can change it later in Care and Me.</p>
      <label class="label" for="suName">Name of the person being cared for</label>
      <input id="suName" class="input" value="${escapeHtml(state.profile.name)}" placeholder="Robert">
      <label class="label" for="suHelper">Main helper’s name</label>
      <input id="suHelper" class="input" value="${escapeHtml(state.helper.name)}" placeholder="Anna">
      <label class="label" for="suPhone">Main helper’s phone</label>
      <input id="suPhone" class="input" type="tel" value="${escapeHtml(state.helper.phone)}" placeholder="+91 90000 00000">
      <label class="label" for="suEmergency">Emergency number</label>
      <input id="suEmergency" class="input" type="tel" value="${escapeHtml(state.helper.emergency || "112")}">
      <p class="label">What needs extra care? Choose any.</p>
      <div class="focus-list">${FOCUS.map((f) => `<label class="check-row">
        <input type="checkbox" data-su-focus="${f.id}" ${hasFocus(f.id) ? "checked" : ""}><span>${escapeHtml(f.label)}</span></label>`).join("")}</div>
    </div>`,
    actions: btn("btn-main", "setup-save", "Start using the app") + btn("btn-soft", "setup-skip", "Skip for now")
  });
}

function saveSetup() {
  const name = $("suName").value.trim();
  if (name) state.profile.name = name;
  state.helper.name = $("suHelper").value.trim() || state.helper.name;
  state.helper.phone = $("suPhone").value.trim() || state.helper.phone;
  state.helper.emergency = $("suEmergency").value.trim() || state.helper.emergency || "112";
  state.focus = [...document.querySelectorAll("[data-su-focus]")].filter((b) => b.checked).map((b) => b.dataset.suFocus);
  state.setupDone = true;
  save();
  closeOverlay();
  renderAll();
  say("All set." + (state.profile.name ? " Hello, " + state.profile.name + "." : ""));
}

/* ---------------- timed checks ---------------- */

function checkReminders() {
  const today = todayStr();
  const due = [];
  let dueMed = null;
  const once = (key) => {
    if (state.fired[key] === today) return false;
    state.fired[key] = today;
    return true;
  };

  state.reminders.forEach((item) => {
    if (isDue(item.time) && item.lastFired !== today) {
      item.lastFired = today;
      due.push(item.text);
    }
  });
  state.schedule.forEach((item) => {
    if (isDue(item.time) && state.scheduleDone[item.id] !== today && once(item.id)) due.push(item.text);
  });
  scheduledMeds().forEach((m) => {
    if (!m.time || medRecord(m.id)) return;
    const label = m.name + (m.dose ? " (" + m.dose + ")" : "");
    if (isDue(m.time) && once("med:" + m.id)) {
      due.push("Time for your " + label);
      dueMed = dueMed || m;
    } else if (isDue(addMinutesHM(m.time, 30)) && minutesSince(m.time) >= 30 && once("med2:" + m.id)) {
      due.push("Still to take: " + label);
      dueMed = dueMed || m;
    }
  });
  state.appointments.forEach((a) => {
    if (a.date === dateOffset(1) && isDue("18:00") && state.fired["ap1:" + a.id] !== "done") {
      state.fired["ap1:" + a.id] = "done";
      due.push("Tomorrow" + (a.time ? " at " + prettyTime(a.time) : "") + ": " + a.title + (a.note ? ". " + a.note : ""));
    }
    if (a.date === today && a.time && isDue(addMinutesHM(a.time, -60)) && minutesSince(a.time) < 0 && state.fired["ap2:" + a.id] !== "done") {
      state.fired["ap2:" + a.id] = "done";
      due.push("In one hour: " + a.title + (a.place ? " at " + a.place : ""));
    }
  });
  const nowMs = Date.now();
  const doneTimers = state.timers.filter((t) => new Date(t.at).getTime() <= nowMs);
  if (doneTimers.length) {
    doneTimers.forEach((t) => due.push(t.text));
    state.timers = state.timers.filter((t) => new Date(t.at).getTime() > nowMs);
  }

  // Safety check-ins
  state.checkTimes.forEach((t) => {
    if (isDue(t) && once("chk:" + t) && !state.pendingCheck) {
      save();
      checkInPrompt(t);
    }
  });
  if (state.pendingCheck && !state.pendingCheck.escalated &&
      nowMs - new Date(state.pendingCheck.at).getTime() >= CHECKIN_GRACE * 60000) {
    save();
    escalateCheckIn();
    return;
  }

  if (!due.length) return;
  save();
  if (state.pendingCheck) {
    notify("Reminder", due.join(". "));
    return; // don't cover the check-in question
  }
  vibrate([180, 80, 180, 80, 180]);
  const now = nowHM();
  const text = due.join(". ");
  say("It is " + prettyTime(now) + ". " + text);
  openOverlay({
    title: "It is " + prettyTime(now),
    html: `<p class="big-line">${escapeHtml(text)}</p>`,
    actions: (dueMed ? btn("btn-ok", "take-med", "✅ Taken " + escapeHtml(dueMed.name), `data-id="${dueMed.id}"`) : "") +
      btn(dueMed ? "btn-soft" : "btn-ok", "close-overlay", "Okay")
  });
  notify("Reminder", text);
  renderNextUp();
}

function minuteTick() {
  if (resetDaily()) {
    renderAll();
    return;
  }
  applySettings();
  applyCarerMode();
  renderNextUp();
  renderWater();
  renderMeds();
  renderAppointments();
  renderPatterns();
}

/* ---------------- events ---------------- */

function needCarer() {
  if (isCarer()) return true;
  askPin();
  return false;
}

function onAction(action, el) {
  const id = el.dataset.id;
  const today = todayStr();
  switch (action) {
    case "confused": return confusedHelp();
    case "lost": return lostHelp();
    case "hurt": return hurtHelp();
    case "pain": return painLevel(id);
    case "pain-level": return painReport(id, Number(el.dataset.n));
    case "fall": return fallHelp();
    case "fall-ok": return fallOk();
    case "unwell": return unwellHelp();
    case "heart": return heartHelp();
    case "lowsugar": return lowSugarHelp();
    case "breathless": return breathlessHelp();
    case "stroke": return strokeHelp();
    case "seizure": return seizureHelp();
    case "seizure-stop": return seizureStop(el.dataset.start);
    case "wound": return woundHelp();
    case "overwhelmed": return overwhelmedHelp();
    case "grounding": return groundingStep(0);
    case "ground-next": return groundingStep(Math.min(groundStep + 1, GROUND_STEPS.length - 1));
    case "alarm": return loudAlarm();
    case "go-talk": closeOverlay(); return showTab("talk");
    case "go-symptoms":
      closeOverlay(); showTab("health"); return;
    case "go-reading": return openVitalForm($("vitalType").value || focusVitals()[0] || "bp");
    case "text-fall": return textHelper("I had a fall. I think I am okay, but please call me.");
    case "text-unwell": return textHelper("I feel unwell. Please call me.");
    case "text-symptom": return textHelper("I want to tell you: " + (id || "I don't feel well") + ". Please call me.");
    case "text-reading": return textHelper("My " + (id || "reading") + ". Please call me.");
    case "text-seizure": return textHelper("I had a seizure. It lasted " + (id || "a while") + ". Please call me.");
    case "read-plan": return readTodayPlan();
    case "something-to-do": return somethingToDo();
    case "activity-done":
      logEvent("activity", (state.activities.find((a) => a.id === id) || {}).text || "");
      closeOverlay();
      say("Lovely. Enjoy it.");
      return;
    case "breathe": return startBreathing();
    case "check-in": return checkIn();
    case "checkin-help":
      state.pendingCheck = null;
      save();
      return unwellHelp();
    case "sos": return sos();
    case "emergency": return callEmergency();
    case "text-helper": return textHelper();
    case "send-location": return sendLocation();
    case "show-card": return showToSomeone();
    case "read-card": return say(cardLines().join(" "), true);
    case "med-card": return medicalCard();
    case "ask-qa": return askQuestion(id);
    case "read-calm": return say($("calmText").textContent);
    case "read-note": return say((state.note.text || "") + (state.note.author ? ". From " + state.note.author : ""));
    case "read-story": return say(state.profile.story || "No story has been written yet.");
    case "timer": return startTimer(el.dataset.min, el.dataset.text);

    // health
    case "add-vital": return addVital();
    case "vital-detail": return vitalDetail(id);
    case "vital-add-type": return openVitalForm(id);
    case "vital-del-last": {
      if (!needCarer()) return;
      const list = readingsOf(id);
      const last = list[list.length - 1];
      if (last) state.vitals = state.vitals.filter((r) => r !== last);
      save(); renderVitals(); renderPatterns(); return vitalDetail(id);
    }
    case "symptom": return askSymptom(id);
    case "symptom-save": return saveSymptom(id);
    case "set-sleep": return setSleep(id, null);
    case "bowel":
      if (state.log.some((e) => e.type === "bowel" && dayOf(e.t) === today)) {
        say("Already noted for today.");
        return;
      }
      logEvent("bowel");
      renderBowel(); renderPatterns();
      say("Thank you. Noted.");
      return;
    case "bladder-issue":
      logEvent("symptom", "bladder:moderate");
      renderSymptoms(); renderPatterns();
      return bladderHelp();
    case "read-ex": {
      const ex = state.exercises.find((x) => x.id === id);
      if (ex) say(ex.text + ". " + (ex.how || ""));
      return;
    }
    case "done-ex": {
      const ex = state.exercises.find((x) => x.id === id);
      state.exercisesDone[id] = today;
      logEvent("exercise", ex ? ex.text : "");
      renderExercises();
      say("Well done!");
      return;
    }
    case "report": return showReport(el.dataset.days);
    case "report-print": return printReport();
    case "report-share": return shareReport();

    // talk
    case "say-phrase": return sayPhrase(el.dataset.text);
    case "type-speak": {
      const t = $("typeSay").value.trim();
      if (t) { say(t, true); logEvent("talk", t); }
      return;
    }
    case "type-show": return showBig($("typeSay").value.trim());
    case "captions": return toggleCaptions();

    // editing
    case "add-reminder": return addReminder();
    case "add-schedule": return addSchedule();
    case "add-med": return addMed();
    case "add-appt": return addAppointment();
    case "add-ex": return addExercise();
    case "add-phrase": return addPhrase();
    case "add-journal": return addJournal();
    case "add-checktime": return addCheckTime();
    case "add-person": return addPerson();
    case "add-qa": return addQA();
    case "add-act": return addActivity();
    case "save-profile": return saveProfile();
    case "save-helper": return saveHelper();
    case "save-note": return saveNote();
    case "save-pin": return savePin();
    case "save-ranges": return saveRanges();
    case "reset-ranges":
      state.ranges = {};
      save(); renderRanges(); renderVitals(); renderPatterns(); return;
    case "unlock": return askPin();
    case "pin-submit": return pinSubmit();
    case "lock-now": return lockNow();
    case "enable-notify": return enableNotify();
    case "export": return exportData();
    case "restart-setup": return startSetup();
    case "setup-save": return saveSetup();
    case "setup-skip":
      state.setupDone = true;
      save(); closeOverlay(); return;
    case "close-overlay": return closeOverlay();
    case "say-person": return sayPerson(id);
    case "add-memory": return addMemory();
    case "memory-open": return openMemory(state.memories.findIndex((m) => m.id === id), false);
    case "memory-play": return openMemory(0, true);
    case "memory-next": return openMemory(memoryIndex + 1, memoryAuto);
    case "memory-prev": return openMemory(memoryIndex - 1 + state.memories.length, false);
    case "memory-voice": return playMemoryVoice(state.memories[memoryIndex], false);
    case "memory-stop-auto":
      memoryAuto = false;
      return openMemory(memoryIndex, false);
    case "voice-record": return startRecording();
    case "voice-stop": return stopRecording();
    case "voice-clear": return clearPendingVoice();
    case "take-med": return takeMed(id);
    case "take-prn": return takePrn(id);
    case "take-prn-force":
      if (!needCarer()) return;
      return takePrn(id, true);
    case "stock-med":
      if (!needCarer()) return;
      return editStock(id);
    case "stock-save": return saveStock(id);
    case "undo-med": {
      if (!isCarer()) return;
      const med = state.meds.find((m) => m.id === id);
      if (med && medRecord(id)) useStock(med, 1);
      state.medsDone[id] = null;
      save(); renderMeds(); renderNextUp(); renderPatterns(); return;
    }
    case "toggle-sched":
      if (state.scheduleDone[id] === today) {
        if (!isCarer()) return;
        state.scheduleDone[id] = "";
      } else {
        state.scheduleDone[id] = today;
        say("Well done.");
      }
      save(); renderSchedule(); renderNextUp(); return;
    case "del-sched":
      if (!isCarer()) return;
      state.schedule = state.schedule.filter((item) => item.id !== id);
      save(); renderSchedule(); renderNextUp(); return;
    case "del-med":
      if (!isCarer()) return;
      state.meds = state.meds.filter((item) => item.id !== id);
      save(); renderMeds(); renderMe(); renderNextUp(); return;
    case "del-rem":
      if (!isCarer()) return;
      state.reminders = state.reminders.filter((item) => item.id !== id);
      save(); renderReminders(); renderNextUp(); return;
    case "del-appt":
      if (!isCarer()) return;
      state.appointments = state.appointments.filter((item) => item.id !== id);
      save(); renderAppointments(); renderNextUp(); return;
    case "del-ex":
      if (!isCarer()) return;
      state.exercises = state.exercises.filter((item) => item.id !== id);
      save(); renderExercises(); return;
    case "del-phrase":
      if (!isCarer()) return;
      state.phrases = state.phrases.filter((item) => item.id !== id);
      save(); renderPhrases(); return;
    case "del-checktime":
      if (!isCarer()) return;
      state.checkTimes = state.checkTimes.filter((t) => t !== id);
      save(); renderCheckTimes(); return;
    case "del-memory":
      if (!isCarer()) return;
      return deleteMemory(id);
    case "del-person":
      if (!isCarer()) return;
      state.people = state.people.filter((item) => item.id !== id);
      save(); closeOverlay(); renderPeople(); return;
    case "del-qa":
      if (!isCarer()) return;
      state.qa = state.qa.filter((item) => item.id !== id);
      save(); renderQA(); renderEditors(); return;
    case "del-act":
      if (!isCarer()) return;
      state.activities = state.activities.filter((item) => item.id !== id);
      save(); renderQA(); renderEditors(); return;
    case "clear-log":
      if (!isCarer()) return;
      state.log = [];
      save(); renderPatterns(); renderSymptoms(); renderBowel(); renderSleep(); return;
    case "toggle-meal":
      state.meals[id] = state.meals[id] === today ? "" : today;
      save(); renderMeals(); renderNextUp(); return;
    case "set-water":
      state.water = { date: today, count: Number(el.dataset.count) };
      save(); renderWater(); renderNextUp();
      if (Number(el.dataset.count) === (Number(state.settings.waterGoal) || 8)) say("Well done. You reached your water goal.");
      return;
    case "set-mood": return setMood(id);
    default:
      return;
  }
}

document.addEventListener("pointerdown", unlockAudio, { once: true });

document.addEventListener("click", (event) => {
  if (state.pin && isCarer()) carerUntil = Date.now() + CARER_MINUTES * 60000; // stay unlocked while in use

  const tabBtn = event.target.closest("[data-tab]");
  if (tabBtn) {
    closeOverlay();
    showTab(tabBtn.dataset.tab);
    return;
  }
  const link = event.target.closest("a[data-log]");
  if (link) {
    logEvent(link.dataset.log, link.dataset.detail || "");
    return;
  }
  const b = event.target.closest("[data-action]");
  if (b) onAction(b.dataset.action, b);
});

document.addEventListener("change", (event) => {
  const box = event.target.closest("[data-check]");
  if (box) {
    state.checks[box.dataset.check] = box.checked;
    save();
    return;
  }
  const f = event.target.closest("[data-focus]");
  if (f) {
    const id = f.dataset.focus;
    state.focus = f.checked ? state.focus.concat(id).filter((v, i, a) => a.indexOf(v) === i) : state.focus.filter((x) => x !== id);
    save();
    renderFocusHelp();
    renderVitals();
    renderChecks();
    renderPatterns();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("overlay").classList.contains("hidden") && !state.pendingCheck) closeOverlay();
  if (event.key === "Enter" && event.target.id === "pinInput") pinSubmit();
  if (event.key === "Enter" && event.target.id === "stockInput") saveStock($("overlayActions").querySelector("[data-action=stock-save]").dataset.id);
});

// Tapping the dark area around a pop-up closes it, except for safety questions
$("overlay").addEventListener("click", (event) => {
  if (event.target === $("overlay") && !$("overlay").classList.contains("is-urgent")) closeOverlay();
});

const SETTING_MAP = {
  optContrast: "highContrast",
  optNight: "nightMode",
  optEvening: "autoEvening",
  optVoice: "voice",
  optVibrate: "vibrate"
};
Object.keys(SETTING_MAP).forEach((id) => {
  $(id).addEventListener("change", (event) => {
    state.settings[SETTING_MAP[id]] = event.target.checked;
    save();
    applySettings();
  });
});

$("optSize").addEventListener("change", (event) => {
  state.settings.textSize = event.target.value;
  save();
  applySettings();
});

$("optRate").addEventListener("change", (event) => {
  state.settings.rate = Number(event.target.value);
  save();
  say("This is how I will speak.");
});

$("optVoiceName").addEventListener("change", (event) => {
  state.settings.voiceName = event.target.value;
  save();
  say("This is how I will sound.");
});

$("optWater").addEventListener("change", (event) => {
  state.settings.waterGoal = Number(event.target.value);
  save();
  renderWater();
  renderNextUp();
});

$("unitSugar").addEventListener("change", (event) => {
  state.units.sugar = event.target.value;
  save();
  renderVitals();
  renderRanges();
});

$("unitTemp").addEventListener("change", (event) => {
  state.units.temp = event.target.value;
  save();
  renderVitals();
  renderRanges();
});

$("vitalType").addEventListener("change", renderVitalInputs);

$("sleepHours").addEventListener("change", (event) => {
  const h = event.target.value.trim();
  if (h === "" || isNaN(h)) return;
  setSleep(null, String(Math.max(0, Math.min(24, Number(h)))));
});

$("importFile").addEventListener("change", (event) => importData(event.target.files[0]));
$("memVoiceFile").addEventListener("change", (event) => useVoiceFile(event.target.files[0]));

if (window.speechSynthesis) {
  fillVoices();
  speechSynthesis.addEventListener("voiceschanged", fillVoices);
}

window.addEventListener("afterprint", () => { $("printArea").innerHTML = ""; });

// Speech and alerts may need the screen to be touched once before they work
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    minuteTick();
    checkReminders();
  }
});

/* ---------------- start ---------------- */

function openFromHash() {
  const tab = location.hash.replace("#", "");
  if (["home", "today", "health", "talk", "me", "care"].includes(tab)) showTab(tab);
}
window.addEventListener("hashchange", openFromHash);

renderAll();
openFromHash();
if (!state.setupDone) startSetup();
setInterval(updateClock, 1000);
setInterval(checkReminders, 15000);
setInterval(minuteTick, 60000);
