/* Saved questions page: subject cards -> year-wise list -> viewer.
   Data comes from the same JSON files as the mocks (loaded on demand, cached by the browser). */
var OPT_KEYS = ["option_1","option_2","option_3","option_4","option_5"];
var OPT_LETTERS = ["A","B","C","D","E"];

/* ---- Maths (LaTeX) rendering: KaTeX if loaded, else readable plain-text fallback ---- */
var MATH_DELIMS = [
  {left:"$$", right:"$$", display:true},
  {left:"\\[", right:"\\]", display:true},
  {left:"\\(", right:"\\)", display:false}
];
function texToHtml(t){
  var s = t;
  s = s.replace(/\\\{/g, "\u0001").replace(/\\\}/g, "\u0002");
  s = s.replace(/\\left|\\right|\\displaystyle|\\!|\\,|\\;|\\:/g, "");
  s = s.replace(/\\text\{([^{}]*)\}|\\mathrm\{([^{}]*)\}|\\textbf\{([^{}]*)\}/g, function(m,a,b,c){ return a||b||c||""; });
  for(var i=0;i<4;i++){
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
    s = s.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "<sup>$1</sup>&radic;($2)");
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, "&radic;($1)");
  }
  s = s.replace(/\\sqrt\s*([0-9a-zA-Z])/g, "&radic;$1");
  s = s.replace(/\^\{([^{}]*)\}/g, "<sup>$1</sup>").replace(/\^([0-9a-zA-Z])/g, "<sup>$1</sup>");
  s = s.replace(/_\{([^{}]*)\}/g, "<sub>$1</sub>").replace(/_([0-9a-zA-Z])/g, "<sub>$1</sub>");
  var map = {times:"×", div:"÷", pm:"±", mp:"∓", cdot:"·", le:"≤", leq:"≤", ge:"≥", geq:"≥", ne:"≠", neq:"≠",
    approx:"≈", circ:"°", pi:"π", theta:"θ", alpha:"α", beta:"β", gamma:"γ", delta:"δ", Delta:"Δ", sigma:"σ",
    lambda:"λ", mu:"μ", infty:"∞", therefore:"∴", because:"∵", rightarrow:"→", Rightarrow:"⇒", to:"→",
    angle:"∠", triangle:"△", perp:"⊥", parallel:"∥", degree:"°", ldots:"…", cdots:"…", dots:"…", quad:" ", qquad:"  "};
  s = s.replace(/\\([a-zA-Z]+)/g, function(m,n){ return map.hasOwnProperty(n) ? map[n] : n; });
  s = s.replace(/\\%/g, "%").replace(/\\&/g, "&").replace(/\\\\/g, "<br>").replace(/\\ /g, " ");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\u0001/g, "{").replace(/\u0002/g, "}");
  return s;
}
function mathFallback(root){
  var h = root.innerHTML;
  if(h.indexOf("\\(") === -1 && h.indexOf("\\[") === -1 && h.indexOf("$$") === -1) return;
  h = h.replace(/\\\(([\s\S]*?)\\\)/g, function(m,t){ return "<span class=\"mathfb\">" + texToHtml(t) + "</span>"; });
  h = h.replace(/\\\[([\s\S]*?)\\\]/g, function(m,t){ return "<span class=\"mathfb\">" + texToHtml(t) + "</span>"; });
  h = h.replace(/\$\$([\s\S]*?)\$\$/g, function(m,t){ return "<span class=\"mathfb\">" + texToHtml(t) + "</span>"; });
  root.innerHTML = h;
}
function renderMath(root){
  if(!root) return;
  if(typeof renderMathInElement === "function"){
    try{ renderMathInElement(root, {delimiters: MATH_DELIMS, throwOnError:false, strict:false}); }catch(e){ mathFallback(root); }
  } else {
    mathFallback(root);
  }
}


(function () {
  var C = window.HUB_CONFIG, H = window.HubCommon;
  var P = new URLSearchParams(location.search);
  function defaultYear() {
    var want = P.get("y");
    if (C.years.indexOf(want) !== -1) return want;
    var all = H.readSaved();
    for (var k = C.years.length - 1; k >= 0; k--) {
      if (all.some(function (e) { return e.y === C.years[k]; })) return C.years[k];
    }
    return C.years[0];
  }
  var S = { year: defaultYear(), subject: null };
  var V = { list: [], pos: 0, q: null, lang: "en", picked: null, mine: false, sol: false, seq: 0 };
  var qcache = {};

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  var toastT;
  function toast(m) { var t = $("svToast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2200); }

  function cleanPreview(t) {
    return String(t || "").replace(/\\[()\[\]]/g, "").replace(/\$\$?/g, "").replace(/\\([a-zA-Z]+)/g, "$1").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  }
  function entries() { return H.readSaved(); }
  function subjectLabel(key) { var s = C.subjects.filter(function (x) { return x.key === key; })[0]; return s ? (s.label || s.key) : key; }
  function forYear(y) { return entries().filter(function (e) { return e.y === y; }); }

  /* ---------- year + subject cards ---------- */
  function renderYears() {
    var seg = $("yearSeg"); clear(seg);
    C.years.forEach(function (y) {
      var n = forYear(y).length;
      var b = el("button", "", y + (n ? "  \u00B7 " + n : ""));
      b.type = "button"; b.setAttribute("aria-pressed", y === S.year ? "true" : "false");
      b.addEventListener("click", function () { S.year = y; S.subject = null; render(); });
      seg.appendChild(b);
    });
  }
  function renderSubjects() {
    var host = $("subjectCards"); clear(host);
    var list = forYear(S.year);
    C.subjects.forEach(function (sub) {
      var mine = list.filter(function (e) { return e.s === sub.key; });
      var card = el("button", "sv-card" + (mine.length ? "" : " empty"));
      card.type = "button";
      card.appendChild(el("div", "k", S.year));
      card.appendChild(el("div", "n", String(mine.length)));
      card.appendChild(el("div", "l", sub.label || sub.key));
      card.appendChild(el("div", "s", mine.length ? "saved question" + (mine.length === 1 ? "" : "s") + " \u00B7 tap to open" : "nothing saved yet"));
      if (mine.length) card.addEventListener("click", function () { S.subject = sub.key; render(); window.scrollTo(0, 0); });
      host.appendChild(card);
    });
    if (!list.length) {
      var hint = el("p", "hero-sub", "Nothing saved for " + S.year + " yet. During a mock, tap the Save button on any question and it will show up here.");
      hint.style.gridColumn = "1 / -1";
      host.appendChild(hint);
    }
  }

  /* ---------- list ---------- */
  function currentList() {
    return forYear(S.year).filter(function (e) { return e.s === S.subject; })
      .sort(function (a, b) { return b.at - a.at; });
  }
  function renderList() {
    var list = currentList();
    if (!list.length) { S.subject = null; render(); return; }
    $("listTitle").textContent = subjectLabel(S.subject) + " \u00B7 " + S.year + " (" + list.length + ")";
    var host = $("qList"); clear(host);
    list.forEach(function (e, idx) {
      var row = el("div", "sv-row");
      row.appendChild(el("div", "sv-no", "#" + (idx + 1)));
      var main = el("div", "sv-main");
      main.appendChild(el("div", "sv-prev", cleanPreview(e.preview) || "(open to view question)"));
      var sub = el("div", "sv-sub");
      sub.appendChild(el("span", "", (e.chapter || "") + (e.title ? " \u00B7 " + e.title : "") + " \u00B7 Q" + (e.i + 1)));
      if (e.topic) sub.appendChild(el("span", "", e.topic));
      var lab = e.res === "correct" ? "Mock: correct" : e.res === "wrong" ? "Mock: wrong" : "Mock: skipped";
      sub.appendChild(el("span", "chip " + (e.res || "skipped"), lab));
      main.appendChild(sub);
      row.appendChild(main);
      var x = el("button", "sv-x", "\u2715"); x.type = "button"; x.title = "Remove from Saved";
      x.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (confirm("Remove this question from Saved?")) { H.removeSaved(e.id); render(); toast("Removed"); }
      });
      row.appendChild(x);
      row.addEventListener("click", function () { openViewer(list, idx); });
      host.appendChild(row);
    });
  }

  function render() {
    renderYears();
    var inList = !!S.subject;
    $("subjectsView").hidden = inList;
    $("listView").hidden = !inList;
    if (inList) renderList(); else renderSubjects();
  }

  /* ---------- viewer ---------- */
  function pick(en, hi, lang) {
    en = en || ""; hi = hi || "";
    if (lang === "hi" && hi) return '<div class="hi">' + hi + "</div>";
    if (lang === "bi" && hi && en) {
      if (hi.replace(/\s+/g, "") === en.replace(/\s+/g, "")) return en;
      return en + '<hr class="bi-sep"><div class="hi">' + hi + "</div>";
    }
    return en || hi;
  }
  function loadQuestion(e) {
    var key = e.y + "|" + e.s + "|" + e.set;
    if (qcache[key]) return Promise.resolve(qcache[key][e.i]);
    return H.fetchSubject(e.y, e.s).then(function (json) {
      var found = H.findSet(json, e.set);
      if (!found) throw new Error("This mock set is no longer in the data file.");
      qcache[key] = H.buildTest(json, found, e.y, e.s).questions;
      return qcache[key][e.i];
    });
  }
  function openViewer(list, pos) {
    V.list = list; V.pos = pos;
    $("viewer").hidden = false;
    document.body.style.overflow = "hidden";
    showQuestion();
  }
  function closeViewer() {
    $("viewer").hidden = true;
    document.body.style.overflow = "";
    V.seq++;
    render();
  }
  function showQuestion() {
    var e = V.list[V.pos], mySeq = ++V.seq;
    V.q = null; V.picked = null; V.mine = false; V.sol = false;
    $("vCount").textContent = "Question " + (V.pos + 1) + " of " + V.list.length;
    $("vPrev").disabled = V.pos === 0;
    $("vNext").disabled = V.pos === V.list.length - 1;
    $("vMeta").textContent = subjectLabel(e.s) + " \u00B7 " + e.y + " \u00B7 " + (e.chapter || "") + (e.title ? " \u00B7 " + e.title : "") + " \u00B7 Q" + (e.i + 1) + (e.topic ? " \u00B7 " + e.topic : "");
    var mk = $("vMock");
    mk.className = "v-mock " + (e.res || "skipped");
    mk.textContent = e.mark ? "In the mock you marked " + OPT_LETTERS[parseInt(e.mark, 10) - 1] + (e.res === "correct" ? " (correct)" : " (wrong)") : "In the mock you did not answer this";
    $("vBody").hidden = true;
    var ld = $("vLoad"); ld.hidden = false; ld.className = "v-load"; ld.textContent = "Loading question...";
    loadQuestion(e).then(function (q) {
      if (mySeq !== V.seq) return;
      if (!q) throw new Error("Question not found in the data file.");
      V.q = q;
      ld.hidden = true; $("vBody").hidden = false;
      var hasHi = !!(q.question && q.question.hi);
      $("vLang").hidden = !hasHi;
      if (!hasHi) V.lang = "en";
      $("vLang").value = V.lang;
      paintQuestion();
    }).catch(function (err) {
      if (mySeq !== V.seq) return;
      ld.className = "v-load err";
      ld.textContent = "Could not load this question (" + (err && err.message ? err.message : "error") + "). Make sure the data file for " + e.y + " " + subjectLabel(e.s) + " is on the site.";
    });
  }
  function paintQuestion() {
    var q = V.q, e = V.list[V.pos];
    $("vQ").innerHTML = pick(q.question.en, q.question.hi, V.lang);
    var qi = $("vQImg");
    qi.innerHTML = q.question_image ? '<img src="' + q.question_image + '" alt="question image">' : "";
    var html = "";
    OPT_KEYS.forEach(function (key, idx) {
      var o = q.options[key]; if (!o) return;
      var val = String(idx + 1), cls = "v-opt", tag = "";
      var tags = [];
      if (V.picked) {
        cls += " locked";
        if (val === q.answer) { cls += " right"; tags.push('<span class="tg">CORRECT</span>'); }
        else if (val === V.picked) { cls += " wrongpick"; tags.push('<span class="tg">YOUR PICK</span>'); }
      }
      if (V.sol && !V.picked && val === q.answer) { cls += " right"; tags.push('<span class="tg">CORRECT</span>'); }
      if (V.mine && val === e.mark) { cls += " mine"; tags.push('<span class="tg mine">MARKED IN MOCK</span>'); }
      var img = o.image ? '<div><img src="' + o.image + '" alt="option image"></div>' : "";
      html += '<div class="' + cls + '" data-v="' + val + '"><div class="lt">' + OPT_LETTERS[idx] + '</div><div class="bd">' + pick(o.en, o.hi, V.lang) + img + "</div>" + tags.join("") + "</div>";
    });
    $("vOpts").innerHTML = html;
    Array.prototype.forEach.call($("vOpts").querySelectorAll(".v-opt"), function (n) {
      n.addEventListener("click", function () {
        if (V.picked) return;
        V.picked = n.getAttribute("data-v"); paintQuestion();
      });
    });
    var fb = $("vFb"); fb.className = "v-fb"; fb.textContent = "";
    if (V.picked) {
      var ok = V.picked === q.answer;
      fb.className = "v-fb " + (ok ? "ok" : "no");
      fb.textContent = ok ? "Correct!" : "Incorrect. The correct option is " + OPT_LETTERS[parseInt(q.answer, 10) - 1] + ".";
    }
    var ex = $("vExpl");
    var showSol = V.sol || !!V.picked;
    if (showSol && V.sol) {
      var st = q.solution_text ? pick(q.solution_text.en, q.solution_text.hi, V.lang) : "";
      ex.hidden = false;
      ex.innerHTML = "<h4>Solution</h4><p><b>Correct answer:</b> Option " + OPT_LETTERS[parseInt(q.answer, 10) - 1] + "</p>" + (st || "<i>No solution text provided.</i>");
    } else { ex.hidden = true; ex.innerHTML = ""; }
    $("tMine").classList.toggle("on", V.mine);
    $("tSol").classList.toggle("on", V.sol);
    $("tSol").textContent = V.sol ? "Hide solution" : "Show solution";
    $("tMine").style.display = e.mark ? "" : "none";
    renderMath($("vQ")); renderMath($("vOpts")); renderMath(ex);
  }

  function init() {
    render();
    $("backToSubjects").addEventListener("click", function () { S.subject = null; render(); });
    $("vClose").addEventListener("click", closeViewer);
    $("vPrev").addEventListener("click", function () { if (V.pos > 0) { V.pos--; showQuestion(); $all0(); } });
    $("vNext").addEventListener("click", function () { if (V.pos < V.list.length - 1) { V.pos++; showQuestion(); $all0(); } });
    $("vLang").addEventListener("change", function () { V.lang = this.value; if (V.q) paintQuestion(); });
    $("tMine").addEventListener("click", function () { V.mine = !V.mine; if (V.q) paintQuestion(); });
    $("tSol").addEventListener("click", function () { V.sol = !V.sol; if (V.q) paintQuestion(); });
    $("tReset").addEventListener("click", function () { V.picked = null; V.sol = false; V.mine = false; if (V.q) paintQuestion(); });
    $("tRemove").addEventListener("click", function () {
      var e = V.list[V.pos];
      H.removeSaved(e.id);
      V.list.splice(V.pos, 1);
      toast("Removed from Saved");
      if (!V.list.length) { closeViewer(); return; }
      if (V.pos >= V.list.length) V.pos = V.list.length - 1;
      showQuestion();
    });
    document.addEventListener("keydown", function (ev) {
      if ($("viewer").hidden) return;
      if (ev.key === "Escape") closeViewer();
      else if (ev.key === "ArrowRight") $("vNext").click();
      else if (ev.key === "ArrowLeft") $("vPrev").click();
    });
    window.addEventListener("storage", function (ev) { if (ev.key === "sscscholars_saved_v1" && $("viewer").hidden) render(); });
  }
  function $all0() { var s = document.querySelector(".v-scroll"); if (s) s.scrollTop = 0; }
  init();
})();
