import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

// ========== FIREBASE CONFIG — replace with your own from Firebase Console ==========
const firebaseConfig = {
  apiKey: "AIzaSyAK2bgqTat1UQjIpUkUG1kgLBAk_gm_x8c",
  authDomain: "bitsat-tracker-93456.firebaseapp.com",
  projectId: "bitsat-tracker-93456",
  storageBucket: "bitsat-tracker-93456.firebasestorage.app",
  messagingSenderId: "726548243703",
  appId: "1:726548243703:web:cda0239c843fc8aa511ff2",
  measurementId: "G-Q0TSKDXF1K"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CHAPTER_NAMES = {
  Physics: [
    "Units & Dimensions","Kinematics 1D","Kinematics 2D","Laws of Motion","Friction",
    "Work, Energy & Power","Centre of Mass & Collisions","Rotational Motion","Gravitation","Simple Harmonic Motion",
    "Waves & Sound","Mechanical Properties of Solids","Fluid Mechanics","Thermal Properties of Matter","Thermodynamics",
    "Kinetic Theory of Gases","Electrostatics","Gauss's Law & Electric Field","Electric Potential & Capacitance","Current Electricity",
    "Magnetic Effects of Current","Magnetism & Matter","Electromagnetic Induction","Alternating Current","Electromagnetic Waves",
    "Ray Optics","Wave Optics","Dual Nature of Radiation & Matter","Atoms","Nuclei",
    "Semiconductor Devices","Communication Systems","Experimental Physics"
  ],
  Chemistry: [
    "Basic Concepts of Chemistry","Atomic Structure","Chemical Bonding & Molecular Structure","States of Matter","Thermodynamics",
    "Equilibrium","Redox Reactions","Hydrogen","s-Block Elements","p-Block Elements (Gr. 13–14)",
    "p-Block Elements (Gr. 15–18)","Organic Chemistry Basics","Hydrocarbons","Environmental Chemistry","Solid State",
    "Solutions","Electrochemistry","Chemical Kinetics","Surface Chemistry","General Principles of Metallurgy",
    "d & f Block Elements","Coordination Compounds","Haloalkanes & Haloarenes","Alcohols, Phenols & Ethers","Aldehydes, Ketones & Carboxylic Acids",
    "Amines","Biomolecules","Polymers","Chemistry in Everyday Life","Periodic Table & Periodicity",
    "Ionic Equilibrium","Nuclear Chemistry","Practical Chemistry"
  ],
  Maths: [
    "Sets, Relations & Functions","Trigonometric Functions","Inverse Trigonometry","Principle of Mathematical Induction","Complex Numbers",
    "Linear Inequalities","Permutations & Combinations","Binomial Theorem","Sequences & Series","Straight Lines",
    "Conic Sections","3D Geometry Intro","Limits & Derivatives","Mathematical Reasoning","Statistics",
    "Probability (Basic)","Relations & Functions (XII)","Matrices","Determinants","Continuity & Differentiability",
    "Applications of Derivatives","Integrals","Applications of Integrals","Differential Equations","Vectors",
    "3D Geometry (XII)","Linear Programming","Probability (Advanced)","Quadratic Equations","Logarithms",
    "Coordinate Geometry","Number Theory","Mathematical Induction (XII)"
  ],
  English: [
    "Reading Comprehension 1","Reading Comprehension 2","Synonyms","Antonyms","Analogy",
    "Fill in the Blanks","Sentence Completion","Error Detection","Sentence Improvement","Active & Passive Voice",
    "Direct & Indirect Speech","Nouns & Pronouns","Adjectives & Adverbs","Verbs & Tenses","Prepositions",
    "Conjunctions & Articles","Subject-Verb Agreement","Idioms & Phrases","One-Word Substitution","Spelling Correction",
    "Jumbled Sentences","Vocabulary – Confusing Words","Para Jumbles","Cloze Test","Punctuation",
    "Figures of Speech","Comprehension Passages","Word Order","Clause Analysis","Phrasal Verbs",
    "Letter Writing Concepts","Essay & Précis Concepts","Critical Reading"
  ],
  Logic: [
    "Number Series","Letter Series","Coding-Decoding","Direction Sense","Blood Relations",
    "Ranking & Arrangement","Seating Arrangement (Linear)","Seating Arrangement (Circular)","Syllogisms","Verbal Analogies",
    "Non-Verbal Analogies","Classification / Odd One Out","Venn Diagrams","Clocks","Calendars",
    "Cubes & Dice","Mirror & Water Images","Paper Folding & Cutting","Embedded Figures","Figure Completion",
    "Figure Series","Data Sufficiency","Logical Deduction","Statement & Assumptions","Statement & Conclusions",
    "Statement & Arguments","Cause & Effect","Input-Output","Mathematical Operations","Inequalities",
    "Puzzles","Critical Reasoning","Analytical Reasoning"
  ],
};

const SUBJECTS = [
  { name: "Physics",   color: "#3b82f6", bg: "#1e3a5f", icon: "⚛" },
  { name: "Chemistry", color: "#10b981", bg: "#1a3d2e", icon: "🧪" },
  { name: "Maths",     color: "#f97316", bg: "#3d2512", icon: "∑"  },
  { name: "English",   color: "#a78bfa", bg: "#2d1f4e", icon: "📖" },
  { name: "Logic",     color: "#f43f5e", bg: "#3d1a22", icon: "🧩" },
];

const CHAPTER_COUNT = 33;
const makeProgress = () =>
  Object.fromEntries(
    SUBJECTS.map((s) => [
      s.name,
      Array.from({ length: CHAPTER_COUNT }, () => ({ revised: false, dppDone: false, dppScore: "" })),
    ])
  );

// ---- SHA-256 hashing — passwords NEVER stored in plain text ----
async function hashPassword(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw + "bitsalt_9k2z"));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

// ---- Firebase Storage ----
// Keys use colon ":" as separator e.g. "bitsat_users_v2" or "bitsat_progress_rish"
async function loadStorage(key, fallback) {
  try {
    const ref = doc(db, "bitsat", key);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().value : fallback;
  } catch { return fallback; }
}
async function saveStorage(key, val) {
  try {
    const ref = doc(db, "bitsat", key);
    await setDoc(ref, { value: val });
  } catch {}
}

async function loadUsers() {
  const stored = await loadStorage("bitsat_users_v2", null);
  if (stored) return stored;
  const defaults = {
    teacher: { hash: await hashPassword("teacher123"), role: "admin",   name: "Teacher"      },
    rish:    { hash: await hashPassword("rish123"),    role: "student", name: "Rish"         },
    demo:    { hash: await hashPassword("demo123"),    role: "student", name: "Demo Student" },
    astha:   { hash: await hashPassword("123321"),     role: "student", name: "Astha"        },
    ayush:   { hash: await hashPassword("567765"),     role: "student", name: "Ayush"        },
  };
  await saveStorage("bitsat_users_v2", defaults);
  return defaults;
}

// ========== STYLES ==========
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0b0f1a; color: #e2e8f0; font-family: 'Sora', sans-serif; min-height: 100vh; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0b0f1a; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  .app { min-height: 100vh; background: #0b0f1a; }
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 30% 20%, #1e3a5f44 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, #3d1a2244 0%, transparent 60%), #0b0f1a; }
  .login-card { background: #111827; border: 1px solid #1e293b; border-radius: 20px; padding: 48px 40px; width: 380px; }
  .login-logo { font-size: 36px; font-weight: 700; letter-spacing: -1px; margin-bottom: 6px; background: linear-gradient(135deg, #3b82f6, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .login-sub { color: #64748b; font-size: 14px; margin-bottom: 36px; }
  .login-label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
  .login-input { width: 100%; background: #0b0f1a; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 16px; color: #e2e8f0; font-family: 'Sora', sans-serif; font-size: 15px; outline: none; transition: border-color .2s; margin-bottom: 18px; }
  .login-input:focus { border-color: #3b82f6; }
  .login-btn { width: 100%; background: linear-gradient(135deg, #3b82f6, #6366f1); border: none; border-radius: 10px; padding: 13px; color: #fff; font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity .2s; }
  .login-btn:hover { opacity: .88; } .login-btn:disabled { opacity: .5; cursor: not-allowed; }
  .login-err { color: #f43f5e; font-size: 13px; margin-bottom: 14px; }
  .nav { background: #111827cc; backdrop-filter: blur(12px); border-bottom: 1px solid #1e293b; padding: 0 24px; display: flex; align-items: center; height: 60px; position: sticky; top: 0; z-index: 100; gap: 12px; }
  .nav-brand { font-size: 18px; font-weight: 700; background: linear-gradient(135deg, #3b82f6, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -.5px; flex: 1; }
  .nav-user { font-size: 13px; color: #64748b; }
  .nav-user b { color: #cbd5e1; }
  .nav-logout { background: #1e293b; border: none; border-radius: 8px; padding: 7px 14px; color: #94a3b8; font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; transition: background .2s; }
  .nav-logout:hover { background: #334155; color: #e2e8f0; }
  .nav-pw-btn { background: #1e293b; border: none; border-radius: 8px; padding: 7px 14px; color: #94a3b8; font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; transition: background .2s; }
  .nav-pw-btn:hover { background: #334155; color: #e2e8f0; }
  .dash { padding: 28px 24px; max-width: 1100px; margin: 0 auto; }
  .dash-header { margin-bottom: 28px; }
  .dash-title { font-size: 24px; font-weight: 700; color: #f1f5f9; }
  .dash-sub { font-size: 14px; color: #64748b; margin-top: 4px; }
  .overview-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 32px; }
  @media(max-width:700px) { .overview-grid { grid-template-columns: repeat(2,1fr); } }
  .ov-card { border-radius: 14px; padding: 16px; cursor: pointer; border: 2px solid transparent; transition: border-color .2s, transform .15s; }
  .ov-card:hover { transform: translateY(-2px); }
  .ov-icon { font-size: 22px; margin-bottom: 8px; }
  .ov-name { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 10px; }
  .ov-bar-bg { height: 5px; background: #1e293b; border-radius: 999px; overflow: hidden; margin-bottom: 6px; }
  .ov-bar-fill { height: 100%; border-radius: 999px; transition: width .5s ease; }
  .ov-pct { font-size: 11px; color: #64748b; font-family: 'JetBrains Mono', monospace; }
  .subject-panel { background: #111827; border: 1px solid #1e293b; border-radius: 18px; padding: 24px; }
  .panel-title { font-size: 18px; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
  .ch-table-wrap { overflow-x: auto; }
  .ch-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ch-table th { padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; border-bottom: 1px solid #1e293b; }
  .ch-table td { padding: 7px 12px; border-bottom: 1px solid #0f172a; vertical-align: middle; }
  .ch-table tr:hover td { background: #0f172a88; }
  .ch-num { font-family: 'JetBrains Mono', monospace; color: #475569; width: 36px; }
  .ch-name { color: #cbd5e1; font-weight: 500; }
  .check-btn { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #334155; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s, border-color .15s; background: transparent; font-size: 12px; }
  .score-input { background: #0b0f1a; border: 1px solid #1e293b; border-radius: 6px; padding: 4px 8px; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; font-size: 12px; width: 70px; outline: none; transition: border-color .2s; }
  .score-input:focus { border-color: #3b82f6; }
  .reviews-box { margin-top: 32px; background: #111827; border: 1px solid #1e293b; border-radius: 18px; padding: 24px; }
  .review-card { background: #0b0f1a; border-left: 3px solid #3b82f6; padding: 14px 16px; border-radius: 0 10px 10px 0; margin-bottom: 12px; }
  .review-text { font-size: 14px; color: #cbd5e1; line-height: 1.6; }
  .review-meta { font-size: 11px; color: #475569; margin-top: 6px; font-family: 'JetBrains Mono', monospace; }
  .admin-dash { padding: 28px 24px; max-width: 1200px; margin: 0 auto; }
  .student-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 24px; }
  .student-card { background: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 20px; cursor: pointer; transition: border-color .2s, transform .15s; }
  .student-card:hover { border-color: #334155; transform: translateY(-2px); }
  .sc-name { font-size: 17px; font-weight: 600; color: #f1f5f9; margin-bottom: 14px; }
  .sc-bars { display: flex; flex-direction: column; gap: 7px; }
  .sc-bar-row { display: flex; align-items: center; gap: 8px; }
  .sc-bar-label { width: 70px; font-size: 11px; }
  .sc-bar-bg { flex: 1; height: 6px; background: #1e293b; border-radius: 999px; overflow: hidden; }
  .sc-bar-fill { height: 100%; border-radius: 999px; }
  .sc-pct { width: 36px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #475569; }
  .back-btn { background: #1e293b; border: none; border-radius: 8px; padding: 8px 16px; color: #94a3b8; font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; margin-bottom: 20px; display: inline-flex; align-items: center; gap: 6px; }
  .back-btn:hover { background: #334155; }
  .review-form textarea { width: 100%; background: #0b0f1a; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; color: #e2e8f0; font-family: 'Sora', sans-serif; font-size: 14px; min-height: 90px; resize: vertical; outline: none; margin-bottom: 10px; transition: border-color .2s; }
  .review-form textarea:focus { border-color: #3b82f6; }
  .send-btn { background: linear-gradient(135deg, #3b82f6, #6366f1); border: none; border-radius: 10px; padding: 10px 22px; color: #fff; font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity .2s; }
  .send-btn:hover { opacity: .85; }
  .manage-btn { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 9px 18px; color: #94a3b8; font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; transition: background .2s; }
  .manage-btn:hover { background: #334155; color: #e2e8f0; }
  .add-student-form { background: #111827; border: 1px solid #1e293b; border-radius: 14px; padding: 20px; margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
  .add-student-form input { background: #0b0f1a; border: 1px solid #1e293b; border-radius: 8px; padding: 9px 13px; color: #e2e8f0; font-family: 'Sora', sans-serif; font-size: 14px; outline: none; flex: 1; min-width: 130px; }
  .add-student-form input:focus { border-color: #3b82f6; }
  .section-title { font-size: 18px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
  .section-sub { font-size: 13px; color: #475569; margin-bottom: 20px; }
  .pw-modal-bg { position: fixed; inset: 0; background: #00000099; display: flex; align-items: center; justify-content: center; z-index: 200; }
  .pw-modal { background: #111827; border: 1px solid #1e293b; border-radius: 18px; padding: 32px; width: 340px; }
  .pw-modal-title { font-size: 17px; font-weight: 700; color: #f1f5f9; margin-bottom: 20px; }
  .pw-ok { color: #10b981; font-size: 13px; margin-bottom: 10px; }
  .pw-err { color: #f43f5e; font-size: 13px; margin-bottom: 10px; }
  .pw-cancel { background: #1e293b; border: none; border-radius: 8px; padding: 9px 18px; color: #94a3b8; font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; margin-left: 8px; }
  .lock-btn { border: none; border-radius: 8px; padding: 7px 14px; font-family: 'Sora', sans-serif; font-size: 13px; cursor: pointer; font-weight: 600; transition: opacity .2s; }
  .lock-btn:hover { opacity: .82; }
  .locked-banner { background: #3d1a22; border: 1px solid #f43f5e55; border-radius: 12px; padding: 12px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; font-size: 13px; color: #f43f5e; font-weight: 500; }
  .lock-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
  .lock-badge.locked { background: #3d1a22; color: #f43f5e; }
  .lock-badge.unlocked { background: #1a3d2e; color: #10b981; }
  .check-btn:disabled { opacity: .3; cursor: not-allowed; pointer-events: none; }
  .score-input:disabled { opacity: .3; cursor: not-allowed; }
`;

function pct(arr, key) {
  if (!arr || !arr.length) return 0;
  return Math.round((arr.filter(c => c[key]).length / arr.length) * 100);
}
function overallPct(progress) {
  let done = 0, total = 0;
  SUBJECTS.forEach(s => {
    const arr = progress?.[s.name] || [];
    done += arr.filter(c => c.revised && c.dppDone).length;
    total += arr.length;
  });
  return total ? Math.round((done / total) * 100) : 0;
}

// ===== LOGIN =====
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (loading) return;
    setLoading(true); setErr("");
    const users = await loadUsers();
    const un = username.trim().toLowerCase();
    const user = users[un];
    if (!user) { setErr("Invalid username or password."); setLoading(false); return; }
    const inputHash = await hashPassword(password);
    if (inputHash !== user.hash) { setErr("Invalid username or password."); setLoading(false); return; }
    // Only pass safe fields — hash never leaves this function
    onLogin({ username: un, role: user.role, name: user.name });
  }

  return (
    <div className="login-wrap">
      <style>{css}</style>
      <div className="login-card">
        <div className="login-logo">BITSAT Prep</div>
        <div className="login-sub">Track your revision & DPP progress</div>
        {err && <div className="login-err">⚠ {err}</div>}
        <label className="login-label">Username</label>
        <input className="login-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="your username" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        <label className="login-label">Password</label>
        <input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        <button className="login-btn" onClick={handleLogin} disabled={loading}>{loading ? "Signing in…" : "Sign In →"}</button>
      </div>
    </div>
  );
}

// ===== CHANGE PASSWORD =====
function ChangePasswordModal({ user, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setErr(""); setOk(false); setLoading(true);
    const users = await loadUsers();
    const currentHash = await hashPassword(current);
    if (currentHash !== users[user.username]?.hash) { setErr("Current password is wrong."); setLoading(false); return; }
    if (next.length < 4) { setErr("New password must be at least 4 characters."); setLoading(false); return; }
    if (next !== confirm) { setErr("Passwords don't match."); setLoading(false); return; }
    const newHash = await hashPassword(next);
    const updated = { ...users, [user.username]: { ...users[user.username], hash: newHash } };
    // Scrub any stray plain-text password fields just in case
    Object.values(updated).forEach(u => { delete u.password; });
    await saveStorage("bitsat_users_v2", updated);
    setOk(true); setLoading(false);
    setCurrent(""); setNext(""); setConfirm("");
    setTimeout(onClose, 1200);
  }

  return (
    <div className="pw-modal-bg" onClick={onClose}>
      <div className="pw-modal" onClick={e => e.stopPropagation()}>
        <div className="pw-modal-title">🔑 Change Password</div>
        {ok && <div className="pw-ok">✓ Password updated!</div>}
        {err && <div className="pw-err">⚠ {err}</div>}
        <label className="login-label">Current Password</label>
        <input className="login-input" type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" />
        <label className="login-label">New Password</label>
        <input className="login-input" type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="••••••••" />
        <label className="login-label">Confirm New Password</label>
        <input className="login-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleSave()} />
        <div style={{ display: "flex", marginTop: 4 }}>
          <button className="send-btn" onClick={handleSave} disabled={loading}>{loading ? "Saving…" : "Save Password"}</button>
          <button className="pw-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ===== NAVBAR =====
function Navbar({ user, onLogout }) {
  const [showPw, setShowPw] = useState(false);
  return (
    <>
      <nav className="nav">
        <div className="nav-brand">BITSAT Prep</div>
        <div className="nav-user">Logged in as <b>{user.name}</b> {user.role === "admin" && "👑"}</div>
        {!user.locked && <button className="nav-pw-btn" onClick={() => setShowPw(true)}>🔑 Password</button>}
        <button className="nav-logout" onClick={onLogout}>Logout</button>
      </nav>
      {showPw && <ChangePasswordModal user={user} onClose={() => setShowPw(false)} />}
    </>
  );
}

function SubjectCard({ subject, progress, isActive, onClick }) {
  const revPct = pct(progress, "revised");
  const dppPct = pct(progress, "dppDone");
  return (
    <div className="ov-card" style={{ background: subject.bg, color: subject.color, borderColor: isActive ? subject.color : "transparent", border: "2px solid" }} onClick={onClick}>
      <div className="ov-icon">{subject.icon}</div>
      <div className="ov-name">{subject.name}</div>
      <div className="ov-bar-bg"><div className="ov-bar-fill" style={{ width: revPct + "%", background: subject.color, opacity: .9 }} /></div>
      <div className="ov-bar-bg"><div className="ov-bar-fill" style={{ width: dppPct + "%", background: subject.color, opacity: .55 }} /></div>
      <div className="ov-pct">{Math.round((revPct + dppPct) / 2)}% overall</div>
    </div>
  );
}

function ChapterTable({ subject, chapters, onChange }) {
  const names = CHAPTER_NAMES[subject.name] || [];
  return (
    <div className="ch-table-wrap">
      <table className="ch-table">
        <thead>
          <tr><th>#</th><th>Chapter Name</th><th>Revised</th><th>DPP Done</th><th>DPP Score</th></tr>
        </thead>
        <tbody>
          {chapters.map((ch, i) => (
            <tr key={i}>
              <td className="ch-num">{String(i + 1).padStart(2, "0")}</td>
              <td className="ch-name">{names[i] || `Chapter ${i + 1}`}</td>
              <td>
                <button className="check-btn"
                  style={{ color: subject.color, borderColor: ch.revised ? subject.color : "#334155", background: ch.revised ? subject.bg : "transparent" }}
                  onClick={() => onChange && onChange(i, "revised", !ch.revised)}>
                  {ch.revised ? "✓" : ""}
                </button>
              </td>
              <td>
                <button className="check-btn"
                  style={{ color: subject.color, borderColor: ch.dppDone ? subject.color : "#334155", background: ch.dppDone ? subject.bg : "transparent" }}
                  onClick={() => onChange && onChange(i, "dppDone", !ch.dppDone)}>
                  {ch.dppDone ? "✓" : ""}
                </button>
              </td>
              <td>
                {onChange
                  ? <input className="score-input" value={ch.dppScore} placeholder="e.g. 18/30" onChange={e => onChange(i, "dppScore", e.target.value)} style={{ borderColor: ch.dppScore ? subject.color + "66" : "#1e293b" }} />
                  : <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: ch.dppScore ? "#cbd5e1" : "#334155" }}>{ch.dppScore || "—"}</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== STUDENT DASHBOARD =====
function StudentDash({ user }) {
  const [progress, setProgress] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeSub, setActiveSub] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    loadStorage(`bitsat_progress_${user.username}`, makeProgress()).then(setProgress);
    loadStorage(`bitsat_reviews_${user.username}`, []).then(setReviews);
    loadUsers().then(u => setLocked(!!u[user.username]?.locked));
  }, [user.username]);

  const handleChange = useCallback((subName, idx, field, val) => {
    if (locked) return;
    setProgress(prev => {
      const next = { ...prev, [subName]: prev[subName].map((c, i) => i === idx ? { ...c, [field]: val } : c) };
      saveStorage(`bitsat_progress_${user.username}`, next);
      return next;
    });
  }, [user.username, locked]);

  if (!progress) return <div style={{ padding: 40, color: "#475569" }}>Loading...</div>;
  const sub = SUBJECTS[activeSub];
  const chapters = progress[sub.name];

  return (
    <div className="dash">
      {locked && (
        <div className="locked-banner" style={{ margin: "20px 24px 0" }}>
          🔒 Your account is in <b>view-only mode</b>. Contact your teacher to enable editing.
        </div>
      )}
      <div className="dash-header">
        <div className="dash-title">Hey {user.name}! 👋</div>
        <div className="dash-sub">Overall progress: {overallPct(progress)}% complete</div>
      </div>
      <div className="overview-grid">
        {SUBJECTS.map((s, i) => (
          <SubjectCard key={s.name} subject={s} progress={progress[s.name]} isActive={i === activeSub} onClick={() => setActiveSub(i)} />
        ))}
      </div>
      <div className="subject-panel">
        <div className="panel-title" style={{ color: sub.color }}>
          <span>{sub.icon}</span> {sub.name} — Chapter Tracker
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#475569", fontWeight: 400 }}>
            Rev: {pct(chapters, "revised")}% &nbsp;|&nbsp; DPP: {pct(chapters, "dppDone")}%
          </span>
        </div>
        <ChapterTable subject={sub} chapters={chapters} onChange={locked ? null : (i, f, v) => handleChange(sub.name, i, f, v)} />
      </div>
      {reviews.length > 0 && (
        <div className="reviews-box">
          <div className="section-title" style={{ marginBottom: 16 }}>📝 Teacher Reviews</div>
          {reviews.map((r, i) => (
            <div key={i} className="review-card">
              <div className="review-text">{r.text}</div>
              <div className="review-meta">{r.date} · by {r.by}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== ADMIN — STUDENT DETAIL =====
function StudentDetailView({ student, onBack, users }) {
  const [progress, setProgress] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewText, setReviewText] = useState("");
  const [activeSub, setActiveSub] = useState(0);

  useEffect(() => {
    loadStorage(`bitsat_progress_${student}`, makeProgress()).then(setProgress);
    loadStorage(`bitsat_reviews_${student}`, []).then(setReviews);
  }, [student]);

  async function sendReview() {
    if (!reviewText.trim()) return;
    const newR = { text: reviewText.trim(), date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), by: "Teacher" };
    const updated = [newR, ...reviews];
    setReviews(updated);
    await saveStorage(`bitsat_reviews_${student}`, updated);
    setReviewText("");
  }

  if (!progress) return <div style={{ padding: 40, color: "#475569" }}>Loading...</div>;
  const sub = SUBJECTS[activeSub];

  return (
    <div className="admin-dash">
      <button className="back-btn" onClick={onBack}>← Back to Students</button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div className="section-title">{users[student]?.name || student}'s Progress</div>
        <span className={`lock-badge ${users[student]?.locked ? "locked" : "unlocked"}`}>
          {users[student]?.locked ? "🔒 Locked" : "✏️ Editable"}
        </span>
        <button
          className="lock-btn"
          style={{ marginLeft: "auto", background: users[student]?.locked ? "#1a3d2e" : "#3d1a22", color: users[student]?.locked ? "#10b981" : "#f43f5e" }}
          onClick={async () => {
            const allUsers = await loadUsers();
            const newLocked = !allUsers[student]?.locked;
            const updated = { ...allUsers, [student]: { ...allUsers[student], locked: newLocked } };
            await saveStorage("bitsat_users_v2", updated);
            window.location.reload();
          }}
        >
          {users[student]?.locked ? "🔓 Unlock Student" : "🔒 Lock Student"}
        </button>
      </div>
      <div className="section-sub">Overall: {overallPct(progress)}% complete</div>
      <div className="overview-grid" style={{ marginBottom: 24 }}>
        {SUBJECTS.map((s, i) => (
          <SubjectCard key={s.name} subject={s} progress={progress[s.name]} isActive={i === activeSub} onClick={() => setActiveSub(i)} />
        ))}
      </div>
      <div className="subject-panel">
        <div className="panel-title" style={{ color: sub.color }}>
          {sub.icon} {sub.name}
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#475569", fontWeight: 400 }}>
            Rev: {pct(progress[sub.name], "revised")}% | DPP: {pct(progress[sub.name], "dppDone")}%
          </span>
        </div>
        <ChapterTable subject={sub} chapters={progress[sub.name]} onChange={null} />
      </div>
      <div className="reviews-box" style={{ marginTop: 28 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Leave a Review</div>
        <div className="review-form">
          <textarea placeholder={`Write feedback for ${users[student]?.name}...`} value={reviewText} onChange={e => setReviewText(e.target.value)} />
          <button className="send-btn" onClick={sendReview}>Send Review ✉</button>
        </div>
        {reviews.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>Past Reviews</div>
            {reviews.map((r, i) => (
              <div key={i} className="review-card">
                <div className="review-text">{r.text}</div>
                <div className="review-meta">{r.date}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== ADMIN DASHBOARD =====
function AdminDash({ user }) {
  const [users, setUsers] = useState(null);
  const [allProgress, setAllProgress] = useState({});
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", name: "", password: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadUsers().then(u => {
      setUsers(u);
      const students = Object.entries(u).filter(([, v]) => v.role === "student").map(([k]) => k);
      Promise.all(students.map(s => loadStorage(`bitsat_progress_${s}`, makeProgress()).then(p => [s, p]))).then(res => {
        setAllProgress(Object.fromEntries(res));
      });
    });
  }, []);

  async function addStudent() {
    const un = newUser.username.trim().toLowerCase();
    if (!un || !newUser.name.trim() || !newUser.password.trim()) { setMsg("Fill all fields."); return; }
    if (users[un]) { setMsg("Username already exists."); return; }
    const newHash = await hashPassword(newUser.password.trim());
    // Store only hash — never the plain password
    const updated = { ...users, [un]: { name: newUser.name.trim(), hash: newHash, role: "student" } };
    await saveStorage("bitsat_users_v2", updated);
    setUsers(updated);
    setAllProgress(p => ({ ...p, [un]: makeProgress() }));
    setNewUser({ username: "", name: "", password: "" });
    setShowAdd(false); setMsg("");
  }

  if (!users) return <div style={{ padding: 40, color: "#475569" }}>Loading...</div>;
  if (selected) return <StudentDetailView student={selected} onBack={() => setSelected(null)} users={users} />;

  const students = Object.entries(users).filter(([, v]) => v.role === "student");

  return (
    <div className="admin-dash">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div className="section-title">Teacher Dashboard 👑</div>
        <button className="manage-btn" style={{ marginLeft: "auto" }} onClick={() => setShowAdd(s => !s)}>
          {showAdd ? "Cancel" : "+ Add Student"}
        </button>
      </div>
      <div className="section-sub">{students.length} student{students.length !== 1 ? "s" : ""} enrolled</div>
      {showAdd && (
        <div className="add-student-form">
          <input placeholder="Username" value={newUser.username} onChange={e => setNewUser(n => ({ ...n, username: e.target.value }))} />
          <input placeholder="Display Name" value={newUser.name} onChange={e => setNewUser(n => ({ ...n, name: e.target.value }))} />
          <input type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser(n => ({ ...n, password: e.target.value }))} />
          <button className="send-btn" onClick={addStudent}>Add</button>
          {msg && <span style={{ color: "#f43f5e", fontSize: 13 }}>{msg}</span>}
        </div>
      )}
      <div className="student-grid">
        {students.map(([username, info]) => {
          const progress = allProgress[username] || makeProgress();
          return (
            <div key={username} className="student-card" onClick={() => setSelected(username)}>
              <div className="sc-name">
                {info.name}
                {info.locked && <span className="lock-badge locked" style={{marginLeft:8}}>🔒 Locked</span>}
              </div>
              <div style={{ fontSize: 12, color: "#3b82f6", fontFamily: "JetBrains Mono, monospace", marginBottom: 14 }}>
                {overallPct(progress)}% overall
              </div>
              <div className="sc-bars">
                {SUBJECTS.map(s => {
                  const revP = pct(progress[s.name], "revised");
                  const dppP = pct(progress[s.name], "dppDone");
                  return (
                    <div key={s.name} className="sc-bar-row">
                      <span className="sc-bar-label" style={{ color: s.color + "cc" }}>{s.name}</span>
                      <div className="sc-bar-bg"><div className="sc-bar-fill" style={{ width: revP + "%", background: s.color, opacity: .85 }} /></div>
                      <span className="sc-pct">{Math.round((revP + dppP) / 2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== ROOT =====
export default function App() {
  const [user, setUser] = useState(null);
  if (!user) return <LoginPage onLogin={u => setUser(u)} />;
  return (
    <div className="app">
      <style>{css}</style>
      <Navbar user={user} onLogout={() => setUser(null)} />
      {user.role === "admin" ? <AdminDash user={user} /> : <StudentDash user={user} />}
    </div>
  );
}
