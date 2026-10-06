// test-harness.js — Formation DIH v9 — harnais de tests
// Usage : node test-harness.js (à la racine du dépôt)
// Vérifie : structure index.html, cœur de données, rendu app, interactions,
// checklists, quiz, persistance, accordéons v3, PWA (sw/manifest/version/workflow), icônes.
// Compatibilité : node >= 18 ; aussi exécutable en sandbox avec fs stubbé.

var fs = null;
if (typeof require === "function") { try { fs = require("fs"); } catch (e) {} }
if (!fs) throw new Error("Module fs indisponible — lancer avec : node test-harness.js");

function slurp(name) {
  var cands = ["./" + name, name];
  for (var i = 0; i < cands.length; i++) {
    try { return fs.readFileSync(cands[i], "utf8"); } catch (e) {}
  }
  throw new Error("fichier introuvable : " + name);
}

var PASS = 0, FAIL = 0, FAILURES = [];
function ok(name, cond) {
  if (cond) { PASS++; } else { FAIL++; FAILURES.push(name); }
}
function eq(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function cnt(html, re) { return (html.match(re) || []).length; }

(async function () {

  // ============================================================
  // 1. STRUCTURE index.html
  // ============================================================
  var index = slurp("index.html");
  ok("structure: doctype", index.indexOf("<!doctype html>") === 0);
  ok("structure: lang fr", index.indexOf('<html lang="fr">') !== -1);
  ok("structure: charset utf-8", index.indexOf('charset="utf-8"') !== -1);
  ok("structure: viewport", index.indexOf('name="viewport"') !== -1);
  ok("structure: theme-color", index.indexOf("theme-color") !== -1);
  ok("structure: manifest lié", index.indexOf('href="manifest.webmanifest"') !== -1);
  ok("structure: icon svg lié", index.indexOf('href="icon.svg"') !== -1);
  ok("structure: apple-touch-icon", index.indexOf("apple-touch-icon") !== -1);
  ok("structure: div#app", index.indexOf('id="app"') !== -1);
  ok("structure: div#badge", index.indexOf('id="badge"') !== -1);
  ok("structure: 2 blocs script équilibrés", (index.match(/<script>/g) || []).length === 2 && (index.match(/<\/script>/g) || []).length === 2);
  ok("structure: pas de mojibake UTF-8", index.indexOf("Ã") === -1 && index.indexOf("Â") === -1);
  ok("structure: titre Formation DIH", index.indexOf("Formation DIH") !== -1);
  ok("structure: PATRACDR présent", index.indexOf("PATRACDR") !== -1);
  ok("structure: DPIF présent", index.indexOf("DPIF") !== -1);
  ok("structure: téléphone adjudant", index.indexOf("06 32 87 16 70") !== -1);
  ok("structure: clé N°23 retirée", index.indexOf("N°23") === -1);
  ok("v6: base 18px", index.indexOf("html { font-size: 18px; }") !== -1);
  ok("v6: interligne 1.58", index.indexOf("line-height: 1.58") !== -1);
  ok("v7: onglets agrandis (icônes 1.75rem, labels 0.74rem)", index.indexOf(".tab-ico { font-size: 1.75rem") !== -1 && index.indexOf("font-size: 0.74rem; font-weight: 700; cursor: pointer;") !== -1);
  ok("v7: css zoom dessins (overlay + pinch)", index.indexOf(".zoombox") !== -1 && index.indexOf("touch-action: none") !== -1);
  ok("structure: BIP LONG", index.indexOf("BIP LONG") !== -1);
  ok("structure: STANAG", index.indexOf("STANAG") !== -1);
  ok("structure: 13 hommes", index.indexOf("13 HOMMES") !== -1);
  ok("structure: sw registration", index.indexOf("serviceWorker") !== -1);
  ok("structure: cache CSS sombre", index.indexOf("#0f172a") !== -1);
  ok("v3: tabbar bas d'écran (CSS)", index.indexOf(".tabbar") !== -1);
  ok("v3: safe-area (encoche)", index.indexOf("safe-area-inset-bottom") !== -1);
  ok("v3: focus visible (a11y)", index.indexOf(":focus-visible") !== -1);
  ok("v3: accordéons (CSS)", index.indexOf(".accbody") !== -1);
  ok("v3: donut progression (CSS)", index.indexOf(".donut-fg") !== -1);

  // ============================================================
  // 2. STUBS DOM + évaluation des scripts
  // ============================================================
  var lsStore = {};
  var localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null; },
    setItem: function (k, v) { lsStore[k] = String(v); },
    removeItem: function (k) { delete lsStore[k]; }
  };
  var swReg = [];
  var navigator = { serviceWorker: { register: function (p) { swReg.push(p); return { catch: function () {} }; } } };
  var fetchCalls = [];
  var fetch = function (url, opts) {
    fetchCalls.push(url);
    return Promise.resolve({ json: function () { return Promise.resolve({ app: "formation-dih", version: "v9", date: "2026-10-06" }); } });
  };
  var APP_EL = { innerHTML: "", querySelectorAll: function (sel) { return QSA(this.innerHTML, sel.slice(1, -1)); } };
  var BADGE_EL = { textContent: "💾 Hors ligne" };
  var listeners = { dom: null, clicks: [] };
  var document = {
    readyState: "complete",
    addEventListener: function (evt, cb) { if (evt === "DOMContentLoaded") listeners.dom = cb; },
    getElementById: function (id) { return id === "app" ? APP_EL : (id === "badge" ? BADGE_EL : null); }
  };
  var win = { location: { href: "https://jeffbuzz060684.github.io/formation-dih/" } };
  var window = win; win.window = win;

  function QSA(html, attr) {
    var re = new RegExp('<button[^>]*' + attr + '="([^"]*)"[^>]*>', "g");
    var out = [], m;
    while ((m = re.exec(html)) !== null) {
      (function (mm) {
        out.push({
          getAttribute: function () { return mm[1]; },
          addEventListener: function (type, fn) { listeners.clicks.push({ attr: attr, val: mm[1], fn: fn }); }
        });
      })(m);
    }
    return out;
  }

  var scripts = [];
  var sre = /<script>([\s\S]*?)<\/script>/g, sm;
  while ((sm = sre.exec(index)) !== null) scripts.push(sm[1]);
  ok("eval: 2 scripts extraits", scripts.length === 2);

  var evalErr = null;
  try { eval(scripts[0]); eval(scripts[1]); } catch (e) { evalErr = e; }
  ok("eval: cœur + app évalués sans erreur", evalErr === null);
  if (evalErr) ok("eval: détail " + evalErr.message, false);

  // ============================================================
  // 3. CŒUR DE DONNÉES (contenu verrouillé)
  // ============================================================
  ok("data: D défini", typeof D === "object" && D !== null);
  ok("data: accueil défini", typeof D.accueil === "object");
  ok("data: accueil titre", D.accueil.titre === "FORMATION DIH");
  ok("data: accueil 6 objectifs", D.accueil.objectifs.length === 6);
  ok("data: accueil 4 parcours", D.accueil.parcours.length === 4);
  ok("data: 2 modules", D.modules.length === 2);
  ok("data: module 1 = equipier", D.modules[0].id === "equipier");
  ok("data: module 2 = chef", D.modules[1].id === "chef");
  ok("data: equipier 7 sections", D.modules[0].sections.length === 7);
  ok("data: equipier quiz 10", D.modules[0].quiz.length === 10);
  ok("data: chef 7 sections", D.modules[1].sections.length === 7);
  ok("data: chef quiz 10", D.modules[1].quiz.length === 10);
  ok("data: reflexe 3 phases", D.reflexe.phases.length === 3);
  ok("data: reflexe phase1 5 étapes", D.reflexe.phases[0].steps.length === 5);
  ok("data: reflexe phase2 2 étapes", D.reflexe.phases[1].steps.length === 2);
  ok("data: reflexe phase3 (départ) 3 étapes", D.reflexe.phases[2].steps.length === 3);
  ok("data: reflexe quiz 5", D.reflexe.quiz.length === 5);
  ok("data: reflexe 2 observations", D.reflexe.obs.length === 2);
  ok("data: grue 5 phases", D.grue.phases.length === 5);
  ok("data: grue phase2 13 étapes", D.grue.phases[1].steps.length === 13);
  ok("data: grue phase3 3 warnings", D.grue.phases[2].warn.length === 3);
  ok("data: grue quiz 5", D.grue.quiz.length === 5);
  ok("data: total 30 questions", 10 + 10 + 5 + 5 === 30);

  var allOk = true;
  [D.modules[0].quiz, D.modules[1].quiz, D.reflexe.quiz, D.grue.quiz].forEach(function (qs) {
    qs.forEach(function (it) {
      if (typeof it.a !== "number" || it.a < 0 || it.a >= it.opts.length || !it.q || !it.ex) allOk = false;
    });
  });
  ok("data: toutes les questions/réponses/explications valides", allOk);

  ok("data: SIGNES 14 codes", Object.keys(SIGNES).length === 14);
  ok("data: SVGS 11 dessins (7 DIH + 4 motopompes)", Object.keys(SVGS).length === 11);
  ["stick", "dz", "etab", "sling", "approche", "matos", "signes"].forEach(function (k) {
    var s = "";
    var err = null;
    try { s = SVGS[k](); } catch (e) { err = e; }
    ok("svg: " + k + " valide", err === null && s.indexOf("<svg") === 0 && s.indexOf("</svg>") !== -1 && s.indexOf("viewBox") !== -1);
  });
  ok("svg: stick affiche 13 hommes", SVGS.stick().indexOf("13 HOMMES") !== -1);
  ok("svg: signes cite STANAG", SVGS.signes().indexOf("STANAG") !== -1);
  ok("svg: dz zone de repli", SVGS.dz().indexOf("REPLI") !== -1);
  ok("svg: etab fontainier", SVGS.etab().indexOf("FONTAINIER") !== -1);
  ok("svg: sling élingue 10 m", SVGS.sling().indexOf("élingue 10 m") !== -1);
  ok("svg: approche jamais à l", SVGS.approche().indexOf("JAMAIS") !== -1);
  ok("svg: matos mélange 4 %", SVGS.matos().indexOf("MÉLANGE 4 %") !== -1);

  var JD = JSON.stringify(D);
  ok("fait: motopompes 250/4", JD.indexOf("250/4") !== -1);
  ok("fait: motopompe 16 kg", JD.indexOf("16 kg") !== -1);
  ok("fait: flottante 22 kg", JD.indexOf("22 kg") !== -1);
  ok("fait: WAJAX 250/10 DN 65", JD.indexOf("250/10") !== -1 && JD.indexOf("DN 65") !== -1);
  ok("fait: citernes 500/800/1000", JD.indexOf("500 – 800 ou 1000") !== -1);
  ok("fait: DZ 30 × 30 m", JD.indexOf("30 × 30 m") !== -1);
  ok("fait: eau 8 L/pers/jour", JD.indexOf("8 L/personne/jour") !== -1 || JD.indexOf("8 L d") !== -1);
  ok("fait: 112 litres eau stick", JD.indexOf("112 litres") !== -1);
  ok("fait: 42 repas stick", JD.indexOf("42 repas") !== -1);
  ok("fait: perte de charge 1,5", JD.indexOf("1,5") !== -1);
  ok("fait: tuyaux 15 bars max", JD.indexOf("15 bars") !== -1);
  ok("fait: motopompe 2/3 capacité", JD.indexOf("2/3") !== -1);
  ok("fait: indicatif PIROX", JD.indexOf("PIROX") !== -1);
  ok("fait: élingue 10 m", JD.indexOf("10 m") !== -1);
  ok("fait: dévidoir DN 70 280 kg", JD.indexOf("280") !== -1);
  ok("fait: bip 90 %", JD.indexOf("90 %") !== -1);
  ok("fait: bip 100 %", JD.indexOf("100 %") !== -1);
  ok("fait: boîtier MOL", JD.indexOf("MOL") !== -1);
  ok("fait: KESTREL à l'ombre", JD.indexOf("À L'OMBRE") !== -1);
  ok("fait: STANAG-3117 / OTAN 2014", JD.indexOf("STANAG-3117") !== -1 && JD.indexOf("OTAN 2014") !== -1);
  ok("fait: bivouac 48 h", JD.indexOf("48 h") !== -1);
  ok("fait: rotor 12 à 16 m", JD.indexOf("12 à 16 m") !== -1);
  ok("fait: filet 3,4 m / 1 à 1,4 t", JD.indexOf("3,4 m") !== -1 && JD.indexOf("1,4 t") !== -1);
  ok("fait: A-52 maintenez la position", SIGNES["A-52"].indexOf("maintenez") !== -1);
  ok("fait: B-18 charge non libérée", SIGNES["B-18"].indexOf("lib") !== -1);
  ok("fait: B-17 décrochez la charge", SIGNES["B-17"].indexOf("décrochez") !== -1);

  // ============================================================
  // 4. APP — BOOT ET RENDU ACCUEIL
  // ============================================================
  var A = win.__DIH_APP;
  ok("app: __DIH_APP exposé", typeof A === "object" && A !== null);
  ok("app: onglet initial accueil", A.APP.tab === "accueil");
  ok("app: accueil rendu (objectifs)", APP_EL.innerHTML.indexOf("Objectifs de la formation") !== -1);
  ok("app: 12 boutons data-tab (6 tabbar + 1 inline + 5 accès rapides)", cnt(APP_EL.innerHTML, /data-tab="/g) === 12);
  ok("app: onglet actif accueil", APP_EL.innerHTML.indexOf('class="tab active" data-tab="accueil"') !== -1);
  ok("app: hero FORATION DIH", APP_EL.innerHTML.indexOf("🎓 " + D.accueil.titre) !== -1);
  ok("app: motopompes intégrées (bouton onglet)", APP_EL.innerHTML.indexOf('data-tab="motopompes"') !== -1 && APP_EL.innerHTML.indexOf("Motopompes intégrées") !== -1);
  ok("app: avertissement pédagogique", APP_EL.innerHTML.indexOf("pédagogique") !== -1);
  ok("app: sw enregistré (sw.js)", swReg.length === 1 && swReg[0] === "sw.js");
  ok("app: bind events OK", listeners.clicks.length >= 5);
  ok("v3: tabbar rendue", APP_EL.innerHTML.indexOf('class="tabbar"') !== -1);
  ok("v3: ancienne barre tabs supprimée", APP_EL.innerHTML.indexOf('class="tabs"') === -1);
  ok("v3: donut progression accueil", APP_EL.innerHTML.indexOf("stroke-dasharray") !== -1);
  ok("v3: 5 accès rapides accueil", cnt(APP_EL.innerHTML, /class="quick"/g) === 5);
  ok("v3: stats checklists accueil", APP_EL.innerHTML.indexOf("Checklists") !== -1);

  // ============================================================
  // 5. NAVIGATION ONGLETS
  // ============================================================
  A.setTab("equipier");
  ok("tab equipier: rendu", APP_EL.innerHTML.indexOf("ÉQUIPIER DIH") !== -1);
  ok("tab equipier: source août 2020", APP_EL.innerHTML.indexOf("août 2020") !== -1);
  ok("tab equipier: SVG stick", APP_EL.innerHTML.indexOf("13 HOMMES = 2 (VRCG)") !== -1);
  ok("tab equipier: 8 cartes (7 sections + quiz)", cnt(APP_EL.innerHTML, /class="card"/g) === 8);
  ok("tab equipier: quiz 0/10", APP_EL.innerHTML.indexOf("0/10") !== -1);
  ok("tab equipier: signes A-15", APP_EL.innerHTML.indexOf("A-15") !== -1);
  ok("tab equipier: appareils chips", APP_EL.innerHTML.indexOf("CAIMAN-NH90") !== -1);

  // -- accordéons v3 (état vierge) --
  ok("v3: équipier 8 accordéons", cnt(APP_EL.innerHTML, /data-acc="equipier\|/g) === 8);
  ok("v3: 1 accordéon ouvert par défaut", cnt(APP_EL.innerHTML, /class="accbody open"/g) === 1);
  ok("v3: chevron présent", APP_EL.innerHTML.indexOf("chev") !== -1);
  ok("v3: boutons tout ouvrir / replier", cnt(APP_EL.innerHTML, /data-allop="equipier\|/g) === 2);
  A.toggleAcc("equipier", 1);
  ok("v3: toggle accordéon → 2 ouverts", cnt(APP_EL.innerHTML, /class="accbody open"/g) === 2);
  A.setAllAcc("equipier", true, 8);
  ok("v3: tout ouvrir → 8 ouverts", cnt(APP_EL.innerHTML, /class="accbody open"/g) === 8);
  A.setAllAcc("equipier", false, 8);
  ok("v3: tout replier → 0 ouvert", cnt(APP_EL.innerHTML, /class="accbody open"/g) === 0);
  A.toggleAcc("equipier", 0);
  ok("v3: réouverture section 1", cnt(APP_EL.innerHTML, /class="accbody open"/g) === 1);
  ok("v3: état accordéons persisté (dih-ui-v1)", lsStore["dih-ui-v1"] !== undefined && lsStore["dih-ui-v1"].indexOf("equipier") !== -1);

  A.setTab("chef");
  ok("tab chef: rendu", APP_EL.innerHTML.indexOf("CHEF D") !== -1);
  ok("tab chef: source août 2019", APP_EL.innerHTML.indexOf("août 2019") !== -1);
  ok("tab chef: SVG STANAG", APP_EL.innerHTML.indexOf("STANAG-3117") !== -1);
  ok("tab chef: pompe U 5000 GIMAEX", APP_EL.innerHTML.indexOf("U 5000 GIMAEX") !== -1);
  ok("tab chef: KESTREL", APP_EL.innerHTML.indexOf("KESTREL") !== -1);
  ok("tab chef: 8 cartes (7 sections + quiz)", cnt(APP_EL.innerHTML, /class="card"/g) === 8);
  ok("tab chef: quiz 0/10", APP_EL.innerHTML.indexOf("0/10") !== -1);

  A.setTab("reflexe");
  ok("tab reflexe: rendu", APP_EL.innerHTML.indexOf("FICHE RÉFLEXE") !== -1);
  ok("tab reflexe: phase 1", APP_EL.innerHTML.indexOf("Réception de l") !== -1);
  ok("tab reflexe: PATRACDR", APP_EL.innerHTML.indexOf("PATRACDR") !== -1);
  ok("tab reflexe: téléphone adjudant", APP_EL.innerHTML.indexOf("06 32 87 16 70") !== -1);
  ok("tab reflexe: clé N°23 retirée", APP_EL.innerHTML.indexOf("N°23") === -1 && APP_EL.innerHTML.indexOf("sac du chef de stick") === -1);
  ok("tab reflexe: 3 phases", cnt(APP_EL.innerHTML, /Phase \d/g) >= 3);
  ok("tab reflexe: observations", APP_EL.innerHTML.indexOf("Observations") !== -1);
  ok("tab reflexe: quiz 0/5", APP_EL.innerHTML.indexOf("0/5") !== -1);
  ok("tab reflexe: 7 pax en attente", APP_EL.innerHTML.indexOf("7 pax") !== -1);
  ok("v5: vue d'ensemble réflexe 0/10", APP_EL.innerHTML.indexOf("0/10") !== -1);
  ok("v5: accordéons réflexe (3 tuiles + 5 cartes)", cnt(APP_EL.innerHTML, /data-acc="reflexe\|/g) === 8);

  A.setTab("grue");
  ok("tab grue: rendu", APP_EL.innerHTML.indexOf("GRUE") !== -1);
  ok("tab grue: mise sous tension", APP_EL.innerHTML.indexOf("Mise sous tension") !== -1);
  ok("tab grue: BIP LONG", APP_EL.innerHTML.indexOf("BIP LONG") !== -1);
  ok("tab grue: boîtier MOL", APP_EL.innerHTML.indexOf("MOL") !== -1);
  ok("tab grue: 5 phases", cnt(APP_EL.innerHTML, /— /g) >= 5);
  ok("tab grue: quiz 0/5", APP_EL.innerHTML.indexOf("0/5") !== -1);

  // ============================================================
  // 6. CHECKLISTS INTERACTIVES
  // ============================================================
  A.setTab("reflexe");
  ok("checks: initial 0/5", APP_EL.innerHTML.indexOf("0/5") !== -1);
  A.toggleCheck("reflexe", 0, 0);
  ok("checks: progression 1/5", APP_EL.innerHTML.indexOf("1/5") !== -1);
  ok("checks: classe done", APP_EL.innerHTML.indexOf('class="step done"') !== -1);
  ok("checks: persisté localStorage", lsStore["dih-checks-v1"] !== undefined && lsStore["dih-checks-v1"].indexOf("reflexe-0") !== -1);
  A.toggleCheck("reflexe", 0, 0);
  ok("checks: untoggle retour 0/5", APP_EL.innerHTML.indexOf("0/5") !== -1);
  for (var i = 0; i < 5; i++) A.toggleCheck("reflexe", 0, i);
  ok("checks: 5/5 phase terminée", APP_EL.innerHTML.indexOf("5/5") !== -1 && APP_EL.innerHTML.indexOf("Phase terminée") !== -1);
  A.resetChecks("reflexe", 0);
  ok("checks: reset 0/5", APP_EL.innerHTML.indexOf("0/5") !== -1 && APP_EL.innerHTML.indexOf("Phase terminée") === -1);
  A.setTab("grue");
  A.toggleCheck("grue", 1, 0); A.toggleCheck("grue", 1, 1); A.toggleCheck("grue", 1, 2);
  ok("checks: grue 3/13", APP_EL.innerHTML.indexOf("3/13") !== -1);

  // ============================================================
  // 7. QUIZ
  // ============================================================
  A.pick("equipier", 0, 2);
  ok("quiz: score interne 1/10 équipier", A.quizScore("equipier", D.modules[0].quiz) === 1);
  A.setTab("equipier");
  ok("quiz: score affiché 1/10", APP_EL.innerHTML.indexOf("1/10") !== -1);
  ok("quiz: classe correct", APP_EL.innerHTML.indexOf('class="opt correct"') !== -1);
  ok("quiz: explication affichée", APP_EL.innerHTML.indexOf("13 hommes : 2 (VRCG)") !== -1);
  A.pick("equipier", 1, 0);
  ok("quiz: classe wrong après mauvaise réponse", APP_EL.innerHTML.indexOf('class="opt wrong"') !== -1);
  ok("quiz: score reste 1/10", APP_EL.innerHTML.indexOf("1/10") !== -1);
  ok("quiz: persisté localStorage", lsStore["dih-quiz-v1"] !== undefined && JSON.parse(lsStore["dih-quiz-v1"]).equipier["0"] === 2);
  A.pick("reflexe", 3, 0);
  ok("quiz: reflexe 1/5", A.quizScore("reflexe", D.reflexe.quiz) === 1);

  // ============================================================
  // 8. BADGE VERSION (fetch version.json → microtasks)
  // ============================================================
  await null; await null; await null; await null;
  ok("badge: fetch version.json", fetchCalls.length >= 1 && fetchCalls[0] === "version.json");
  ok("badge: texte 💾 Hors ligne · v9", BADGE_EL.textContent === "💾 Hors ligne · v9");
  ok("badge: APP.version v9", A.APP.version === "v9");

  // ============================================================
  // 9. PERSISTANCE (ré-éval = rechargement)
  // ============================================================
  eval(scripts[1]);
  var A2 = win.__DIH_APP;
  A2.setTab("reflexe");
  ok("persistance: quiz restauré 1/5", APP_EL.innerHTML.indexOf("1/5") !== -1);
  A2.setTab("grue");
  ok("persistance: checks grue restaurés 3/13", APP_EL.innerHTML.indexOf("3/13") !== -1);
  A2.setTab("equipier");
  ok("persistance: quiz équipier restauré 1/10", APP_EL.innerHTML.indexOf("1/10") !== -1);
  ok("v3: ui.last mémorisé (dih-ui-v1)", lsStore["dih-ui-v1"] !== undefined && lsStore["dih-ui-v1"].indexOf("equipier") !== -1);

  // ============================================================
  // 10. PWA — sw, manifest, version, workflow, icône
  // ============================================================
  var sw = slurp("sw.js");
  ok("sw: cache formation-dih-v9", sw.indexOf('"formation-dih-v9"') !== -1);
  ok("sw: shell index.html", sw.indexOf('"./index.html"') !== -1);
  ok("sw: shell manifest + icon svg", sw.indexOf('"./manifest.webmanifest"') !== -1 && sw.indexOf('"./icon.svg"') !== -1);
  ok("sw: shell icônes PNG", sw.indexOf("icon-192.png") !== -1 && sw.indexOf("icon-512.png") !== -1);
  ok("sw: version.json jamais en cache", sw.indexOf("version.json") !== -1 && sw.indexOf("TOUJOURS réseau") !== -1);
  ok("sw: 3 listeners (install/activate/fetch)", (sw.match(/addEventListener/g) || []).length === 3);
  ok("sw: network-first navigation + fallback cache", sw.indexOf('e.request.mode === "navigate"') !== -1 && sw.indexOf("caches.match") !== -1);

  var manifest = JSON.parse(slurp("manifest.webmanifest"));
  ok("manifest: name Formation DIH", manifest.name.indexOf("Formation DIH") !== -1);
  ok("manifest: short_name", manifest.short_name === "Formation DIH");
  ok("manifest: standalone", manifest.display === "standalone");
  ok("manifest: start_url ./", manifest.start_url === "./");
  ok("manifest: scope ./", manifest.scope === "./");
  ok("manifest: fond sombre", manifest.background_color === "#0f172a" && manifest.theme_color === "#0f172a");
  ok("manifest: 3 icônes", manifest.icons.length === 3);
  ok("manifest: 192 png", manifest.icons.some(function (ic) { return ic.sizes === "192x192" && ic.type === "image/png"; }));
  ok("manifest: 512 maskable", manifest.icons.some(function (ic) { return ic.sizes === "512x512" && ic.purpose === "maskable"; }));

  var version = JSON.parse(slurp("version.json"));
  ok("version: app formation-dih", version.app === "formation-dih");
  ok("version: v9", version.version === "v9");
  ok("v8: footer sources retiré", index.indexOf("Contenu extrait") === -1 && index.indexOf("<footer>") === -1);
  ok("version: date", version.date === "2026-10-06");

  var yml = slurp(".github/workflows/pages.yml");
  ok("yml: push main", yml.indexOf("branches: [main]") !== -1);
  ok("yml: permissions pages+id-token", yml.indexOf("pages: write") !== -1 && yml.indexOf("id-token: write") !== -1);
  ok("yml: node 20", yml.indexOf("node-version: 20") !== -1);
  ok("yml: génération icônes", yml.indexOf("node tools/gen-icons.js") !== -1);
  ok("yml: deploy-pages@v4", yml.indexOf("actions/deploy-pages@v4") !== -1);
  ok("yml: upload artifact racine", yml.indexOf('path: "."') !== -1);

  var icon = slurp("icon.svg");
  ok("icon: svg 512", icon.indexOf('viewBox="0 0 512 512"') !== -1);
  ok("icon: fond arrondi", icon.indexOf('rx="104"') !== -1);
  ok("icon: hélico (pale sky)", icon.indexOf("#38bdf8") !== -1);
  ok("icon: élingue amber", icon.indexOf("#fbbf24") !== -1);
  ok("icon: charge rouge", icon.indexOf("#f87171") !== -1);

  // ============================================================
  // 11. GÉNÉRATEUR D'ICÔNES (évaluation — PNG pur, fs/zlib optionnels)
  // ============================================================
  var gen = slurp("tools/gen-icons.js");
  var genErr = null;
  try { eval(gen); } catch (e) { genErr = e; }
  ok("gen: évalué sans erreur", genErr === null);
  if (!genErr) {
    ok("gen: crc32 vecteur connu", crc32([49, 50, 51, 52, 53, 54, 55, 56, 57]) === 3421780262);
    ok("gen: pixel charge rouge", eq(drawPix(256, 400), [248, 113, 113]));
    ok("gen: pixel fuselage blanc", eq(drawPix(256, 220), [248, 250, 252]));
    ok("gen: pixel pale bleue", eq(drawPix(100, 128), [56, 189, 248]));
    ok("gen: pixel hublot sombre", eq(drawPix(296, 216), [15, 23, 42]));
    ok("gen: pixel anneau élingue", eq(drawPix(256, 372), [251, 191, 36]));
    ok("gen: pixel fond BG (bord latéral)", eq(drawPix(5, 256), [15, 23, 42]));
    ok("gen: coin arrondi transparent", eq(drawPix(5, 5), [0, 0, 0, 0]));
    ok("gen: pixel hors icône transparent", eq(drawPix(600, 600), [0, 0, 0, 0]));
  }
  ok("gen: écrit icon-512.png et icon-192.png", gen.indexOf('writePNG("icon-512.png", 512') !== -1 && gen.indexOf('writePNG("icon-192.png", 192') !== -1);

  // ============================================================
  // 12. MOTOPOMPES
  // ============================================================
  ok("mp: D.motopompes 4 pompes", Array.isArray(D.motopompes) && D.motopompes.length === 4);
  ok("mp: ids mark3/tohatsu/efp500/fyrpak", D.motopompes[0].id === "mark3" && D.motopompes[1].id === "tohatsu" && D.motopompes[2].id === "efp500" && D.motopompes[3].id === "fyrpak");
  ok("mp: mark3 démarrage 8 étapes", D.motopompes[0].start.length === 8);
  ok("mp: tohatsu démarrage 5 étapes", D.motopompes[1].start.length === 5);
  ok("mp: efp500 démarrage 14 étapes", D.motopompes[2].start.length === 14);
  ok("mp: fyrpak démarrage 10 étapes", D.motopompes[3].start.length === 10);
  ok("mp: mark3 arrêt 1 étape", D.motopompes[0].stop.length === 1);
  ok("mp: mark3 7 voyants", D.motopompes[0].del.length === 7);
  ok("mp: tohatsu 7 commandes", D.motopompes[1].controls.length === 7);
  ok("mp: tohatsu 3 points clés", D.motopompes[1].extra.length === 3);
  ok("mp: efp500 2 points clés", D.motopompes[2].extra.length === 2);
  ok("mp: fyrpak 3 entretien", D.motopompes[3].entretien.length === 3);
  ok("mp: specs 14/19/9/8", D.motopompes[0].specs.length === 14 && D.motopompes[1].specs.length === 19 && D.motopompes[2].specs.length === 9 && D.motopompes[3].specs.length === 8);
  D.motopompes.forEach(function (p) {
    ok("mp: " + p.id + " fuelNote", typeof p.fuelNote === "string" && p.fuelNote.length > 5);
    ok("mp: " + p.id + " source", typeof p.source === "string" && p.source.length > 5);
    ok("mp: " + p.id + " svg défini", typeof SVGS[p.svg] === "function");
  });
  ["mpMark3", "mpTohatsu", "mpEfp500", "mpFyrpak"].forEach(function (k) {
    var s = "", err = null;
    try { s = SVGS[k](); } catch (e) { err = e; }
    ok("mp svg: " + k + " valide", err === null && s.indexOf("<svg") === 0 && s.indexOf("</svg>") !== -1 && s.indexOf("viewBox") !== -1);
  });
  ok("mp svg: mark3 jerrican 20 L", SVGS.mpMark3().indexOf("JERRICAN 20 L") !== -1);
  ok("mp svg: tohatsu SUPER", SVGS.mpTohatsu().indexOf("SUPER") !== -1);
  ok("mp svg: fyrpak poire ×2", SVGS.mpFyrpak().indexOf("POIRE ×2") !== -1);
  ok("mp: mark3 Aspen 2 / 50:1", JD.indexOf("Aspen 2") !== -1 && JD.indexOf("50:1") !== -1);
  ok("mp: mark3 26,2 bars / 379 l/min / 267 m", JD.indexOf("26,2 bars") !== -1 && JD.indexOf("379 l/min") !== -1 && JD.indexOf("267 m") !== -1);
  ok("mp: tohatsu 2 000 l/min / 16 bars", JD.indexOf("2 000 l/min") !== -1 && JD.indexOf("16 bars") !== -1);
  ok("mp: tohatsu Super / réservoir 24 L", JD.indexOf("Essence Super") !== -1 && JD.indexOf("24 L") !== -1);
  ok("mp: efp500 480 l/min / 95 m / 4 % / 5 L / 21,2 kg", JD.indexOf("480 l/min") !== -1 && JD.indexOf("95 m") !== -1 && JD.indexOf("4 %") !== -1 && JD.indexOf("5 L") !== -1 && JD.indexOf("21,2 kg") !== -1);
  ok("mp: fyrpak 250 l/min à 4 bars / diam. 45 / 4 700 € / SP95", JD.indexOf("250 l/min à 4 bars") !== -1 && JD.indexOf("diam. 45") !== -1 && JD.indexOf("4 700 €") !== -1 && JD.indexOf("SP95") !== -1);
  ok("mp: comparatif 4 débits", D.compareMP.debits.length === 4 && D.compareMP.debits[1][1] === 2000);
  ok("mp: comparatif 4 règles carburant", D.compareMP.regles.length === 4);
  ok("mp: setPump exposé", typeof A2.setPump === "function");
  A2.setTab("motopompes");
  ok("mp: onglet rendu — MARK 3 par défaut", APP_EL.innerHTML.indexOf("MARK 3 WATSON") !== -1);
  ok("mp: 5 sous-onglets (4 pompes + comparatif)", cnt(APP_EL.innerHTML, /data-pump="/g) === 5);
  ok("mp: sous-onglet actif mark3", APP_EL.innerHTML.indexOf('class="subtab active" data-pump="mark3"') !== -1);
  ok("mp: 6 cartes (carburant + specs + démarrage + arrêt + voyants + carburateur)", cnt(APP_EL.innerHTML, /class="card"/g) === 6);
  ok("mp: carte carburant", APP_EL.innerHTML.indexOf("Carburant") !== -1);
  ok("v9: accordéon Réglage carburateur rendu (mark3)", APP_EL.innerHTML.indexOf("Réglage carburateur (altitude)") !== -1);
  ok("v9: carb données — 3 altitudes (1¼ / 1 / ¾ tour)", D.motopompes[0].carb.altitudes.length === 3 && D.motopompes[0].carb.altitudes[0][1].indexOf("1¼ tour") !== -1 && D.motopompes[0].carb.altitudes[2][1].indexOf("¾ de tour") !== -1);
  ok("v9: carb vis H/L + objectif ½ tour riche", D.motopompes[0].carb.vis[0][0] === "Vis H" && D.motopompes[0].carb.vis[1][0] === "Vis L" && D.motopompes[0].carb.objectif.indexOf("½ tour") !== -1);
  ok("v9: carb cas1 4 étapes / cas23 4 étapes", D.motopompes[0].carb.cas1.length === 4 && D.motopompes[0].carb.cas23.length === 4);
  ok("v9: carb jamais sans charge (HTML)", APP_EL.innerHTML.indexOf("JAMAIS à plein régime sans charge") !== -1);
  ok("v9: carb MyWATERAX Watson Edition", APP_EL.innerHTML.indexOf("MyWATERAX Pump Dashboard") !== -1);
  ok("v9: carb source WATERAX Rev. A", APP_EL.innerHTML.indexOf("WATERAX") !== -1 && D.motopompes[0].carb.source.indexOf("Rev. A") !== -1);
  ok("v9: carb uniquement mark3 (pas sur les 3 autres)", D.motopompes[1].carb === undefined && D.motopompes[2].carb === undefined && D.motopompes[3].carb === undefined);
  ok("mp: carte caractéristiques", APP_EL.innerHTML.indexOf("Caractéristiques") !== -1);
  ok("mp: démarrage 0/8", APP_EL.innerHTML.indexOf("0/8") !== -1);
  ok("mp: arrêt 0/1", APP_EL.innerHTML.indexOf("0/1") !== -1);
  ok("mp: SVG intégré (8 étapes)", APP_EL.innerHTML.indexOf("DÉMARRAGE EN 8 ÉTAPES") !== -1);
  ok("mp: voyant rouge clignotant", APP_EL.innerHTML.indexOf("Rouge clignotant") !== -1);
  A2.toggleCheck("mp-mark3", 0, 0);
  ok("mp: checklist 1/8", APP_EL.innerHTML.indexOf("1/8") !== -1);
  ok("mp: checklist persistée localStorage", lsStore["dih-checks-v1"].indexOf("mp-mark3-0") !== -1);
  A2.setPump("tohatsu");
  ok("mp: tohatsu rendu 0/5", APP_EL.innerHTML.indexOf("TOHATSU VE 1500") !== -1 && APP_EL.innerHTML.indexOf("0/5") !== -1);
  ok("mp: tohatsu commandes affichées", APP_EL.innerHTML.indexOf("Interrupteur général") !== -1);
  A2.setPump("efp500");
  ok("mp: efp500 rendu 0/14", APP_EL.innerHTML.indexOf("EFP-500-FL") !== -1 && APP_EL.innerHTML.indexOf("0/14") !== -1);
  ok("mp: efp500 points clés", APP_EL.innerHTML.indexOf("Lanceur manuel") !== -1);
  A2.setPump("fyrpak");
  ok("mp: fyrpak rendu 0/10", APP_EL.innerHTML.indexOf("FYR PAK") !== -1 && APP_EL.innerHTML.indexOf("0/10") !== -1);
  ok("mp: fyrpak entretien affiché", APP_EL.innerHTML.indexOf("Souffler le filtre à air") !== -1);
  A2.setPump("compare");
  ok("mp: comparatif rendu", APP_EL.innerHTML.indexOf("Débits max.") !== -1);
  ok("mp: barre 2 000 l/min", APP_EL.innerHTML.indexOf("2 000 l/min") !== -1);
  ok("mp: repères pression 26,2 bars", APP_EL.innerHTML.indexOf("26,2 bars") !== -1);
  ok("mp: règles carburant affichées", APP_EL.innerHTML.indexOf("essence Super (pas de mélange)") !== -1);
  ok("mp: onglet 🚒 Motopompes dans l'index", index.indexOf("🚒 Motopompes") !== -1);

  // ============================================================
  // 13. V3 — DONUT, RECOMMENCER, VUE D'ENSEMBLE
  // ============================================================
  A2.setTab("accueil");
  ok("v3: donut restauré accueil", APP_EL.innerHTML.indexOf("stroke-dasharray") !== -1);
  ok("v3: score quiz équipier affiché sur accueil", APP_EL.innerHTML.indexOf("1/10") !== -1);
  ok("v3: stats quiz accueil", APP_EL.innerHTML.indexOf("Quiz") !== -1 && APP_EL.innerHTML.indexOf("bonnes réponses") !== -1);
  A2.setTab("reflexe");
  ok("v5: réflexe quiz 1/5 avant reset", APP_EL.innerHTML.indexOf("1/5") !== -1);
  ok("v3: bouton recommencer présent", APP_EL.innerHTML.indexOf('data-resetquiz="reflexe"') !== -1);
  A2.resetQuiz("reflexe");
  ok("v3: resetQuiz → 0/5", APP_EL.innerHTML.indexOf("0/5") !== -1 && APP_EL.innerHTML.indexOf("1/5") === -1);
  A2.setTab("grue");
  var grueTotal = 0;
  for (var g = 0; g < D.grue.phases.length; g++) grueTotal += D.grue.phases[g].steps.length;
  ok("v3: vue d'ensemble grue 3/" + grueTotal, APP_EL.innerHTML.indexOf("3/" + grueTotal) !== -1);
  ok("v3: API v3 exposée", typeof A2.toggleAcc === "function" && typeof A2.setAllAcc === "function" && typeof A2.resetQuiz === "function");
  ok("v7: API zoom exposée", typeof A2.openZoom === "function" && typeof A2.zoomAction === "function" && typeof A2.zoomState === "function" && typeof A2.closeZoom === "function");
  A2.openZoom('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>');
  ok("v7: zoom ouvert, échelle 1", A2.zoomState().open === true && A2.zoomState().scale === 1);
  A2.zoomAction("plus"); A2.zoomAction("plus");
  ok("v7: zoom échelle 1.5 (2 × plus)", A2.zoomState().scale === 1.5);
  A2.zoomAction("minus");
  ok("v7: zoom échelle 1.25 (moins)", A2.zoomState().scale === 1.25);
  A2.zoomAction("reset");
  ok("v7: zoom reset échelle 1", A2.zoomState().scale === 1);
  A2.zoomAction("close");
  ok("v7: zoom fermé", A2.zoomState().open === false);
  ok("v7: hint dessin rendu (zhint)", index.indexOf("zhint") !== -1 && index.indexOf("Touche le dessin") !== -1);

  // ============================================================
  // RAPPORT
  // ============================================================
  var RESULT = { pass: PASS, fail: FAIL, total: PASS + FAIL, failures: FAILURES };
  globalThis.__FDIH_TEST_RESULT = RESULT;
  if (typeof window !== "undefined") window.__FDIH_TEST_RESULT = RESULT;
  console.log("");
  console.log("=== FORMATION DIH — " + PASS + "/" + (PASS + FAIL) + " tests OK ===");
  if (FAIL > 0) {
    console.log("ÉCHECS (" + FAIL + ") :");
    FAILURES.forEach(function (f) { console.log("  ✗ " + f); });
  }
  if (typeof process !== "undefined" && process && typeof process.exit === "function" && FAIL > 0) process.exit(1);

})();
