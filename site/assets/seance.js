// Affiche une séance une étape à la fois. Le contenu vient du JSON intégré à la page (généré depuis contenus/*.yaml).
// Formules : KaTeX. Éditeur : CodeMirror 5. Python : Pyodide, chargé au premier lancement des tests.
const S = JSON.parse(document.getElementById("seance").textContent);
// Interface en français ou en anglais selon <html lang>. Les textes des séances viennent déjà traduits du JSON.
const LANG = document.documentElement.lang === "en" ? "en" : "fr";
const UI = {
  fr: {
    step: (j, t) => `Étape ${j} : ${t}`, stepOf: (i, n, m) => `Étape ${i} sur ${n} · ${m} min`,
    prev: "← Précédente", next: "Suivante →", finish: "Terminer",
    labAria: "Force de mortalité de la table MK selon l'âge, échelle logarithmique", age: "Âge", years: " ans",
    labEyebrow: "Manipule", labHint: "Fais glisser l'âge : la table MK de ton simulateur répond.",
    videoSoon: "Vidéo en préparation", subtitles: "Français", play: "Regarder", otherLang: "en anglais", job: "Dans ton métier", further: "Pour aller plus loin",
    recap: "Rappel", example: "Exemple", pitfall: "Piège", right: "Juste.", wrong: "Pas tout à fait.",
    score: (k, n) => `${k} sur ${n}`, scoreLbl: "Score",
    check: "Vérifier", toFill: "à remplir", good: "juste", bad: "à revoir", solution: "Voir la solution", placeholder: "0,0000",
    codeAria: "Ton code Python", runHint: "Lance les tests quand ta fonction est prête.", run: "Lancer les tests",
    reset: "Code de départ", stop: "Arrêter", loading: "Chargement de Python… (quelques secondes la première fois)", running: "Exécution…",
    todo: "fonction pas encore écrite", unexpected: "valeur inattendue",
    allPass: (n) => `Les ${n} tests passent. Bravo.`, somePass: (k, n) => `${k} test${k > 1 ? "s" : ""} sur ${n} passe${k > 1 ? "nt" : ""}.`,
    repo: "Même exercice dans le dépôt : ", repoEnd: ". Les tests y tournent aussi sur GitHub Actions.",
    flip: "Voir l'anglais →",
    stopped: "Exécution arrêtée. Python se rechargera au prochain lancement.",
    timeout: (s) => `Arrêt après ${s} secondes : boucle infinie ou calcul trop long ?`,
    loadFail: "Python n'a pas pu se charger. Vérifie ta connexion, ou lance les tests du dépôt avec pytest.",
    badReply: "Réponse invalide du moteur Python.", unreadable: "Réponse illisible du moteur Python.",
    loadTimeout: (s) => `Le chargement de Python a dépassé ${s} secondes.`, cantSend: "Impossible d'envoyer le code au moteur Python.",
    locale: "fr-BE",
  },
  en: {
    step: (j, t) => `Step ${j}: ${t}`, stepOf: (i, n, m) => `Step ${i} of ${n} · ${m} min`,
    prev: "← Previous", next: "Next →", finish: "Finish",
    labAria: "Force of mortality of the MK table by age, log scale", age: "Age", years: " years",
    labEyebrow: "Try it", labHint: "Drag the age: the MK table from your simulator responds.",
    videoSoon: "Video in preparation", subtitles: "English", play: "Watch", otherLang: "in French", job: "On the job", further: "Further reading",
    recap: "Recap", example: "Example", pitfall: "Pitfall", right: "Correct.", wrong: "Not quite.",
    score: (k, n) => `${k} of ${n}`, scoreLbl: "Score",
    check: "Check", toFill: "to fill in", good: "correct", bad: "try again", solution: "Show the solution", placeholder: "0.0000",
    codeAria: "Your Python code", runHint: "Run the tests when your function is ready.", run: "Run the tests",
    reset: "Starter code", stop: "Stop", loading: "Loading Python… (a few seconds the first time)", running: "Running…",
    todo: "function not written yet", unexpected: "unexpected value",
    allPass: (n) => `All ${n} tests pass. Well done.`, somePass: (k, n) => `${k} of ${n} test${n > 1 ? "s" : ""} pass${k === 1 ? "es" : ""}.`,
    repo: "Same exercise in the repository: ", repoEnd: ". The tests also run there on GitHub Actions.",
    flip: "See the French →",
    stopped: "Run stopped. Python will reload next time.",
    timeout: (s) => `Stopped after ${s} seconds: infinite loop or a computation that is too long?`,
    loadFail: "Python could not load. Check your connection, or run the repository tests with pytest.",
    badReply: "Invalid reply from the Python engine.", unreadable: "Unreadable reply from the Python engine.",
    loadTimeout: (s) => `Loading Python took more than ${s} seconds.`, cantSend: "Could not send the code to the Python engine.",
    locale: "en-GB",
  },
}[LANG];
const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;
const $ = (s, r = document) => r.querySelector(s);

// YAML text is untrusted at the rendering boundary. Keep only the small inline
// formatting vocabulary used by the course; discard attributes and active nodes.
const RICH_TAGS = new Set(["B", "STRONG", "I", "EM", "SUB", "SUP", "CODE", "BR"]);
const DROP_TAGS = new Set([
  "SCRIPT", "STYLE", "SVG", "MATH", "IFRAME", "OBJECT", "EMBED", "TEMPLATE",
  "NOSCRIPT", "IMG", "VIDEO", "AUDIO", "FORM", "INPUT", "LINK", "META", "BASE",
]);
function rich(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value ?? "").replace(/(<(?:strong|b)>[A-Z]<\/(?:strong|b)>)\s*[-–—]\s*(?=<)/g, "$1 ");
  const fragment = document.createDocumentFragment();
  const copy = (node, parent) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(node.nodeValue || ""));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || DROP_TAGS.has(node.tagName)) return;
    if (RICH_TAGS.has(node.tagName)) {
      const safe = document.createElement(node.tagName.toLowerCase());
      parent.append(safe);
      node.childNodes.forEach((child) => copy(child, safe));
      return;
    }
    node.childNodes.forEach((child) => copy(child, parent));
  };
  template.content.childNodes.forEach((node) => copy(node, fragment));
  return fragment;
}
function sourceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, location.href);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
// Auto-wrap equation-like fragments in all ordinary text nodes, across every content component.
const BARE_MATH = /(?<![\p{L}\d_])(?:[A-Za-zδΔ][\p{L}\d_{}]*|\d+(?:[.,]\d+)?)(?:\s*(?:=|<|>|≤|≥|≈|≠|\+|−|×|÷|\/|\^)\s*(?:[A-Za-zδΔ][\p{L}\d_{}]*|\d+(?:[.,]\d+)?|\([^)]*\)))+/gu;
function inlineNotation(value) {
  return String(value ?? "").split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g).map((part,index) => {
    if (index % 2 === 1) return part;
    return part.replace(BARE_MATH, (match) => "$" + match.trim() + "$");
  }).join("");
}
function prepareMathText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    if (node.parentElement?.closest("code, pre, script, style, kbd, .katex, .math-rendered")) continue;
    nodes.push(node);
  }
  nodes.forEach(node => {
    const text = inlineNotation(node.nodeValue);
    if (text === node.nodeValue) return;
    const span = document.createElement("span");
    span.className = "math-notation-source";
    span.textContent = text;
    node.replaceWith(span);
  });
}
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "html") e.append(rich(v)); else if (k === "class") e.className = v; else e.setAttribute(k, v);
  }
  e.append(...kids.filter((k) => k !== null && k !== undefined && k !== "").map((k) => typeof k === "string" ? inlineNotation(k) : k));
  return e;
};
const KEY = "parcours:" + S.id;
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} },
};
let progress = store.get(":etapes", {});
const N = S.etapes.length;
const fr = (v, d) => v.toLocaleString(UI.locale, { minimumFractionDigits: d, maximumFractionDigits: d });

function math(node) {
  prepareMathText(node);
  if (window.renderMathInElement) {
    renderMathInElement(node, {
      delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }, { left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
      throwOnError: false,
    });
  }
}
function tex(src, display = true) {
  const d = el("div", { class: display ? "formula" : "" });
  if (window.katex) katex.render(src, d, { displayMode: display, throwOnError: false });
  else d.textContent = src;
  return d;
}
// Signale un changement local : compte.js le synchronise avec le compte, si l'apprenant est connecté.
let changeTimer = null;
function changed() { clearTimeout(changeTimer); changeTimer = setTimeout(() => document.dispatchEvent(new CustomEvent("parcours:change", { detail: S.id })), 1500); }
function markDone(i) {
  const neuf = !progress[i];
  progress[i] = true; store.set(":etapes", progress); segs(current());
  if (neuf) changed();
}
function saveCode(v) { store.set(":code", v); store.set(":code-at", new Date().toISOString()); changed(); }
function current() {
  const m = location.hash.match(/^#etape-(\d+)$/);
  const i = m ? parseInt(m[1], 10) - 1 : 0;
  return Math.min(Math.max(i, 0), N - 1);
}
function segs(i) {
  $("#segs").replaceChildren(...S.etapes.map((e, j) => {
    const a = el("a", { href: "#etape-" + (j + 1), class: (progress[j] ? "ok " : "") + (j === i ? "on" : ""), "aria-label": UI.step(j + 1, e.titre) },
      el("span", { class: "rail-step-index" }, String(j + 1).padStart(2, "0")),
      el("span", { class: "rail-step-name" }, e.titre));
    if (j === i) a.setAttribute("aria-current", "step");
    return a;
  }));
}

/* ---------- Table de Makeham ---------- */
const T = S.table;
const lx = (x) => T.k * Math.pow(T.s, x) * Math.pow(T.g, Math.pow(T.c, x));
const mu = (x) => -Math.log(T.s) - Math.log(T.g) * Math.log(T.c) * Math.pow(T.c, x);
const ex = (x) => { let s = 0; for (let k = 1; k <= T.omega - x; k++) s += lx(x + k); return s / lx(x); };

function interactif() {
  let age = 65;
  const cv = el("canvas", { role: "img", "aria-label": UI.labAria });
  const slider = el("input", { type: "range", min: "20", max: "100", step: "1", value: String(age), id: "age", "aria-label": UI.age });
  const out = {
    age: el("output", { class: "big" }),
    mu: el("output"), q: el("output"), e: el("output"), ec: el("output"),
  };
  const stat = (label, o) => el("div", { class: "stat" }, el("span", { class: "lbl", html: label }), o);
  const panel = el("div", { class: "lab-stats" },
    el("div", { class: "stat age" }, el("span", { class: "lbl" }, UI.age), out.age),
    stat("$\\mu_x$", out.mu), stat("$q_x$", out.q), stat("$e_x$", out.e), stat("$\\mathring{e}_x$", out.ec));
  const box = el("figure", { class: "lab" },
    el("div", { class: "lab-head" }, el("span", { class: "eyebrow" }, UI.labEyebrow), el("span", { class: "hint" }, UI.labHint)),
    cv, el("div", { class: "lab-slider" }, el("span", { class: "mono" }, "20"), slider, el("span", { class: "mono" }, "100")), panel);

  const draw = () => {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const d = window.devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d;
    const c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0);
    const cs = getComputedStyle(document.documentElement);
    const col = (n) => cs.getPropertyValue(n).trim();
    const W = r.width, H = r.height, L = 50, R = 16, Tp = 16, B = 28, x0 = 20, x1 = 100;
    const y0 = Math.log10(0.0005), y1 = Math.log10(1);
    const px = (x) => L + (x - x0) / (x1 - x0) * (W - L - R);
    const py = (v) => Tp + (y1 - Math.log10(v)) / (y1 - y0) * (H - Tp - B);
    c.font = "11px 'JetBrains Mono', ui-monospace, monospace"; c.lineWidth = 1;
    [0.001, 0.01, 0.1, 1].forEach((v) => {
      c.strokeStyle = col("--line"); c.beginPath(); c.moveTo(L, py(v)); c.lineTo(W - R, py(v)); c.stroke();
      c.fillStyle = col("--muted"); c.textAlign = "right"; c.fillText(LANG === "fr" ? String(v).replace(".", ",") : String(v), L - 8, py(v) + 4);
    });
    [20, 40, 60, 80, 100].forEach((x) => { c.fillStyle = col("--muted"); c.textAlign = "center"; c.fillText(String(x), px(x), H - 8); });
    // aire sous la courbe
    const g = c.createLinearGradient(0, Tp, 0, H - B);
    g.addColorStop(0, col("--data-soft")); g.addColorStop(1, col("--surface"));
    c.beginPath(); c.moveTo(px(x0), H - B);
    for (let x = x0; x <= x1; x += 0.5) c.lineTo(px(x), py(mu(x)));
    c.lineTo(px(x1), H - B); c.closePath(); c.fillStyle = g; c.fill();
    c.strokeStyle = col("--data"); c.lineWidth = 2.5; c.beginPath();
    for (let x = x0; x <= x1; x += 0.5) { const y = py(mu(x)); x === x0 ? c.moveTo(px(x), y) : c.lineTo(px(x), y); }
    c.stroke();
    // repère de l'âge choisi
    c.setLineDash([3, 4]); c.strokeStyle = col("--progress"); c.lineWidth = 1;
    c.beginPath(); c.moveTo(px(age), Tp); c.lineTo(px(age), H - B); c.stroke(); c.setLineDash([]);
    c.fillStyle = col("--paper"); c.strokeStyle = col("--progress"); c.lineWidth = 2.5;
    c.beginPath(); c.arc(px(age), py(mu(age)), 5.5, 0, 7); c.fill(); c.stroke();
  };
  const update = () => {
    age = parseInt(slider.value, 10);
    const e = ex(age);
    out.age.textContent = age + UI.years;
    out.mu.textContent = fr(mu(age), 5);
    out.q.textContent = fr(1 - lx(age + 1) / lx(age), 5);
    out.e.textContent = fr(e, 2) + UI.years;
    out.ec.textContent = "≈ " + fr(e + 0.5, 2) + UI.years;
    draw();
  };
  slider.addEventListener("input", update);
  addEventListener("resize", draw);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", draw);
  requestAnimationFrame(update);
  return box;
}

/* ---------- Vidéos ---------- */
// Nothing is loaded from YouTube until the learner clicks: no cookie, no request, no tracking before that.
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
function lecteur(v, grand) {
  const autre = v.langue !== LANG;
  const meta = [v.duree, autre ? UI.otherLang : ""].filter(Boolean).join(" · ");
  const bouton = el("button", { type: "button", class: "video video-play" + (grand ? "" : " small"), "aria-label": UI.play + " : " + v.titre },
    el("div", { class: "video-in" },
      el("span", { class: "eyebrow light" }, "Actu-Basics" + (meta ? " · " + meta : "")),
      el("p", { class: "video-q" }, v.titre),
      el("span", { class: "play", "aria-hidden": "true" }, "▶ " + UI.play)));
  bouton.addEventListener("click", () => {
    const f = el("iframe", {
      class: "video-frame", title: v.titre, loading: "lazy", allowfullscreen: "",
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
      referrerpolicy: "strict-origin-when-cross-origin",
      src: "https://www.youtube-nocookie.com/embed/" + v.id + "?autoplay=1&rel=0",
    });
    bouton.replaceWith(f);
  });
  return bouton;
}

/* ---------- Étapes ---------- */
const R = {
  video(e) {
    // Actu-Basics video of the session, served from assets/videos/ until it is published on YouTube.
    const m = e.media && e.media[LANG];
    if (m && m.src) {
      const asset = (p) => new URL(p, SCRIPT_URL).href;
      const player = el("video", { class: "video-player", controls: "", preload: "metadata", playsinline: "" },
        el("source", { src: asset(m.src), type: "video/mp4" }),
        m.sous_titres ? el("track", { kind: "subtitles", src: asset(m.sous_titres), srclang: LANG, label: UI.subtitles }) : null);
      return [player, el("p", {}, e.texte)];
    }
    const ab = S.actu_basics || {};
    const vids = (ab.videos || []).filter((v) => YT_ID.test(v.id || ""));
    if (!vids.length) {
      return [el("div", { class: "video" },
        el("div", { class: "video-in" },
          el("span", { class: "eyebrow light" }, "Actu-Basics · " + (ab.episode || "")),
          el("p", { class: "video-q" }, LANG === "en" ? "“" + (ab.accroche_en || "") + "”" : "« " + (ab.accroche_fr || "") + " »"),
          el("span", { class: "pill" }, UI.videoSoon))),
        el("p", {}, e.texte)];
    }
    // The page language first; the other language stays available, labelled as such.
    vids.sort((a, b) => (a.langue === LANG ? 0 : 1) - (b.langue === LANG ? 0 : 1));
    return [el("div", { class: "videos" }, ...vids.map((v, k) => lecteur(v, k === 0))), el("p", {}, e.texte)];
  },
  rappel(e) {
    return e.blocs.map((b) => {
      if (b.p) return el("p", { html: b.p });
      if (b.formule) return tex(b.formule);
      if (b.note) return el("aside", { class: "note" }, el("span", { class: "eyebrow" }, UI.job), el("p", { html: b.note }));
      if (b.interactif) return interactif();
      if (b.sources) return el("section", { class: "sources" }, el("span", { class: "eyebrow" }, UI.further),
        el("ol", {}, ...b.sources.map((s) => el("li", {},
          sourceUrl(s.url) ? el("a", { href: sourceUrl(s.url), target: "_blank", rel: "noopener noreferrer" }, s.titre) : el("span", { class: "src-t" }, s.titre),
          el("span", { class: "src-d" }, s.detail)))));
      return "";
    });
  },
  quiz(e, i) {
    const explication = (p) => {
      if (typeof p === "string") return `<p>${p}</p>`;
      const ligne = (k, lib) => p[k] ? `<p class="why-l"><span class="why-k">${lib}</span><span class="why-sep">: </span>${p[k]}</p>` : "";
      return ligne("rappel", UI.recap) + (p.formule ? `<div class="why-f">$$${p.formule}$$</div>` : "")
        + ligne("exemple", UI.example) + ligne("piege", UI.pitfall);
    };
    const ok = new Set();
    const score = el("p", { class: "score" });
    const upd = () => { score.textContent = UI.score(ok.size, e.questions.length); };
    const qs = e.questions.map((it, qi) => {
      const why = el("div", { class: "why", html: "" }); why.hidden = true;
      const opts = el("div", { class: "opts", role: "group" }, ...it.options.map((t, j) => {
        const b = el("button", { class: "opt", type: "button" }, el("span", { class: "k" }, String.fromCharCode(65 + j)), " ", el("span", {}, rich(t)));
        b.addEventListener("click", () => {
          opts.querySelectorAll(".opt").forEach((x) => x.classList.remove("right", "wrong"));
          const good = j === it.reponse;
          b.classList.add(good ? "right" : "wrong");
          why.hidden = false;
          why.replaceChildren(
            el("p", { class: "why-v " + (good ? "ok" : "ko") }, good ? UI.right : UI.wrong),
            rich(explication(it.pourquoi)),
          );
          math(why);
          if (good) ok.add(qi); else ok.delete(qi);
          upd(); if (ok.size === e.questions.length) markDone(i);
        });
        return b;
      }));
      return el("div", { class: "q" }, el("span", { class: "qn mono" }, String(qi + 1).padStart(2, "0")), el("div", { class: "q-body" }, el("h3", { html: it.q }), opts, why));
    });
    upd();
    return [el("div", { class: "qs" }, ...qs), el("div", { class: "score-row" }, el("span", { class: "eyebrow" }, UI.scoreLbl), score)];
  },
  calcul(e, i) {
    const t = el("div", { class: "tbl" }, el("table", {},
      el("thead", {}, el("tr", {}, ...e.donnees.entetes.map((h) => el("th", { html: h })))),
      el("tbody", {}, ...e.donnees.lignes.map((r) => el("tr", {}, ...r.map((c) => el("td", { html: c })))))));
    const fields = el("div", { class: "fields" }, ...e.champs.map((c) => el("div", { class: "field" },
      el("label", { for: "c_" + c.cle, html: c.libelle }),
      el("span", { class: "eq" }, "="),
      el("input", { id: "c_" + c.cle, inputmode: "decimal", placeholder: UI.placeholder, autocomplete: "off" }),
      el("span", { class: "st", id: "st_" + c.cle, "aria-live": "polite" }))));
    const check = el("button", { class: "btn", type: "button" }, UI.check);
    check.addEventListener("click", () => {
      let all = true;
      for (const c of e.champs) {
        const raw = $("#c_" + c.cle).value.trim().replace(/\s/g, "").replace(",", ".");
        const good = raw !== "" && Math.abs(parseFloat(raw) - c.valeur) <= c.tolerance;
        const st = $("#st_" + c.cle);
        st.className = "st " + (raw === "" ? "" : good ? "good" : "bad");
        st.textContent = raw === "" ? UI.toFill : good ? UI.good : UI.bad;
        all = all && good;
      }
      if (all) markDone(i);
    });
    const sol = el("details", { class: "solution" }, el("summary", {}, UI.solution), el("div", { html: e.solution.replace(/\n/g, "<br>") }));
    return [t, fields, el("div", { class: "row" }, check), sol];
  },
  code(e, i) {
    const ta = el("textarea", { id: "code", spellcheck: "false", "aria-label": UI.codeAria });
    ta.value = store.get(":code", null) || e.depart;
    const res = el("ol", { class: "results", "aria-live": "polite" },
      ...e.tests.map((t) => el("li", { class: "idle" }, el("span", { class: "dot" }), el("span", { class: "tn", html: t.nom }), el("span", { class: "tm" }))));
    const summary = el("p", { class: "res-sum" }, UI.runHint);
    const run = el("button", { class: "btn", type: "button" }, el("span", {}, UI.run), el("kbd", {}, "Ctrl ↵"));
    const reset = el("button", { class: "btn ghost", type: "button" }, UI.reset);
    const shell = el("div", { class: "editor" }, el("div", { class: "editor-bar" }, el("span", { class: "dots" }, el("i"), el("i"), el("i")), el("span", { class: "mono fname" }, e.fichier.split("/").pop())), ta);
    let cm = null;
    const value = () => (cm ? cm.getValue() : ta.value);
    requestAnimationFrame(() => {
      if (!window.CodeMirror) return;
      cm = CodeMirror.fromTextArea(ta, {
        mode: "python", lineNumbers: true, indentUnit: 4, tabSize: 4, matchBrackets: true, autoCloseBrackets: true,
        viewportMargin: Infinity,
        extraKeys: { Tab: (c) => c.replaceSelection("    "), "Ctrl-Enter": () => run.click(), "Cmd-Enter": () => run.click() },
      });
      cm.on("change", (c, ch) => { if (ch.origin !== "setValue") saveCode(cm.getValue()); });
    });
    ta.addEventListener("input", () => saveCode(ta.value));
    reset.addEventListener("click", () => { if (cm) cm.setValue(e.depart); else ta.value = e.depart; saveCode(e.depart); });
    const stop = el("button", { class: "btn ghost", type: "button", hidden: "" }, UI.stop);
    stop.addEventListener("click", () => { stopPython(); });
    run.addEventListener("click", async () => {
      run.disabled = true; stop.hidden = false;
      summary.className = "res-sum";
      summary.textContent = UI.loading;
      [...res.children].forEach((li) => { li.className = "run"; li.querySelector(".tm").textContent = ""; });
      try {
        const results = await runPython(value(), e.tests.map((t) => t.expr), () => { summary.textContent = UI.running; });
        let n = 0;
        results.forEach((r, k) => {
          const li = res.children[k], msg = li.querySelector(".tm");
          li.className = r.status;
          if (r.status === "pass") n++;
          msg.textContent = r.status === "todo" ? UI.todo : r.msg === "unexpected" ? UI.unexpected : r.msg;
        });
        summary.textContent = n === e.tests.length ? UI.allPass(n) : UI.somePass(n, e.tests.length);
        summary.className = "res-sum " + (n === e.tests.length ? "good" : "");
        if (n === e.tests.length) markDone(i);
      } catch (err) {
        [...res.children].forEach((li) => { li.className = "idle"; });
        summary.textContent = String(err.message || err);
      }
      run.disabled = false; stop.hidden = true;
    });
    const where = el("p", { class: "hint" }, UI.repo, el("code", {}, e.fichier), UI.repoEnd);
    return [shell, el("div", { class: "row" }, run, stop, reset), el("div", { class: "results-box" }, summary, res), where];
  },
  vocabulaire(e, i) {
    const seen = new Set();
    return [el("div", { class: "cards" }, ...e.cartes.map(([f, en, exm], j) => {
      // En anglais, la carte montre le terme anglais et révèle le terme français.
      const [recto, verso] = LANG === "en" ? [en, f] : [f, en];
      const b = el("button", { class: "card", type: "button", "aria-expanded": "false" },
        el("span", { class: "fr" }, recto), el("span", { class: "tap" }, UI.flip),
        el("span", { class: "back" }, el("b", {}, verso), el("i", {}, exm)));
      b.addEventListener("click", () => {
        const on = b.classList.toggle("flip"); b.setAttribute("aria-expanded", String(on));
        seen.add(j); if (seen.size === e.cartes.length) markDone(i);
      });
      return b;
    }))];
  },
};
const lastLine = (err) => String(err.message || err).trim().split("\n").pop();

/* ---------- Python dans une iframe sandboxée à origine opaque ---------- */
// Le code tourne dans un Worker Blob créé depuis une iframe opaque. Le Worker hérite
// de la CSP initiale, ne possède ni DOM ni accès parent, et peut être tué en supprimant l'iframe.
const PY_LIMITE_MS = 10000;
const PY_CHARGEMENT_LIMITE_MS = 60000;
const PY_MAX_CODE = 50000;
const PY_MAX_TESTS = 30;
const PY_MAX_TEST_CHARS = 2000;
const PY_MAX_TOTAL_TEST_CHARS = 20000;
const PY_MAX_ERROR_CHARS = 500;
const PY_RESULTATS = new Set(["pass", "fail", "todo"]);
let pythonFrame = null, pythonPort = null, pending = null, seq = 0;

function closePythonSandbox() {
  if (pythonPort) {
    pythonPort.onmessage = null;
    pythonPort.onmessageerror = null;
    pythonPort.close();
    pythonPort = null;
  }
  if (pythonFrame) {
    pythonFrame.remove();
    pythonFrame = null;
  }
}

function stopPython(raison) {
  closePythonSandbox();
  if (pending) {
    const p = pending; pending = null; clearTimeout(p.timer);
    p.reject(new Error(raison || UI.stopped));
  }
}

function pythonSandboxDocument() {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(18)),
    (b) => b.toString(16).padStart(2, "0")).join("");
  const bootstrapPolicy = "default-src 'none'; script-src 'nonce-" + nonce +
    "' https://cdn.jsdelivr.net/pyodide/v0.27.7/full/ 'wasm-unsafe-eval'; " +
    "connect-src https://cdn.jsdelivr.net/pyodide/v0.27.7/full/; " +
    "worker-src blob:; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; media-src 'none'; " +
    "object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
  const bootstrap = "\n(() => {\n  let port = null;\n  let worker = null;\n  let workerPort = null;\n  let workerUrl = null;\n  let ready = false;\n  function lockIframe() {\n    const lockdown = document.createElement(\"meta\");\n    lockdown.httpEquiv = \"Content-Security-Policy\";\n    lockdown.content = \"default-src 'none'; script-src 'none'; connect-src 'none'; \" +\n      \"img-src 'none'; font-src 'none'; media-src 'none'; style-src 'none'; \" +\n      \"object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; \" +\n      \"worker-src 'none'; manifest-src 'none'\";\n    document.head.append(lockdown);\n  }\n  function initialize(event) {\n    if (port || event.source !== parent || !event.data || event.data.type !== \"parcours-python-init\" || event.ports.length !== 1) return;\n    window.removeEventListener(\"message\", initialize);\n    port = event.ports[0];\n    port.onmessage = (messageEvent) => {\n      if (ready && workerPort) workerPort.postMessage(messageEvent.data);\n    };\n    port.start();\n    try {\n      const source = \"\\nlet py = null;\\nlet port = null;\\nconst MAX_CODE = 50000, MAX_TESTS = 30, MAX_TEST_CHARS = 2000, MAX_TOTAL_TEST_CHARS = 20000, MAX_ERROR = 500;\\nconst errorText = (error) => String((error && error.message) || error).trim().split(\\\"\\\\n\\\").pop().slice(0, MAX_ERROR);\\n\\nfunction restrictRuntimeCapabilities() {\\n  const blocked = [\\n    \\\"fetch\\\", \\\"XMLHttpRequest\\\", \\\"WebSocket\\\", \\\"WebSocketStream\\\", \\\"EventSource\\\", \\\"WebTransport\\\",\\n    \\\"RTCPeerConnection\\\", \\\"webkitRTCPeerConnection\\\", \\\"BroadcastChannel\\\", \\\"indexedDB\\\", \\\"caches\\\",\\n    \\\"importScripts\\\", \\\"Worker\\\", \\\"SharedWorker\\\", \\\"postMessage\\\", \\\"loadPyodide\\\"\\n  ];\\n  for (const name of blocked) {\\n    try {\\n      Object.defineProperty(self, name, {\\n        configurable: false,\\n        enumerable: false,\\n        get: () => undefined\\n      });\\n    } catch {\\n      try { self[name] = undefined; } catch {}\\n    }\\n  }\\n  const nav = self.navigator;\\n  try { Object.defineProperty(nav, \\\"sendBeacon\\\", { configurable: false, enumerable: false, value: undefined }); } catch {\\n    try { nav.sendBeacon = undefined; } catch {}\\n  }\\n  let proto = Object.getPrototypeOf(nav);\\n  while (proto) {\\n    if (Object.prototype.hasOwnProperty.call(proto, \\\"sendBeacon\\\")) {\\n      try { Object.defineProperty(proto, \\\"sendBeacon\\\", { configurable: false, enumerable: false, value: undefined }); } catch {\\n        try { proto.sendBeacon = undefined; } catch {}\\n      }\\n      break;\\n    }\\n    proto = Object.getPrototypeOf(proto);\\n  }\\n}\\n\\nfunction validateRequest(data) {\\n  if (!data || !Number.isSafeInteger(data.id) || data.id < 1 ||\\n      typeof data.code !== \\\"string\\\" || data.code.length > MAX_CODE ||\\n      !Array.isArray(data.tests) || data.tests.length < 1 || data.tests.length > MAX_TESTS) {\\n    throw new Error(\\\"Requête Python invalide.\\\");\\n  }\\n  let total = 0;\\n  for (const expression of data.tests) {\\n    if (typeof expression !== \\\"string\\\" || expression.length > MAX_TEST_CHARS) {\\n      throw new Error(\\\"Expression de test invalide ou trop longue.\\\");\\n    }\\n    total += expression.length;\\n  }\\n  if (total > MAX_TOTAL_TEST_CHARS) throw new Error(\\\"Ensemble des tests trop volumineux.\\\");\\n}\\n\\nasync function execute(data) {\\n  validateRequest(data);\\n  port.postMessage({ id: data.id, phase: \\\"running\\\" });\\n  const namespace = py.globals.get(\\\"dict\\\")();\\n  let setupError = null;\\n  try {\\n    await py.runPythonAsync(data.code, { globals: namespace });\\n  } catch (error) {\\n    setupError = errorText(error);\\n  }\\n  const results = [];\\n  for (const expression of data.tests) {\\n    if (setupError) {\\n      results.push({ status: \\\"fail\\\", msg: setupError });\\n      continue;\\n    }\\n    try {\\n      const value = await py.runPythonAsync(expression, { globals: namespace });\\n      const ok = value === true || (typeof value === \\\"number\\\" && value !== 0);\\n      if (value && typeof value.destroy === \\\"function\\\") value.destroy();\\n      results.push({ status: ok ? \\\"pass\\\" : \\\"fail\\\", msg: ok ? \\\"\\\" : \\\"unexpected\\\" });\\n    } catch (error) {\\n      const msg = errorText(error);\\n      results.push(/NotImplementedError/.test(msg)\\n        ? { status: \\\"todo\\\", msg: \\\"\\\" }\\n        : { status: \\\"fail\\\", msg });\\n    }\\n  }\\n  try { if (namespace.destroy) namespace.destroy(); } catch {}\\n  port.postMessage({ id: data.id, phase: \\\"done\\\", results });\\n}\\n\\nasync function connect(event) {\\n  if (port || !event.data || event.data.type !== \\\"connect\\\" || event.ports.length !== 1) return;\\n  self.removeEventListener(\\\"message\\\", connect);\\n  port = event.ports[0];\\n  port.onmessage = async (messageEvent) => {\\n    try {\\n      await execute(messageEvent.data);\\n    } catch (error) {\\n      port.postMessage({ id: messageEvent.data && messageEvent.data.id, phase: \\\"error\\\", msg: errorText(error) });\\n    }\\n  };\\n  port.start();\\n  try {\\n    importScripts(\\\"https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js\\\");\\n    py = await loadPyodide({\\n      indexURL: \\\"https://cdn.jsdelivr.net/pyodide/v0.27.7/full/\\\",\\n      stdout: () => {},\\n      stderr: () => {}\\n    });\\n    let cspBlocked = false;\\n    const onViolation = (event) => {\\n      if (event.effectiveDirective === \\\"connect-src\\\" && String(event.blockedURI).includes(\\\"example.com\\\")) {\\n        cspBlocked = true;\\n      }\\n    };\\n    self.addEventListener(\\\"securitypolicyviolation\\\", onViolation);\\n    try { await fetch(\\\"https://example.com/\\\", { mode: \\\"no-cors\\\" }); } catch {}\\n    await new Promise((resolve) => setTimeout(resolve, 50));\\n    self.removeEventListener(\\\"securitypolicyviolation\\\", onViolation);\\n    restrictRuntimeCapabilities();\\n    port.postMessage({ phase: \\\"ready\\\", networkBlocked: cspBlocked });\\n  } catch (error) {\\n    port.postMessage({ phase: \\\"error\\\", msg: errorText(error) });\\n  }\\n}\\nself.addEventListener(\\\"message\\\", connect);\\n\";\n      workerUrl = URL.createObjectURL(new Blob([source], { type: \"text/javascript\" }));\n      const channel = new MessageChannel();\n      workerPort = channel.port1;\n      workerPort.onmessage = (messageEvent) => {\n        const message = messageEvent.data;\n        if (message && message.phase === \"ready\" && !ready) {\n          ready = true;\n          lockIframe();\n          if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = null; }\n        }\n        if (port) port.postMessage(message);\n      };\n      workerPort.onmessageerror = () => {\n        if (port) port.postMessage({ phase: \"error\", msg: \"Réponse illisible du moteur Python.\" });\n      };\n      workerPort.start();\n      worker = new Worker(workerUrl);\n      worker.onerror = () => {\n        if (port) port.postMessage({ phase: \"error\", msg: \"Le moteur Python a échoué.\" });\n        if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = null; }\n      };\n      worker.onmessageerror = () => {\n        if (port) port.postMessage({ phase: \"error\", msg: \"Réponse illisible du moteur Python.\" });\n      };\n      worker.postMessage({ type: \"connect\" }, [channel.port2]);\n    } catch (error) {\n      if (port) port.postMessage({ phase: \"error\", msg: String((error && error.message) || error).slice(0, 500) });\n    }\n  }\n  window.addEventListener(\"message\", initialize);\n})();\n";
  return "<!doctype html><html><head><meta charset=\"utf-8\">" +
    "<meta http-equiv=\"Content-Security-Policy\" content=\"" + bootstrapPolicy + "\"></head><body>" +
    "<script nonce=\"" + nonce + "\">" + bootstrap + "</script></body></html>";
}

function runPython(code, tests, onRunning) {
  stopPython();
  if (typeof code !== "string" || code.length > PY_MAX_CODE) {
    return Promise.reject(new Error("Code trop long (maximum " + PY_MAX_CODE + " caractères)."));
  }
  if (!Array.isArray(tests) || tests.length < 1 || tests.length > PY_MAX_TESTS) {
    return Promise.reject(new Error("Nombre de tests invalide (maximum " + PY_MAX_TESTS + ")."));
  }
  let total = 0;
  for (const expression of tests) {
    if (typeof expression !== "string" || expression.length > PY_MAX_TEST_CHARS) {
      return Promise.reject(new Error("Expression de test invalide ou trop longue."));
    }
    total += expression.length;
  }
  if (total > PY_MAX_TOTAL_TEST_CHARS) {
    return Promise.reject(new Error("Ensemble des tests trop volumineux."));
  }

  return new Promise((resolve, reject) => {
    const id = ++seq;
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("data-parcours-python-sandbox", "true");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.referrerPolicy = "no-referrer";
    frame.title = "Isolated Python execution";
    frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0;visibility:hidden";
    pythonFrame = frame;
    pending = { id, resolve, reject, timer: null, phase: "loading" };

    let channel;
    try {
      channel = new MessageChannel();
      pythonPort = channel.port1;
    } catch {
      stopPython(UI.loadFail);
      return;
    }

    pythonPort.onmessage = (event) => {
      const message = event.data;
      if (!pending || !message) return;
      if (message.phase === "ready" && pending.phase === "loading") {
        frame.setAttribute("data-network-blocked", String(message.networkBlocked === true));
        if (message.networkBlocked !== true) {
          stopPython("La politique réseau du moteur Python n'a pas bloqué les destinations externes.");
          return;
        }
        pending.phase = "ready";
        if (pythonFrame) pythonFrame.dataset.networkBlocked = "true";
        try { pythonPort.postMessage({ id, code, tests }); }
        catch { stopPython(UI.cantSend); }
        return;
      }
      if (message.phase === "error") {
        stopPython(typeof message.msg === "string" ? message.msg.slice(0, PY_MAX_ERROR_CHARS) : UI.loadFail);
        return;
      }
      if (message.id !== pending.id) return;
      if (message.phase === "running" && pending.phase === "ready") {
        pending.phase = "running";
        if (onRunning) onRunning();
        clearTimeout(pending.timer);
        pending.timer = setTimeout(() => stopPython(UI.timeout(PY_LIMITE_MS / 1000)), PY_LIMITE_MS);
        return;
      }
      if (message.phase === "done") {
        const valid = Array.isArray(message.results) &&
          message.results.length === tests.length &&
          message.results.every((result) => result && PY_RESULTATS.has(result.status) &&
            typeof result.msg === "string" && result.msg.length <= PY_MAX_ERROR_CHARS);
        if (!valid) {
          stopPython(UI.badReply);
          return;
        }
        const p = pending; pending = null; clearTimeout(p.timer);
        closePythonSandbox();
        p.resolve(message.results);
      }
    };
    pythonPort.onmessageerror = () => stopPython(UI.unreadable);
    pythonPort.start();
    frame.addEventListener("load", () => {
      if (!pending || pending.id !== id) return;
      try { frame.contentWindow.postMessage({ type: "parcours-python-init" }, "*", [channel.port2]); }
      catch { stopPython(UI.cantSend); }
    }, { once: true });
    frame.onerror = () => stopPython(UI.loadFail);
    frame.srcdoc = pythonSandboxDocument();
    document.body.append(frame);
    pending.timer = setTimeout(() => stopPython(UI.loadTimeout(PY_CHARGEMENT_LIMITE_MS / 1000)), PY_CHARGEMENT_LIMITE_MS);
  });
}

function render() {
  const i = current(), e = S.etapes[i];
  segs(i);
  const stage = $("#stage");
  stage.replaceChildren(
    el("div", { class: "step-head" },
      el("span", { class: "eyebrow" }, UI.stepOf(i + 1, N, e.minutes)),
      el("h1", {}, e.titre),
      e.intro ? el("p", { class: "lead", html: e.intro }) : null),
    el("div", { class: "flow" }, ...R[e.type](e, i)));
  math(stage);
  stage.classList.remove("enter"); void stage.offsetWidth; stage.classList.add("enter");
  if (e.type === "rappel" || e.type === "video") markDone(i);
  $("#prev").disabled = i === 0;
  $("#prev").textContent = UI.prev;
  $("#next").textContent = i === N - 1 ? UI.finish : UI.next;
  const w = $("#where"); w.replaceChildren(el("a", { href: S.module_url }, S.module_titre), ` · ${S.titre}`);
  document.title = `${e.titre} · ${S.titre}`;
  window.scrollTo({ top: 0 });
}
$("#prev").addEventListener("click", () => { const i = current(); if (i > 0) location.hash = "etape-" + i; });
$("#next").addEventListener("click", () => {
  const i = current();
  if (i === N - 1) location.href = S.module_url; else location.hash = "etape-" + (i + 2);
});
addEventListener("keydown", (ev) => {
  const t = ev.target;
  if (t.closest && t.closest("input, textarea, .CodeMirror, [role=tablist]")) return;
  if (ev.key === "ArrowRight") $("#next").click();
  if (ev.key === "ArrowLeft") $("#prev").click();
});
addEventListener("hashchange", render);
// Progression arrivée d'un autre appareil : on recharge l'état local et on réaffiche l'étape.
document.addEventListener("parcours:remote", (ev) => {
  if (!(ev.detail || []).includes(S.id)) return;
  progress = store.get(":etapes", {});
  const enEdition = document.activeElement && document.activeElement.closest && document.activeElement.closest(".CodeMirror, textarea");
  if (enEdition) segs(current()); else render();
});
render();
