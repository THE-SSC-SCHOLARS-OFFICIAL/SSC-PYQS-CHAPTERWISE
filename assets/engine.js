/* ============================================================
   THE SSC SCHOLARS OFFICIAL -- Mock Test Engine
   UI/UX pattern matched to the user's reference CPO mock file.
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

function $(id){ return document.getElementById(id); }

function freshState(){
  var qs = [];
  for(var i=0;i<N;i++){ qs.push({status:"notvisited", selected:null, solutionSeen:false}); }
  return {
    phase: "welcome",
    current: 0,
    q: qs,
    instantFeedback: false,
    timeLeft: CFG.totalTimeSeconds,
    startedAt: null,
    finishedAt: null,
    result: null,
    solIndex: 0,
    paletteHidden: false,
    solPaletteHidden: false,
    lang: "en",
    solLang: "en"
  };
}

function loadState(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return freshState();
    var parsed = JSON.parse(raw);
    if(!parsed || parsed.n !== N || !parsed.s || !parsed.s.q || parsed.s.q.length !== N) return freshState();
    return parsed.s;
  }catch(e){ return freshState(); }
}

function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({n:N, s:state})); }catch(e){}
}

function escapeHtml(s){
  var d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function qHtml(q, lang){ return (lang === "hi" && q.question.hi) ? q.question.hi : q.question.en; }
function optHtml(q, key, lang){
  var o = q.options[key];
  if(!o) return "";
  return (lang === "hi" && o.hi) ? o.hi : o.en;
}
function solHtml(q, lang){
  if(!q.solution_text) return "";
  return (lang === "hi" && q.solution_text.hi) ? q.solution_text.hi : q.solution_text.en;
}

function pad2(n){ n = Math.floor(n); return n < 10 ? "0"+n : ""+n; }
function fmtClock(sec){
  sec = Math.max(0, Math.floor(sec));
  var m = Math.floor(sec/60), s = sec%60;
  return pad2(m) + ":" + pad2(s);
}
function fmtLong(sec){
  sec = Math.max(0, Math.floor(sec));
  var m = Math.floor(sec/60), s = sec%60;
  return m + "m " + s + "s";
}

/* ================= HEADER / STATIC TEXT ================= */
function initStaticText(){
  document.title = CFG.examTitle + " | " + CFG.sectionLabel;
  $("wTitle").textContent = CFG.examTitle;
  $("wSub").textContent = CFG.sectionLabel;
  $("wTotalQ").textContent = N;
  $("wTotalTime").textContent = Math.round(CFG.totalTimeSeconds/60);
  $("wMarks").textContent = "+" + CFG.correctScoreDisplay + " / -" + CFG.negativeScoreDisplay;

  $("hdrTitle").textContent = CFG.examTitle;
  $("hdrSub").textContent = CFG.sectionLabel;
  $("solHdrTitle").textContent = CFG.examTitle;
  $("sectionTab").textContent = CFG.sectionLabel;
  $("solSectionTab").textContent = CFG.sectionLabel;
  $("paletteTitle").textContent = CFG.sectionLabel + " :";
  $("solPaletteTitle").textContent = CFG.sectionLabel + " :";
  $("resSub").textContent = CFG.examTitle + " \u2014 " + CFG.sectionLabel;

  if(hasHindi){
    var opt = '<option value="en">English</option><option value="hi">Hindi</option>';
    $("langSelect").innerHTML = opt;
    $("solLangSelect").innerHTML = opt;
  }
}

/* ================= WELCOME ================= */
function initWelcome(){
  $("startTestBtn").addEventListener("click", function(){
    state.instantFeedback = $("instantFeedbackToggle").checked;
    state.phase = "testing";
    state.startedAt = state.startedAt || Date.now();
    saveState();
    enterTestPage();
    try{
      var el = document.documentElement;
      if(el.requestFullscreen){ el.requestFullscreen().catch(function(){}); }
    }catch(e){}
  });
}

function enterTestPage(){
  $("welcomePage").classList.add("hidden-page");
  $("testPage").classList.remove("hidden-page");
  $("langSelect").value = state.lang;
  applyPaletteCollapse();
  renderQuestion();
  startTimer();
}

/* ================= STATUS / PALETTE ================= */
function statusCounts(){
  var c = {notvisited:0, notanswered:0, answered:0, marked:0, markedans:0};
  for(var i=0;i<N;i++){ c[state.q[i].status]++; }
  return c;
}

function renderPalette(){
  var html = "";
  for(var i=0;i<N;i++){
    var st = state.q[i].status;
    var cur = (i === state.current) ? " current" : "";
    html += '<button type="button" class="qnum ' + st + cur + '" onclick="goTo(' + i + ')">' + (i+1) + '</button>';
  }
  $("paletteGrid").innerHTML = html;
  var c = statusCounts();
  $("stAnswered").textContent = c.answered;
  $("stNotAnswered").textContent = c.notanswered;
  $("stMarked").textContent = c.marked;
  $("stAnsMarked").textContent = c.markedans;
  $("stNotVisited").textContent = c.notvisited;
  $("totalAnsweredTop").textContent = c.answered + c.markedans;
}

function togglePalette(){
  state.paletteHidden = !state.paletteHidden;
  applyPaletteCollapse();
  saveState();
}
function applyPaletteCollapse(){
  var p = $("paletteWrap");
  p.classList.toggle("hidden", state.paletteHidden);
  $("collapseArrow").innerHTML = state.paletteHidden ? "&#9654;" : "&#9664;";
}

/* ================= QUESTION RENDER ================= */
function renderQuestion(){
  var i = state.current;
  var q = QUESTIONS[i];
  var st = state.q[i];
  if(st.status === "notvisited") st.status = "notanswered";

  $("qNoHeading").textContent = "Question No " + (i+1);
  var topicEl = $("qTopicTag");
  if(q.topic){ topicEl.textContent = q.topic; topicEl.style.display = "inline-block"; }
  else { topicEl.style.display = "none"; }

  $("qText").innerHTML = qHtml(q, state.lang);
  var imgEl = $("qImg");
  if(q.question_image){ imgEl.innerHTML = '<img src="'+q.question_image+'" alt="question image">'; imgEl.style.display = "block"; }
  else { imgEl.style.display = "none"; imgEl.innerHTML = ""; }

  var optsHtml = "";
  OPT_KEYS.forEach(function(key, idx){
    var opt = q.options[key];
    if(!opt) return;
    var val = String(idx+1);
    var checked = st.selected === val ? "checked" : "";
    var cls = st.selected === val ? "selected" : "";
    var img = opt.image ? '<div class="qimg"><img src="'+opt.image+'" alt="option image"></div>' : "";
    optsHtml += '<label class="' + cls + '" data-opt="' + val + '">' +
      '<input type="radio" name="opt" value="' + val + '" ' + checked + ' onclick="selectOption(\'' + val + '\')">' +
      OPT_LETTERS[idx] + ') ' + optHtml(q, key, state.lang) + img +
      '</label>';
  });
  $("qOptions").innerHTML = optsHtml;
  decorateImages($("qText")); decorateImages($("qImg")); decorateImages($("qOptions"));

  $("showSolBtn").style.display = state.instantFeedback ? "inline-flex" : "none";
  $("showSolBtn").textContent = st.solutionSeen ? "Hide Solution" : "Show Solution";

  applyFeedback();
  renderPalette();
  saveState();
}

function applyFeedback(){
  var i = state.current;
  var q = QUESTIONS[i];
  var st = state.q[i];
  var fb = $("fbStrip");
  fb.className = "fb-strip";
  fb.textContent = "";

  var labels = $all("#qOptions label");
  labels.forEach(function(lab){
    lab.classList.remove("selected","fb-correct","fb-wrong");
    var badge = lab.querySelector(".opt-badge");
    if(badge) badge.remove();
    var optKey = lab.getAttribute("data-opt");
    var isSel = optKey === st.selected;
    if(isSel) lab.classList.add("selected");

    if(state.instantFeedback && st.selected){
      var isCorrect = optKey === q.answer;
      if(isCorrect){
        lab.classList.add("fb-correct");
        var b1 = document.createElement("span");
        b1.className = "opt-badge ok";
        b1.textContent = "Correct";
        lab.appendChild(b1);
      }
      if(isSel && !isCorrect){
        lab.classList.add("fb-wrong");
        var b2 = document.createElement("span");
        b2.className = "opt-badge no";
        b2.textContent = "Your pick";
        lab.appendChild(b2);
      }
    }
  });

  if(state.instantFeedback && st.selected){
    var correct = st.selected === q.answer;
    fb.classList.add("show", correct ? "ok" : "no");
    fb.textContent = correct ? "Correct answer!" : "Incorrect. The correct option is highlighted in green.";
  }

  renderLiveSolutionBox();
}

function renderLiveSolutionBox(){
  var i = state.current;
  var q = QUESTIONS[i];
  var st = state.q[i];
  var box = $("liveSolutionBox");
  if(state.instantFeedback && st.solutionSeen){
    box.style.display = "block";
    box.innerHTML = "<h4>Solution</h4><p><b>Correct Answer:</b> Option " + q.answer + "</p>" +
      (solHtml(q, state.lang) || "<i>No solution text provided.</i>");
    decorateImages(box);
  } else {
    box.style.display = "none";
    box.innerHTML = "";
  }
}

function toggleLiveSolution(){
  var st = state.q[state.current];
  st.solutionSeen = !st.solutionSeen;
  saveState();
  $("showSolBtn").textContent = st.solutionSeen ? "Hide Solution" : "Show Solution";
  renderLiveSolutionBox();
}

function $all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }

/* ================= INTERACTIONS ================= */
function selectOption(val){
  state.q[state.current].selected = val;
  applyFeedback();
  saveState();
}

function commitStatusFromSelection(i){
  var st = state.q[i];
  var wasMarked = (st.status === "marked" || st.status === "markedans");
  if(st.selected !== null){
    st.status = wasMarked ? "markedans" : "answered";
  } else {
    st.status = wasMarked ? "marked" : "notanswered";
  }
}

function saveAndNext(){
  commitStatusFromSelection(state.current);
  goTo(Math.min(state.current+1, N-1));
}

function markForReview(){
  var st = state.q[state.current];
  st.status = st.selected !== null ? "markedans" : "marked";
  goTo(Math.min(state.current+1, N-1));
}

function clearResponse(){
  var st = state.q[state.current];
  st.selected = null;
  st.solutionSeen = false;
  var wasMarked = (st.status === "marked" || st.status === "markedans");
  st.status = wasMarked ? "marked" : "notanswered";
  renderQuestion();
}

function goPrev(){ goTo(Math.max(state.current-1, 0)); }
function goTo(i){ if(i<0||i>=N) return; state.current = i; renderQuestion(); }

function setLang(v){ state.lang = v; saveState(); renderQuestion(); }
function setSolLang(v){ state.solLang = v; saveState(); renderSolQuestion(); }

/* ================= ZOOM / FULLSCREEN ================= */
var ZOOM_KEY = "sscscholars_zoom_level";
var zoomLevel = 1;
try{ var zz = parseFloat(localStorage.getItem(ZOOM_KEY)); if(zz >= 0.6 && zz <= 3) zoomLevel = zz; }catch(e){}
function zoomChange(dir){
  zoomLevel = Math.min(3, Math.max(0.6, Math.round((zoomLevel + dir*0.1)*100)/100));
  applyZoom();
}
function zoomReset(){ zoomLevel = 1; applyZoom(); }
function applyZoom(){
  document.documentElement.style.setProperty("--zoom", zoomLevel);
  var labs = document.querySelectorAll(".zoomLabel");
  for(var i=0;i<labs.length;i++){ labs[i].textContent = Math.round(zoomLevel*100) + "%"; }
  try{ localStorage.setItem(ZOOM_KEY, String(zoomLevel)); }catch(e){}
  applyImgZoom();
}

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
    var inOption = !!t.closest(".options label");
    if(isBtn || !inOption){
      ev.preventDefault(); ev.stopPropagation();
      lbOpen(img.currentSrc || img.src);
    }
  }, true);
})();

function toggleFullscreen(){
  try{
    if(!document.fullscreenElement){ document.documentElement.requestFullscreen().catch(function(){}); }
    else { document.exitFullscreen().catch(function(){}); }
  }catch(e){}
}
document.addEventListener("fullscreenchange", function(){
  var btn = $("fsBtn");
  if(btn) btn.textContent = document.fullscreenElement ? "Exit Full Screen" : "Full Screen";
});

/* ================= PAUSE / TIMER ================= */
function togglePause(){
  if(state.phase !== "testing" && state.phase !== "paused") return;
  if(state.phase === "testing"){
    state.phase = "paused";
    clearInterval(timerHandle);
    $("pauseOverlay").classList.add("show");
  } else {
    state.phase = "testing";
    $("pauseOverlay").classList.remove("show");
    startTimer();
  }
  saveState();
}

function startTimer(){
  if(timerHandle) clearInterval(timerHandle);
  renderTime();
  timerHandle = setInterval(function(){
    if(state.phase !== "testing") return;
    state.timeLeft -= 1;
    if(state.timeLeft <= 0){
      state.timeLeft = 0;
      renderTime();
      clearInterval(timerHandle);
      doSubmit();
      return;
    }
    renderTime();
    if(state.timeLeft % 5 === 0) saveState();
  }, 1000);
}

function renderTime(){
  var box = $("timeleftBox");
  $("timeLeft").textContent = fmtClock(state.timeLeft);
  if(box) box.classList.toggle("low", state.timeLeft <= 120);
}

/* ================= SUBMIT ================= */
function confirmSubmit(){
  renderPalette();
  var c = statusCounts();
  $("mAnswered").textContent = c.answered + c.markedans;
  $("mNotAnswered").textContent = c.notanswered;
  $("mMarked").textContent = c.marked + c.markedans;
  $("mNotVisited").textContent = c.notvisited;
  $("submitModal").classList.add("show");
}
function closeSubmitModal(){ $("submitModal").classList.remove("show"); }

function computeResult(){
  var correct=0, wrong=0, unattempt=0, marks=0, negMarksTotal=0, maxMarks=0;
  for(var i=0;i<N;i++){
    var q = QUESTIONS[i];
    var sel = state.q[i].selected;
    var cs = (q.correct_score !== undefined && q.correct_score !== null && q.correct_score !== "") ? parseFloat(q.correct_score) : CFG.defaultCorrectScore;
    var ns = (q.negative_score !== undefined && q.negative_score !== null && q.negative_score !== "") ? parseFloat(q.negative_score) : CFG.defaultNegativeScore;
    maxMarks += cs;
    if(sel === null || sel === undefined){ unattempt++; }
    else if(sel === q.answer){ correct++; marks += cs; }
    else { wrong++; negMarksTotal += ns; marks -= ns; }
  }
  var attempted = correct + wrong;
  var accuracy = attempted > 0 ? (correct/attempted*100) : 0;
  var timeTaken = CFG.totalTimeSeconds - state.timeLeft;
  return {
    correct: correct, wrong: wrong, unattempt: unattempt,
    score: Math.round(marks*100)/100,
    maxMarks: Math.round(maxMarks*100)/100,
    negMarksTotal: Math.round(negMarksTotal*100)/100,
    accuracy: Math.round(accuracy*10)/10,
    timeTaken: timeTaken,
    avgTime: Math.round(timeTaken / N),
    total: N
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
  $("testPage").classList.add("hidden-page");
  renderResult();
  $("resultPage").classList.remove("hidden-page");
}

function renderResult(){
  var r = state.result || computeResult();
  $("finalScore").textContent = r.score;
  $("stCorrect").textContent = r.correct;
  $("stWrong").textContent = r.wrong;
  $("stUnattempt").textContent = r.unattempt;
  $("stAccuracy").textContent = r.accuracy + "%";
  $("stMaxMarks").textContent = r.maxMarks;
  $("stNegMarks").textContent = r.negMarksTotal;
  $("stTimeTaken").textContent = fmtLong(r.timeTaken);
  $("stAvgTime").textContent = fmtLong(r.avgTime);
}

function restartTest(){
  if(confirm("This will erase your current attempt and start over. Continue?")){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    window.location.reload();
  }
}

/* ================= SOLUTIONS PAGE ================= */
function solStatus(i){
  var sel = state.q[i].selected;
  var q = QUESTIONS[i];
  if(sel === null || sel === undefined) return "skipped";
  return sel === q.answer ? "correct" : "wrong";
}

function renderSolPalette(){
  var html = "";
  for(var i=0;i<N;i++){
    var st = solStatus(i);
    var cls = st === "correct" ? "solcorrect" : st === "wrong" ? "solwrong" : "solskipped";
    var cur = (i === state.solIndex) ? " current" : "";
    html += '<button type="button" class="qnum ' + cls + cur + '" onclick="solGoTo(' + i + ')">' + (i+1) + '</button>';
  }
  $("solPaletteGrid").innerHTML = html;
}

function renderSolQuestion(){
  var i = state.solIndex;
  var q = QUESTIONS[i];
  var sel = state.q[i].selected;
  var st = solStatus(i);

  $("solQNoHeading").textContent = "Question No " + (i+1);
  var badge = st === "correct" ? '<span class="sol-badge correct">Correct</span>'
            : st === "wrong" ? '<span class="sol-badge wrong">Wrong</span>'
            : '<span class="sol-badge skipped">Skipped</span>';
  $("solBadgeHolder").innerHTML = badge;
  $("solLangSelect").value = state.solLang;

  $("solQText").innerHTML = qHtml(q, state.solLang);
  var imgEl = $("solQImg");
  if(q.question_image){ imgEl.innerHTML = '<img src="'+q.question_image+'" alt="question image">'; imgEl.style.display = "block"; }
  else { imgEl.style.display = "none"; imgEl.innerHTML = ""; }

  var optsHtml = "";
  OPT_KEYS.forEach(function(key, idx){
    var opt = q.options[key];
    if(!opt) return;
    var val = String(idx+1);
    var cls = "", tag = "";
    if(val === q.answer){ cls = "right"; tag = '<span class="tagmini">CORRECT</span>'; }
    else if(val === sel && sel !== q.answer){ cls = "picked-wrong"; tag = '<span class="tagmini">YOUR ANSWER</span>'; }
    optsHtml += '<div class="soloption ' + cls + '">' + OPT_LETTERS[idx] + ') ' + optHtml(q, key, state.solLang) + ' ' + tag + '</div>';
  });
  $("solOptions").innerHTML = optsHtml;
  decorateImages($("solQText")); decorateImages($("solQImg")); decorateImages($("solOptions"));

  var explHead = '<h4>Explanation</h4>';
  $("solExpl").innerHTML = explHead + (solHtml(q, state.solLang) || "<i>No solution text provided.</i>");
  decorateImages($("solExpl"));

  $("solPrevBtn").disabled = (i === 0);
  $("solNextBtn").disabled = (i === N-1);

  renderSolPalette();
  saveState();
}

function solGoTo(i){ state.solIndex = i; renderSolQuestion(); }
function solGoNext(){ solGoTo(Math.min(state.solIndex+1, N-1)); }
function solGoPrev(){ solGoTo(Math.max(state.solIndex-1, 0)); }

function toggleSolPalette(){
  state.solPaletteHidden = !state.solPaletteHidden;
  applySolPaletteCollapse();
  saveState();
}
function applySolPaletteCollapse(){
  var p = $("solPaletteWrap");
  p.classList.toggle("hidden", state.solPaletteHidden);
  $("solCollapseArrow").innerHTML = state.solPaletteHidden ? "&#9654;" : "&#9664;";
}

function showSolutions(){
  $("resultPage").classList.add("hidden-page");
  $("solutionPage").classList.remove("hidden-page");
  state.solIndex = 0;
  applySolPaletteCollapse();
  renderSolQuestion();
  saveState();
}
function backToResult(){
  $("solutionPage").classList.add("hidden-page");
  renderResult();
  $("resultPage").classList.remove("hidden-page");
}

/* ================= KEYBOARD SHORTCUTS ================= */
document.addEventListener("keydown", function(e){
  if(lbIsOpen()){
    if(e.key === "Escape") lbClose();
    else if(e.key === "+" || e.key === "=") lbZoom(1);
    else if(e.key === "-") lbZoom(-1);
    else if(e.key === "0") lbFit();
    return;
  }
  if(state.phase !== "testing") return;
  if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
  if(["1","2","3","4","5"].indexOf(e.key) !== -1){
    var lab = document.querySelector('#qOptions label[data-opt="'+e.key+'"] input');
    if(lab){ lab.checked = true; selectOption(e.key); }
  } else if(e.key === "ArrowRight"){ saveAndNext(); }
  else if(e.key === "ArrowLeft"){ goPrev(); }
});

/* ================= INIT ================= */
function boot(){
  applyZoom();
  state = loadState();
  initStaticText();
  initWelcome();

  if(state.phase === "submitted"){
    $("welcomePage").classList.add("hidden-page");
    $("solLangSelect").value = state.solLang;
    renderResult();
    $("resultPage").classList.remove("hidden-page");
  } else if(state.phase === "testing" || state.phase === "paused"){
    $("instantFeedbackToggle").checked = state.instantFeedback;
    enterTestPage();
    if(state.phase === "paused"){
      clearInterval(timerHandle);
      $("pauseOverlay").classList.add("show");
    }
  }
  /* else: stay on welcomePage (its default state in the markup) */
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
