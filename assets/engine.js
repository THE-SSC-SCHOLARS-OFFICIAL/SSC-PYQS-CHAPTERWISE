/* ============================================================
   THE SSC SCHOLARS OFFICIAL -- Mock Test Engine
   SSC CBT style exam flow:
   instructions (2 pages) -> test (Save & Next / Mark for Review /
   shaped palette / pause / submit) -> analysis -> solutions.
   Contract with the loader:  window.MOCK_CFG, window.MOCK_QUESTIONS
   Saved state keeps the same shape the hub reads (phase, timeLeft, result.score/maxMarks).
   ============================================================ */
var CFG = window.MOCK_CFG;
var QUESTIONS = window.MOCK_QUESTIONS;
var N = QUESTIONS.length;
var STORAGE_KEY = CFG.storageKey;
var OPT_LETTERS = ["A","B","C","D","E"];
var OPT_KEYS = ["option_1","option_2","option_3","option_4","option_5"];
var hasHindi = QUESTIONS.some(function(q){ return q.question && q.question.hi; });

var state = null;
var timerHandle = null;
var draft = null;            /* option picked on the current question but not saved yet */

function $(id){ return document.getElementById(id); }
function $all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }

function freshState(){
  var qs = [];
  for(var i=0;i<N;i++){ qs.push({status:"notvisited", selected:null, solutionSeen:false, t:0}); }
  return {
    phase: "welcome", current: 0, q: qs, instantFeedback: false,
    timeLeft: CFG.totalTimeSeconds, startedAt: null, finishedAt: null, result: null,
    solIndex: 0, solFilter: "all", palHidden: false, solPalHidden: false, lang: "en", solLang: "en"
  };
}
function loadState(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return freshState();
    var parsed = JSON.parse(raw);
    if(!parsed || parsed.n !== N || !parsed.s || !parsed.s.q || parsed.s.q.length !== N) return freshState();
    var s = parsed.s;
    s.q.forEach(function(x){ if(typeof x.t !== "number") x.t = 0; });
    if(!s.solFilter) s.solFilter = "all";
    if(s.lang === "bilingual") s.lang = "bi";
    return s;
  }catch(e){ return freshState(); }
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({n:N, s:state})); }catch(e){}
}

function escapeHtml(s){ var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

/* ---- bilingual-aware text helpers ---- */
function pick(en, hi, lang){
  en = en || ""; hi = hi || "";
  if(lang === "hi" && hi) return '<div class="hi">' + hi + '</div>';
  if(lang === "bi" && hi && en){
    if(hi.replace(/\s+/g,"") === en.replace(/\s+/g,"")) return en;
    return en + '<hr class="bi-sep"><div class="hi">' + hi + '</div>';
  }
  return en || hi;
}
function qHtml(q, lang){ return pick(q.question.en, q.question.hi, lang); }
function optHtml(q, key, lang){ var o = q.options[key]; return o ? pick(o.en, o.hi, lang) : ""; }
function solHtml(q, lang){ return q.solution_text ? pick(q.solution_text.en, q.solution_text.hi, lang) : ""; }

function pad2(n){ n = Math.floor(n); return n < 10 ? "0"+n : ""+n; }
function fmtClock(sec){ sec = Math.max(0, Math.floor(sec)); return pad2(Math.floor(sec/60)) + ":" + pad2(sec%60); }
function fmtLong(sec){ sec = Math.max(0, Math.floor(sec)); var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60; return (h ? h+"h " : "") + m + "m " + s + "s"; }
function fmtShort(sec){ sec = Math.max(0, Math.round(sec)); return sec < 60 ? sec + "s" : Math.floor(sec/60) + "m " + (sec%60) + "s"; }
function num(v, d){ var n = parseFloat(v); return isNaN(n) ? d : n; }
function qScore(q){ return num(q.correct_score, CFG.defaultCorrectScore); }
function qNeg(q){ return num(q.negative_score, CFG.defaultNegativeScore); }
function r2(v){ return Math.round(v*100)/100; }

var toastT = null;
function toast(msg){
  var t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove("show"); }, 2600);
}

/* ================= THEME / ZOOM / FULLSCREEN ================= */
function setThemeIcon(){
  var dark = document.documentElement.getAttribute("data-theme") === "dark";
  $all(".ic-theme").forEach(function(e){ e.innerHTML = dark ? "&#9788;" : "&#9790;"; });
  var m = document.querySelector('meta[name="theme-color"]'); if(m) m.content = dark ? "#171a22" : "#ffffff";
}
function toggleDark(){
  var dark = document.documentElement.getAttribute("data-theme") === "dark";
  if(dark) document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme","dark");
  try{ localStorage.setItem("sscscholars_theme", dark ? "light" : "dark"); }catch(e){}
  setThemeIcon();
}
var ZOOM_KEY = "sscscholars_zoom_level";
var zoomLevel = 1;
try{ var zz = parseFloat(localStorage.getItem(ZOOM_KEY)); if(zz >= 0.6 && zz <= 3) zoomLevel = zz; }catch(e){}
function zoomChange(dir){ zoomLevel = Math.min(3, Math.max(0.6, Math.round((zoomLevel + dir*0.1)*100)/100)); applyZoom(); }
function zoomReset(){ zoomLevel = 1; applyZoom(); }
function applyZoom(){
  document.documentElement.style.setProperty("--z", zoomLevel);
  $all(".zoomLabel").forEach(function(l){ l.textContent = Math.round(zoomLevel*100) + "%"; });
  try{ localStorage.setItem(ZOOM_KEY, String(zoomLevel)); }catch(e){}
  applyImgZoom();
}
function toggleFullscreen(){
  try{
    if(!document.fullscreenElement){ document.documentElement.requestFullscreen().catch(function(){}); }
    else { document.exitFullscreen().catch(function(){}); }
  }catch(e){}
}
document.addEventListener("fullscreenchange", function(){
  var on = !!document.fullscreenElement;
  var a = $("fsEnter"), b = $("fsExit");
  if(a) a.style.display = on ? "none" : "block";
  if(b) b.style.display = on ? "block" : "none";
});

/* ---- images inside question / option / solution HTML follow the same zoom ---- */
function sizeImg(img){
  if(!img.naturalWidth) return;
  var host = img.closest(".qbody") || img.closest(".explbox") || document.body;
  var cap = Math.max(160, host.clientWidth - 90);
  var base = Math.min(img.naturalWidth, cap);
  img.style.width = Math.round(base * zoomLevel) + "px";
  img.style.height = "auto";
}
function applyImgZoom(){
  var imgs = document.querySelectorAll(".zwrap img");
  for(var i=0;i<imgs.length;i++){ sizeImg(imgs[i]); }
}
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

function decorateImages(root){
  if(!root) return;
  renderMath(root);
  var imgs = root.querySelectorAll("img");
  for(var i=0;i<imgs.length;i++){
    var img = imgs[i];
    if(img.parentNode && img.parentNode.classList && img.parentNode.classList.contains("zwrap")) continue;
    img.removeAttribute("style");
    img.removeAttribute("width");
    img.removeAttribute("height");
    var wrap = document.createElement("span");
    wrap.className = "zwrap";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
    var b = document.createElement("button");
    b.type = "button"; b.className = "zbtn"; b.title = "Open full-size / zoom"; b.innerHTML = "&#128269;";
    wrap.appendChild(b);
    if(img.complete && img.naturalWidth){ sizeImg(img); }
    else { img.addEventListener("load", function(e){ sizeImg(e.target); }); }
  }
}
window.addEventListener("resize", function(){ applyImgZoom(); });

/* ---- Lightbox: wheel zoom, drag to pan, fit / 1:1 ---- */
var lb = {scale:1, x:0, y:0, drag:false, sx:0, sy:0, fitScale:1};
function lbEl(){ return {box:$("imgLightbox"), stage:$("lbStage"), img:$("lbImg")}; }
function lbApply(){
  var e = lbEl();
  e.img.style.transform = "translate(" + lb.x + "px," + lb.y + "px) scale(" + lb.scale + ")";
  $("lbPct").textContent = Math.round(lb.scale*100) + "%";
}
function lbOpen(src){
  var e = lbEl();
  e.box.classList.add("show");
  e.img.onload = function(){ lbFit(); };
  e.img.src = src;
  if(e.img.complete && e.img.naturalWidth){ lbFit(); }
}
function lbFit(){
  var e = lbEl();
  var sw = e.stage.clientWidth, sh = e.stage.clientHeight;
  var iw = e.img.naturalWidth || 1, ih = e.img.naturalHeight || 1;
  var sc = Math.min(sw/iw, sh/ih);
  lb.fitScale = sc;
  /* small images: blow them up so they are actually readable */
  if(sc > 1) sc = Math.min(sc, 4);
  lb.scale = sc;
  lb.x = (sw - iw*sc)/2; lb.y = (sh - ih*sc)/2;
  lbApply();
}
function lbActual(){
  var e = lbEl();
  var sw = e.stage.clientWidth, sh = e.stage.clientHeight;
  lb.scale = 1;
  lb.x = (sw - e.img.naturalWidth)/2; lb.y = (sh - e.img.naturalHeight)/2;
  lbApply();
}
function lbZoomAt(factor, cx, cy){
  var ns = Math.min(12, Math.max(0.1, lb.scale * factor));
  var k = ns / lb.scale;
  lb.x = cx - (cx - lb.x) * k;
  lb.y = cy - (cy - lb.y) * k;
  lb.scale = ns;
  lbApply();
}
function lbZoom(dir){
  var e = lbEl();
  lbZoomAt(dir > 0 ? 1.25 : 0.8, e.stage.clientWidth/2, e.stage.clientHeight/2);
}
function lbClose(){ $("imgLightbox").classList.remove("show"); }
function lbIsOpen(){ return $("imgLightbox").classList.contains("show"); }

(function initLightbox(){
  var stage = $("lbStage");
  stage.addEventListener("wheel", function(ev){
    ev.preventDefault();
    var r = stage.getBoundingClientRect();
    lbZoomAt(ev.deltaY < 0 ? 1.15 : 1/1.15, ev.clientX - r.left, ev.clientY - r.top);
  }, {passive:false});
  stage.addEventListener("pointerdown", function(ev){
    lb.drag = true; lb.sx = ev.clientX - lb.x; lb.sy = ev.clientY - lb.y;
    stage.classList.add("drag");
    try{ stage.setPointerCapture(ev.pointerId); }catch(e){}
  });
  stage.addEventListener("pointermove", function(ev){
    if(!lb.drag) return;
    lb.x = ev.clientX - lb.sx; lb.y = ev.clientY - lb.sy; lbApply();
  });
  function endDrag(){ lb.drag = false; stage.classList.remove("drag"); }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("dblclick", function(){
    if(Math.abs(lb.scale - lb.fitScale) < 0.02 || lb.fitScale > 1){ var e = lbEl(); lbZoomAt(2, e.stage.clientWidth/2, e.stage.clientHeight/2); }
    else { lbFit(); }
  });
  /* two-finger pinch on touch screens */
  var pts = {}, pinchD = 0;
  stage.addEventListener("pointerdown", function(ev){ pts[ev.pointerId] = ev; });
  stage.addEventListener("pointermove", function(ev){
    if(!pts[ev.pointerId]) return;
    pts[ev.pointerId] = ev;
    var ids = Object.keys(pts);
    if(ids.length === 2){
      var a = pts[ids[0]], b = pts[ids[1]];
      var d = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      if(pinchD){
        var r = stage.getBoundingClientRect();
        lbZoomAt(d/pinchD, (a.clientX+b.clientX)/2 - r.left, (a.clientY+b.clientY)/2 - r.top);
      }
      pinchD = d;
    }
  });
  function pend(ev){ delete pts[ev.pointerId]; pinchD = 0; }
  stage.addEventListener("pointerup", pend);
  stage.addEventListener("pointercancel", pend);

  /* open lightbox: magnifier button always; clicking the picture itself everywhere
     except inside answer options (there a click must still select the option) */
  document.addEventListener("click", function(ev){
    var t = ev.target;
    if(!t || !t.closest) return;
    var wrap = t.closest(".zwrap");
    if(!wrap) return;
    var img = wrap.querySelector("img");
    if(!img) return;
    var isBtn = t.classList.contains("zbtn");
    var inOption = !!t.closest(".opt-radio");
    if(isBtn || !inOption){
      ev.preventDefault(); ev.stopPropagation();
      lbOpen(img.currentSrc || img.src);
    }
  }, true);
})();


/* ================= SCREEN SWITCHING ================= */
function showScreen(id){
  ["welcomePage","testPage","resultPage","solutionPage"].forEach(function(s){
    $(s).classList.toggle("hidden-page", s !== id);
  });
  document.body.classList.remove("pal-open");
  $("toast").classList.remove("show");
  window.scrollTo(0,0);
}

/* ================= STATIC TEXT ================= */
function initStaticText(){
  var brand = (window.HUB_CONFIG && window.HUB_CONFIG.brand) || "THE SSC SCHOLARS OFFICIAL";
  document.title = CFG.examTitle + " | " + brand;
  var mins = Math.round(CFG.totalTimeSeconds/60);
  var posNeg = "-" + CFG.negativeScoreDisplay;
  $("wsHeaderTitle").textContent = CFG.examTitle;
  $("resHdrTitle").textContent = CFG.examTitle;
  $("ovTime").textContent = mins;
  $("ovQ").textContent = N;
  $("ovCor").textContent = "+" + CFG.correctScoreDisplay;
  $("ovNeg").textContent = posNeg;
  $("ovSec").textContent = CFG.sectionLabel;
  $("ovSecQ").textContent = N;
  var mx = 0; QUESTIONS.forEach(function(q){ mx += qScore(q); });
  $("ovSecM").textContent = r2(mx);
  $("ovSecN").textContent = posNeg;
  $("insCor").textContent = CFG.correctScoreDisplay;
  $("insNeg").textContent = CFG.negativeScoreDisplay;

  $("hdrTitle").textContent = CFG.examTitle;
  $("hdrSub").textContent = CFG.sectionLabel;
  $("solHdrTitle").textContent = CFG.examTitle;
  $("sectionTab").textContent = CFG.sectionLabel;
  $("secInfo").textContent = N + " questions \u00B7 " + mins + " min";
  $("paletteTitle").textContent = "Section : " + CFG.sectionLabel;
  $("paletteSecHead").textContent = CFG.sectionLabel;
  $("solPaletteTitle").textContent = "Section : " + CFG.sectionLabel;
  $("solPaletteSecHead").textContent = CFG.sectionLabel;
  $("resTitle").textContent = CFG.examTitle;
  $("resSub").textContent = CFG.sectionLabel;
  $("qMarks").innerHTML = '<span class="p">+' + CFG.correctScoreDisplay + '</span> / <span class="n">-' + CFG.negativeScoreDisplay + '</span>';

  if(hasHindi){
    $("langBox").style.display = "block"; $("langWrap").style.display = "flex"; $("solLangWrap").style.display = "flex";
  } else {
    $("optBox").querySelector(".opt-practice").style.flex = "1";
  }
  setThemeIcon();
}

/* ================= INSTRUCTIONS ================= */
function wsPage(n){
  $("wsPage1").classList.toggle("active", n === 1);
  $("wsPage2").classList.toggle("active", n === 2);
}
function initWelcome(){
  $("instrConfirm").addEventListener("change", function(){ $("startTestBtn").disabled = !this.checked; });
  $("startTestBtn").addEventListener("click", function(){
    if(!$("instrConfirm").checked) return;
    state.instantFeedback = $("instantFeedbackToggle").checked;
    if(hasHindi) state.lang = $("welcomeLang").value;
    state.phase = "testing";
    state.startedAt = state.startedAt || Date.now();
    saveState();
    enterTestPage();
    try{ var el = document.documentElement; if(el.requestFullscreen){ el.requestFullscreen().catch(function(){}); } }catch(e){}
  });
}
function enterTestPage(){
  showScreen("testPage");
  $("langSelect").value = state.lang;
  applyPalState();
  loadQuestion(state.current, true);
  startTimer();
}

/* ================= STATUS / PALETTE ================= */
function statusCounts(){
  var c = {notvisited:0, notanswered:0, answered:0, marked:0, markedans:0};
  for(var i=0;i<N;i++){ c[state.q[i].status]++; }
  return c;
}
function paletteButton(i, cls, extra){
  var bm = savedIds[sid(i)] ? '<span class="bm" title="Saved"></span>' : "";
  return '<button type="button" class="qnum ' + cls + (extra||"") + '" onclick="' + (cls.indexOf("sol") === 0 ? "solGoTo(" : "goTo(") + i + ')"><span class="shape"></span><span class="n">' + (i+1) + '</span>' + bm + '</button>';
}

/* ================= SAVED QUESTIONS (bookmarks, shown in Mock Hub > Saved) ================= */
var savedIds = {};
/* works even if an older common.js (without the saved-questions store) is still deployed */
function hcOk(){ return !!(window.HubCommon && typeof HubCommon.readSaved === "function" && typeof HubCommon.addSaved === "function"); }
function sid(i){ return [CFG.year, CFG.subject, CFG.setId, i].join("|"); }
function refreshSavedIds(){
  savedIds = {};
  if(!hcOk()) return;
  try{ HubCommon.readSaved().forEach(function(e){ savedIds[e.id] = 1; }); }catch(e){}
}
function previewText(q){
  var t = (q.question.en || q.question.hi || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 170 ? t.slice(0, 167) + "..." : t;
}
function toggleSaveFor(i, mark){
  if(!hcOk()){ toast("Save needs the latest assets/common.js on the site"); return; }
  var id = sid(i);
  if(savedIds[id]){
    HubCommon.removeSaved(id);
    toast("Removed from Saved");
  } else {
    var q = QUESTIONS[i];
    var res = !mark ? "skipped" : (mark === q.answer ? "correct" : "wrong");
    var ok = HubCommon.addSaved({
      id: id, y: CFG.year, s: CFG.subject, set: CFG.setId, i: i,
      chapter: CFG.chapterName, title: CFG.setTitle, topic: q.topic || "",
      preview: previewText(q), mark: mark || "", res: res, at: Date.now()
    });
    toast(ok ? "Saved. Find it in Mock Hub > Saved" : "Could not save: browser storage is full");
  }
  refreshSavedIds();
  paintSaveBtns();
}
function toggleSave(){ if(state.phase !== "testing") return; toggleSaveFor(state.current, draft); renderPalette(); }
function toggleSolSave(){ toggleSaveFor(state.solIndex, state.q[state.solIndex].selected); renderSolPalette(); }
function paintSaveBtns(){
  [["saveBtn", state.current], ["solSaveBtn", state.solIndex]].forEach(function(p){
    var b = $(p[0]); if(!b) return;
    var on = !!savedIds[sid(p[1])];
    b.classList.toggle("on", on);
    b.querySelector("span").textContent = on ? "Saved" : "Save";
  });
}
function renderPalette(){
  var html = "";
  for(var i=0;i<N;i++){ html += paletteButton(i, state.q[i].status, i === state.current ? " current" : ""); }
  $("paletteGrid").innerHTML = html;
  var c = statusCounts();
  var pills = $all("#paletteWrap .pal-legend .pal");
  var vals = [c.answered, c.notanswered, c.notvisited, c.marked, c.markedans];
  pills.forEach(function(p, k){ p.textContent = vals[k]; });
  var cur = $("paletteGrid").querySelector(".current");
  if(cur && cur.scrollIntoView){ try{ cur.scrollIntoView({block:"nearest"}); }catch(e){} }
}
function togglePalette(){ state.palHidden = !state.palHidden; applyPalState(); saveState(); }
function applyPalState(){
  document.body.classList.toggle("pal-hidden", !!state.palHidden);
  $("collapseArrow").innerHTML = state.palHidden ? "&#9664;" : "&#9654;";
  $("solCollapseArrow").innerHTML = state.solPalHidden ? "&#9664;" : "&#9654;";
}
function openMobilePalette(){ document.body.classList.add("pal-open"); }
function closeMobilePalette(){ document.body.classList.remove("pal-open"); }

/* ================= QUESTION RENDER ================= */
function loadQuestion(i, firstLoad){
  var st = state.q[i];
  state.current = i;
  if(st.status === "notvisited") st.status = "notanswered";
  draft = st.selected;
  renderQuestion();
  if(!firstLoad) window.scrollTo(0,0);
}

function renderQuestion(){
  var i = state.current, q = QUESTIONS[i], st = state.q[i];
  $("qNoHeading").textContent = i + 1;
  var topicEl = $("qTopicTag");
  if(q.topic){ topicEl.textContent = q.topic; topicEl.style.display = "inline-block"; } else { topicEl.style.display = "none"; }

  $("qText").innerHTML = qHtml(q, state.lang);
  var imgEl = $("qImg");
  if(q.question_image){ imgEl.innerHTML = '<img src="' + q.question_image + '" alt="question image">'; imgEl.style.display = "block"; }
  else { imgEl.style.display = "none"; imgEl.innerHTML = ""; }

  var html = "";
  OPT_KEYS.forEach(function(key, idx){
    var opt = q.options[key];
    if(!opt) return;
    var val = String(idx+1);
    var img = opt.image ? '<div class="qimg"><img src="' + opt.image + '" alt="option image"></div>' : "";
    html += '<div class="opt-row" data-opt="' + val + '">' +
      '<div class="opt-radio" title="Tap the circle to select" onclick="pickOption(\'' + val + '\', event)"><input type="radio" name="opt" value="' + val + '" tabindex="-1"></div>' +
      '<div class="opt-body">' + optHtml(q, key, state.lang) + img + '</div></div>';
  });
  $("qOptions").innerHTML = html;
  decorateImages($("qText")); decorateImages($("qImg")); decorateImages($("qOptions"));

  $("showSolBtn").style.display = state.instantFeedback ? "inline-block" : "none";
  $("showSolBtn").textContent = st.solutionSeen ? "Hide Solution" : "Show Solution";
  $("prevBtn").disabled = (i === 0);
  paintSaveBtns();
  paintSelection();
  renderPalette();
  saveState();
}

function paintSelection(){
  var i = state.current, q = QUESTIONS[i], st = state.q[i];
  var fb = $("fbStrip");
  fb.className = "fb-strip"; fb.textContent = "";
  $all("#qOptions .opt-row").forEach(function(lab){
    var key = lab.getAttribute("data-opt");
    var sel = key === draft;
    lab.classList.toggle("selected", sel);
    lab.querySelector("input").checked = sel;
    lab.classList.remove("fb-correct","fb-wrong");
    var old = lab.querySelector(".opt-badge"); if(old) old.remove();
    if(state.instantFeedback && draft){
      var ok = key === q.answer;
      if(ok){ lab.classList.add("fb-correct"); lab.insertAdjacentHTML("beforeend", '<span class="opt-badge ok">Correct</span>'); }
      else if(sel){ lab.classList.add("fb-wrong"); lab.insertAdjacentHTML("beforeend", '<span class="opt-badge no">Your pick</span>'); }
    }
  });
  if(state.instantFeedback && draft){
    var correct = draft === q.answer;
    fb.classList.add("show", correct ? "ok" : "no");
    fb.textContent = correct ? "Correct answer!" : "Incorrect. The correct option is highlighted in green.";
  }
  $("unsavedHint").style.display = (draft !== st.selected) ? "block" : "none";
  renderLiveSolutionBox();
}

function renderLiveSolutionBox(){
  var i = state.current, q = QUESTIONS[i], st = state.q[i], box = $("liveSolutionBox");
  if(state.instantFeedback && st.solutionSeen){
    box.style.display = "block";
    box.innerHTML = "<h4>Solution</h4><p><b>Correct Answer:</b> Option " + OPT_LETTERS[(parseInt(q.answer,10)||1)-1] + "</p>" +
      (solHtml(q, state.lang) || "<i>No solution text provided.</i>");
    decorateImages(box);
  } else { box.style.display = "none"; box.innerHTML = ""; }
}
function toggleLiveSolution(){
  var st = state.q[state.current];
  st.solutionSeen = !st.solutionSeen; saveState();
  $("showSolBtn").textContent = st.solutionSeen ? "Hide Solution" : "Show Solution";
  renderLiveSolutionBox();
}

/* ================= INTERACTIONS ================= */
function pickOption(val, ev){
  if(ev) ev.preventDefault();
  if(state.phase !== "testing") return;
  draft = (draft === val) ? null : val;     /* clicking the chosen option again deselects it */
  paintSelection();
}
function applyStatusFor(i){
  var st = state.q[i];
  var wasMarked = (st.status === "marked" || st.status === "markedans");
  st.status = st.selected !== null ? (wasMarked ? "markedans" : "answered") : (wasMarked ? "marked" : "notanswered");
}
function commitDraft(){
  var st = state.q[state.current];
  st.selected = draft;
  applyStatusFor(state.current);
}
function saveAndNext(){
  if(state.phase !== "testing") return;
  commitDraft();
  if(state.current < N-1) loadQuestion(state.current + 1); else { renderQuestion(); toast("Saved. This is the last question."); }
}
function markForReview(){
  if(state.phase !== "testing") return;
  var st = state.q[state.current];
  st.selected = draft;
  st.status = st.selected !== null ? "markedans" : "marked";
  if(state.current < N-1) loadQuestion(state.current + 1); else { renderQuestion(); toast("Marked for review."); }
}
function clearResponse(){
  if(state.phase !== "testing") return;
  var st = state.q[state.current];
  draft = null; st.selected = null; st.solutionSeen = false;
  var wasMarked = (st.status === "marked" || st.status === "markedans");
  st.status = wasMarked ? "marked" : "notanswered";
  renderQuestion();
}
function leaveWarn(){
  var st = state.q[state.current];
  if(draft !== st.selected && draft !== null) toast("Your last selection was not saved. Use Save & Next to save an answer.");
}
function goPrev(){ if(state.current > 0){ leaveWarn(); loadQuestion(state.current - 1); } }
function goTo(i){
  if(i < 0 || i >= N || state.phase !== "testing") return;
  if(i !== state.current) leaveWarn();
  loadQuestion(i);
  closeMobilePalette();
}
function setLang(v){ state.lang = v; saveState(); renderQuestion(); }

/* ================= PAUSE / TIMER ================= */
function openPause(){ if(state.phase === "testing") $("pauseModal").classList.add("show"); }
function closePause(){ $("pauseModal").classList.remove("show"); }
function doPause(){
  closePause();
  state.phase = "paused";
  clearInterval(timerHandle);
  saveState();
  $("pauseOverlay").classList.add("show");
}
function resumeTest(){
  state.phase = "testing";
  $("pauseOverlay").classList.remove("show");
  saveState();
  startTimer();
}
function startTimer(){
  if(timerHandle) clearInterval(timerHandle);
  renderTime();
  timerHandle = setInterval(function(){
    if(state.phase !== "testing") return;
    state.timeLeft -= 1;
    state.q[state.current].t += 1;
    if(state.timeLeft <= 0){ state.timeLeft = 0; renderTime(); clearInterval(timerHandle); toast("Time is up. Submitting your test."); doSubmit(true); return; }
    renderTime();
    if(state.timeLeft % 5 === 0) saveState();
  }, 1000);
}
function renderTime(){
  $("timeLeft").textContent = fmtClock(state.timeLeft);
  var box = $("timeLeft").parentNode;
  if(box) box.classList.toggle("low", state.timeLeft <= 120);
}

/* ================= SUBMIT ================= */
function openSubmit(){
  if(state.phase !== "testing") return;
  var c = statusCounts();
  $("mAnswered").textContent = c.answered + c.markedans;
  $("mNotAnswered").textContent = c.notanswered + c.marked;
  $("mMarked").textContent = c.marked + c.markedans;
  $("mNotVisited").textContent = c.notvisited;
  $("submitModal").classList.add("show");
}
function closeSubmitModal(){ $("submitModal").classList.remove("show"); }

function computeResult(){
  var correct=0, wrong=0, unattempt=0, marks=0, neg=0, maxMarks=0;
  for(var i=0;i<N;i++){
    var q = QUESTIONS[i], sel = state.q[i].selected, cs = qScore(q), ns = qNeg(q);
    maxMarks += cs;
    if(sel === null || sel === undefined){ unattempt++; }
    else if(sel === q.answer){ correct++; marks += cs; }
    else { wrong++; neg += ns; marks -= ns; }
  }
  var attempted = correct + wrong;
  var timeTaken = CFG.totalTimeSeconds - state.timeLeft;
  return {
    correct: correct, wrong: wrong, unattempt: unattempt, attempted: attempted,
    score: r2(marks), maxMarks: r2(maxMarks), negMarksTotal: r2(neg),
    accuracy: attempted > 0 ? Math.round(correct/attempted*1000)/10 : 0,
    timeTaken: timeTaken, avgTime: Math.round(timeTaken / N), total: N
  };
}
function doSubmit(){
  closeSubmitModal();
  clearInterval(timerHandle);
  state.phase = "submitted";
  state.finishedAt = Date.now();
  state.result = computeResult();
  saveState();
  try{ if(document.fullscreenElement && document.exitFullscreen){ document.exitFullscreen().catch(function(){}); } }catch(e){}
  renderResult();
  showScreen("resultPage");
}

/* ================= RESULT / ANALYSIS ================= */
function qOutcome(i){
  var sel = state.q[i].selected, q = QUESTIONS[i];
  if(sel === null || sel === undefined) return "skipped";
  return sel === q.answer ? "correct" : "wrong";
}
function renderResult(){
  var r = state.result || computeResult();
  $("finalScore").textContent = r.score;
  $("finalMax").textContent = "/ " + r.maxMarks;
  $("stCorrect").textContent = r.correct;
  $("stWrong").textContent = r.wrong;
  $("stUnattempt").textContent = r.unattempt;
  $("stAccuracy").textContent = r.accuracy + "%";
  $("stTimeTaken").textContent = fmtLong(r.timeTaken);
  $("stAvgTime").textContent = fmtShort(r.avgTime);
  $("stNegMarks").textContent = r.negMarksTotal;
  $("stAttempted").textContent = r.attempted + " / " + r.total;

  var spent = 0; for(var k=0;k<N;k++) spent += state.q[k].t;
  $("secTable").innerHTML =
    "<thead><tr><th>Section</th><th>Questions</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Score</th><th>Accuracy</th><th>Time</th></tr></thead><tbody><tr>" +
    "<td>" + escapeHtml(CFG.sectionLabel) + "</td><td>" + r.total + "</td><td>" + r.attempted + "</td><td>" + r.correct + "</td><td>" + r.wrong +
    "</td><td><b>" + r.score + "</b> / " + r.maxMarks + "</td><td>" + r.accuracy + "%</td><td>" + fmtShort(spent || r.timeTaken) + "</td></tr></tbody>";

  /* topic-wise */
  var topics = {}, order = [];
  for(var i=0;i<N;i++){
    var tp = QUESTIONS[i].topic || "General";
    if(!topics[tp]){ topics[tp] = {n:0, att:0, c:0, w:0, t:0}; order.push(tp); }
    var o = qOutcome(i), T = topics[tp];
    T.n++; T.t += state.q[i].t;
    if(o !== "skipped") T.att++;
    if(o === "correct") T.c++; else if(o === "wrong") T.w++;
  }
  order.sort(function(a,b){ return topics[b].n - topics[a].n; });
  var th = "<thead><tr><th>Topic</th><th>Qs</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Accuracy</th><th>Avg time</th></tr></thead><tbody>";
  order.forEach(function(tp){
    var T = topics[tp], acc = T.att ? Math.round(T.c/T.att*100) : 0;
    th += "<tr><td>" + escapeHtml(tp) + "</td><td>" + T.n + "</td><td>" + T.att + "</td><td>" + T.c + "</td><td>" + T.w +
      '</td><td><span class="bar"><i style="width:' + acc + '%"></i></span>' + acc + "%</td><td>" + fmtShort(T.t / T.n) + "</td></tr>";
  });
  $("topicTable").innerHTML = th + "</tbody>";

  /* time per question */
  var mx = 1; for(var m=0;m<N;m++) mx = Math.max(mx, state.q[m].t);
  var bars = "";
  for(var b=0;b<N;b++){
    var oc = qOutcome(b), cl = oc === "correct" ? "tb-c" : oc === "wrong" ? "tb-w" : "tb-s";
    bars += '<div class="' + cl + '" style="height:' + Math.max(3, Math.round(state.q[b].t / mx * 100)) + '%" title="Q' + (b+1) + ": " + fmtShort(state.q[b].t) + '"></div>';
  }
  $("timeBars").innerHTML = bars;
}

function restartTest(){ $("reattemptModal").classList.add("show"); }
function doRestart(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  window.location.reload();
}

/* ================= SOLUTIONS ================= */
function solFiltered(){
  var f = state.solFilter, out = [];
  for(var i=0;i<N;i++){ if(f === "all" || qOutcome(i) === f) out.push(i); }
  return out;
}
function renderSolPalette(){
  var html = "", f = state.solFilter;
  for(var i=0;i<N;i++){
    var o = qOutcome(i);
    var cls = o === "correct" ? "solcorrect" : o === "wrong" ? "solwrong" : "solskipped";
    var extra = (i === state.solIndex ? " current" : "") + ((f !== "all" && o !== f) ? " dim" : "");
    html += paletteButton(i, cls, extra);
  }
  $("solPaletteGrid").innerHTML = html;
  var c = {correct:0, wrong:0, skipped:0};
  for(var k=0;k<N;k++) c[qOutcome(k)]++;
  var pills = $all("#solPaletteWrap .pal-legend .pal");
  [c.correct, c.wrong, c.skipped].forEach(function(v, idx){ if(pills[idx]) pills[idx].textContent = v; });
  var cur = $("solPaletteGrid").querySelector(".current");
  if(cur && cur.scrollIntoView){ try{ cur.scrollIntoView({block:"nearest"}); }catch(e){} }
}
function renderSolQuestion(){
  var i = state.solIndex, q = QUESTIONS[i], sel = state.q[i].selected, o = qOutcome(i);
  $("solQNoHeading").textContent = i + 1;
  $("solBadgeHolder").innerHTML = '<span class="sol-badge ' + o + '">' + (o === "correct" ? "Correct" : o === "wrong" ? "Wrong" : "Skipped") + "</span>";
  $("solLangSelect").value = state.solLang;
  $("solMarks").innerHTML = '<span class="p">+' + r2(qScore(q)) + '</span> / <span class="n">-' + r2(qNeg(q)) + '</span>';
  var tp = $("solTopicTag");
  if(q.topic){ tp.textContent = q.topic; tp.style.display = "inline-block"; } else { tp.style.display = "none"; }

  $("solQText").innerHTML = qHtml(q, state.solLang);
  var imgEl = $("solQImg");
  if(q.question_image){ imgEl.innerHTML = '<img src="' + q.question_image + '" alt="question image">'; imgEl.style.display = "block"; }
  else { imgEl.style.display = "none"; imgEl.innerHTML = ""; }

  var html = "";
  OPT_KEYS.forEach(function(key, idx){
    var opt = q.options[key];
    if(!opt) return;
    var val = String(idx+1), cls = "", tag = "";
    if(val === q.answer){ cls = " right"; tag = '<span class="tagmini">CORRECT</span>'; }
    else if(val === sel){ cls = " picked-wrong"; tag = '<span class="tagmini">YOUR ANSWER</span>'; }
    html += '<div class="soloption' + cls + '"><span class="opt-letter">' + OPT_LETTERS[idx] + ')</span><span class="opt-body">' + optHtml(q, key, state.solLang) + '</span>' + tag + '</div>';
  });
  $("solOptions").innerHTML = html;

  var ans = parseInt(q.answer,10);
  $("solMeta").innerHTML =
    '<span class="sol-chip">Correct answer: <b>' + (ans ? OPT_LETTERS[ans-1] : "-") + '</b></span>' +
    '<span class="sol-chip">Your answer: <b>' + (sel ? OPT_LETTERS[parseInt(sel,10)-1] : "Not attempted") + '</b></span>' +
    '<span class="sol-chip">Time spent: <b>' + fmtShort(state.q[i].t) + '</b></span>';
  $("solExpl").innerHTML = "<h4>Explanation</h4>" + (solHtml(q, state.solLang) || "<i>No solution text provided.</i>");
  decorateImages($("solQText")); decorateImages($("solQImg")); decorateImages($("solOptions")); decorateImages($("solExpl"));

  var list = solFiltered(), pos = list.indexOf(i);
  $("solPrevBtn").disabled = !(pos > 0 || (pos === -1 && list.length));
  $("solNextBtn").disabled = !(pos !== -1 ? pos < list.length - 1 : list.length);
  $("solInfo").textContent = list.length ? ("Showing " + list.length + " of " + N) : "No questions match this filter";
  paintSaveBtns();
  renderSolPalette();
  saveState();
}
function solGoTo(i){ state.solIndex = i; renderSolQuestion(); closeMobilePalette(); window.scrollTo(0,0); }
function solGoNext(){
  var list = solFiltered(); if(!list.length) return;
  var nxt = list.filter(function(x){ return x > state.solIndex; })[0];
  if(nxt !== undefined) solGoTo(nxt);
}
function solGoPrev(){
  var list = solFiltered(); if(!list.length) return;
  var prv = list.filter(function(x){ return x < state.solIndex; }).pop();
  if(prv !== undefined) solGoTo(prv);
}
function setSolFilter(v){
  state.solFilter = v;
  var list = solFiltered();
  if(list.length && list.indexOf(state.solIndex) === -1) state.solIndex = list[0];
  renderSolQuestion();
}
function setSolLang(v){ state.solLang = v; saveState(); renderSolQuestion(); }
function toggleSolPalette(){ state.solPalHidden = !state.solPalHidden; document.body.classList.toggle("pal-hidden", state.solPalHidden); applyPalState(); saveState(); }
function showSolutions(){
  state.solIndex = 0; state.solFilter = "all";
  $("solFilter").value = "all";
  showScreen("solutionPage");
  document.body.classList.toggle("pal-hidden", !!state.solPalHidden);
  applyPalState();
  renderSolQuestion();
}
function backToResult(){
  document.body.classList.remove("pal-hidden");
  renderResult();
  showScreen("resultPage");
}

/* ================= KEYBOARD ================= */
document.addEventListener("keydown", function(e){
  if(lbIsOpen()){
    if(e.key === "Escape") lbClose();
    else if(e.key === "+" || e.key === "=") lbZoom(1);
    else if(e.key === "-") lbZoom(-1);
    else if(e.key === "0") lbFit();
    return;
  }
  if(e.key === "Escape"){ closeMobilePalette(); }
  if(state.phase !== "testing") return;
  if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
  if(["1","2","3","4","5"].indexOf(e.key) !== -1){
    if(QUESTIONS[state.current].options["option_" + e.key]) pickOption(e.key);
  } else if(e.key === "ArrowRight"){ saveAndNext(); }
  else if(e.key === "ArrowLeft"){ goPrev(); }
});

window.addEventListener("storage", function(e){ if(e.key === "sscscholars_saved_v1"){ refreshSavedIds(); if(state){ paintSaveBtns(); } } });

/* ================= INIT ================= */
function boot(){
  applyZoom();
  state = loadState();
  refreshSavedIds();
  initStaticText();
  initWelcome();
  applyPalState();

  if(state.phase === "submitted"){
    renderResult();
    showScreen("resultPage");
  } else if(state.phase === "testing" || state.phase === "paused"){
    $("instantFeedbackToggle").checked = state.instantFeedback;
    enterTestPage();
    if(state.phase === "paused"){
      clearInterval(timerHandle);
      $("pauseOverlay").classList.add("show");
    }
  } else {
    showScreen("welcomePage");
  }
}
function safeBoot(){
  try{ boot(); }
  catch(err){
    setTimeout(function(){
      var l = $("loadingScreen");
      if(!l) return;
      l.style.display = ""; l.classList.add("err");
      $("loadMsg").textContent = "Exam screen error: " + (err && err.message ? err.message : err);
      $("loadSub").textContent = "Make sure ALL files from the latest zip are uploaded (test.html, assets/engine.js, assets/common.js, assets/test.css), then press Ctrl+F5.";
      $("loadBack").style.display = "inline-block";
    }, 80);
    if(window.console) console.error(err);
  }
}
if(document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", safeBoot); } else { safeBoot(); }
