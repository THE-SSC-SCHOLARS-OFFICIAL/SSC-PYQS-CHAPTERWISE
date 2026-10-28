/* Mock Test Hub
   Section (Chapter-wise / Exam-wise / Top Questions) -> Year -> [Exam] -> Subject -> [Category] -> Chapter -> tests */
(function () {
  var C = window.HUB_CONFIG, H = window.HubCommon;
  var SEL_KEY = "sscscholars_hub_selection";
  var S = { sec: "", year: "", exam: "", subject: "", cat: -1, ch: -1, data: null, idx: null, seq: 0 };

  var INFO = {
    chapter: { no: "01", title: "Chapter-wise PYQ",
      desc: "All previous year questions grouped by subject and chapter. Best for topic-by-topic practice.",
      meta: "Maths / English / GS / Reasoning",
      hint: "Pick the year, subject and chapter." },
    exam: { no: "02", title: "Exam-wise PYQ",
      desc: "Questions that were actually asked in one exam (Selection Post, Steno ...), arranged subject and chapter inside that exam.",
      meta: "Choose the exam first",
      hint: "Pick the year, then the exam, subject and chapter." },
    top: { no: "03", title: "Top Questions",
      desc: "The most repeated, high-weightage questions of each chapter in short sets. Best for quick revision.",
      meta: "Short sets, most asked first",
      hint: "Pick the year, subject and chapter." }
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function secCfg() { return C.sections[S.sec] || {}; }
  function secYears() { return secCfg().years || C.years; }
  function subjectKey() {
    if (S.sec === "chapter") return S.subject;
    return H.makeKey(S.sec, S.exam, S.subject);
  }

  /* ---------- remember selection ---------- */
  function saveSel() {
    try {
      var cat = S.data && S.cat >= 0 ? S.data.categories[S.cat].category : "";
      var ch = cat && S.ch >= 0 ? S.data.categories[S.cat].chapters[S.ch].chapter : "";
      localStorage.setItem(SEL_KEY, JSON.stringify({ sec: S.sec, y: S.year, e: S.exam, s: S.subject, c: cat, h: ch }));
    } catch (e) {}
  }
  function readSel() { try { return JSON.parse(localStorage.getItem(SEL_KEY) || "null"); } catch (e) { return null; } }

  /* ---------- hero statistics ---------- */
  function renderStats() {
    var box = $("heroStats");
    clear(box);
    var items;
    if (S.data && S.data.summary) {
      var sm = S.data.summary;
      var hrs = Math.round((sm.total_time_seconds || 0) / 360) / 10;
      items = [
        [fmtNum(sm.total_chapters || 0), "Chapters"],
        [fmtNum((sm.total_sets || 0) - (sm.pending_sets || 0)), "Tests"],
        [fmtNum(sm.total_questions || 0), "Questions"],
        [String(hrs), "Hours of practice"]
      ];
      if (sm.pending_sets) items.push([fmtNum(sm.pending_sets), "Coming soon"]);
    } else {
      items = [[String(C.sectionOrder.length), "Sections"], [String(C.years.length), "Years"], [String(C.subjects.length), "Subjects"]];
    }
    items.forEach(function (it) {
      var d = el("div", "hero-stat");
      d.appendChild(el("b", null, it[0]));
      d.appendChild(el("span", null, it[1]));
      box.appendChild(d);
    });
  }

  /* ---------- note (loading / error) ---------- */
  function showNote(node, isErr, withBar) {
    var n = $("note");
    n.className = "note" + (isErr ? " err" : "");
    clear(n);
    n.appendChild(node);
    if (withBar) { var b = el("div", "bar2"); b.appendChild(el("i")); n.appendChild(b); }
    n.hidden = false;
  }
  function hideNote() { $("note").hidden = true; }
  function noteLine(strong, rest) {
    var s = el("span");
    s.appendChild(el("b", null, strong));
    if (rest) s.appendChild(document.createTextNode(" " + rest));
    return s;
  }

  /* ---------- section cards ---------- */
  function buildCards() {
    var box = $("secCards");
    clear(box);
    C.sectionOrder.forEach(function (k) {
      var i = INFO[k], cfg = C.sections[k];
      var b = el("button", "sec-card");
      b.type = "button";
      b.setAttribute("data-sec", k);
      b.setAttribute("aria-pressed", String(k === S.sec));
      var top = el("div", "sc-top");
      top.appendChild(el("span", "sc-no", i.no));
      if (cfg.badge) top.appendChild(el("span", "sc-badge", cfg.badge));
      b.appendChild(top);
      b.appendChild(el("h3", null, i.title));
      b.appendChild(el("p", null, i.desc));
      b.appendChild(el("div", "sc-meta", i.meta));
      b.appendChild(el("div", "sc-go", "Open  \u2192"));
      b.addEventListener("click", function () { if (S.sec !== k) selectSection(k, null); scrollToPicker(); });
      box.appendChild(b);
    });
  }
  function syncCards() {
    Array.prototype.forEach.call($("secCards").children, function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-sec") === S.sec)); });
  }
  function scrollToPicker() {
    var t = $("pickWrap");
    if (t && t.scrollIntoView) { try { t.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { t.scrollIntoView(); } }
  }

  /* ---------- year toggle ---------- */
  function syncYearButtons() {
    Array.prototype.forEach.call($("yearSeg").children, function (c) {
      c.setAttribute("aria-pressed", String(c.getAttribute("data-y") === S.year));
      c.classList.toggle("nodata", !yearHasData(c.getAttribute("data-y")));
    });
  }
  function yearHasData(y) {
    if (S.sec === "chapter" || !S.idx) return true;
    return S.idx.groups.some(function (g) { return g.year === y; });
  }
  function buildYears() {
    var seg = $("yearSeg");
    clear(seg);
    secYears().forEach(function (y) {
      var b = el("button", null, y);
      b.type = "button";
      b.setAttribute("data-y", y);
      b.setAttribute("aria-pressed", String(y === S.year));
      b.addEventListener("click", function () {
        if (S.year === y) return;
        S.year = y;
        syncYearButtons();
        onYearChange();
      });
      seg.appendChild(b);
    });
  }

  /* ---------- selects ---------- */
  function fillSelect(sel, placeholder, items) {
    clear(sel);
    var o = el("option", null, placeholder); o.value = ""; sel.appendChild(o);
    items.forEach(function (it, i) { var op = el("option", null, it); op.value = String(i); sel.appendChild(op); });
  }
  function fillSelectKV(sel, placeholder, pairs) {
    clear(sel);
    var o = el("option", null, placeholder); o.value = ""; sel.appendChild(o);
    pairs.forEach(function (p) { var op = el("option", null, p[1]); op.value = p[0]; sel.appendChild(op); });
  }

  function resetBelowSubject() {
    S.data = null; S.cat = -1; S.ch = -1;
    $("catField").hidden = true;
    fillSelect($("selCategory"), "Select category", []);
    fillSelect($("selChapter"), "Select chapter", []);
    $("selChapter").disabled = true;
    renderStats();
    renderSheet();
  }

  function groupsFor(year, exam) {
    return (S.idx ? S.idx.groups : []).filter(function (g) { return g.year === year && (S.sec !== "exam" || !exam || g.exam === exam); });
  }
  function groupsLabelCount(g) {
    var t = g.tests ? plural(g.tests, "test", "tests") : "";
    var p = g.pending ? (g.tests ? " + " : "") + g.pending + " coming soon" : "";
    return t + p;
  }

  /* picker layout for the current section */
  function layoutPicker() {
    var sec = S.sec;
    $("pickWrap").hidden = !sec;
    if (!sec) return;
    $("examField").hidden = sec !== "exam";
    $("pickTitle").textContent = INFO[sec].title;
    $("pickHint").textContent = INFO[sec].hint;
    buildYears();
    fillSelect($("selExam"), "Select exam", []);
    $("selExam").disabled = true;
    if (sec === "chapter") {
      fillSelectKV($("selSubject"), "Select subject", C.subjects.map(function (s) { return [s.key, s.label]; }));
      $("selSubject").disabled = false;
    } else {
      fillSelectKV($("selSubject"), "Select subject", []);
      $("selSubject").disabled = true;
    }
  }

  function selectSection(sec, restore) {
    S.seq++;
    S.sec = sec;
    S.exam = ""; S.subject = ""; S.idx = null;
    var ys = secYears();
    var y = restore && ys.indexOf(restore.y) !== -1 ? restore.y : (sec === "chapter" ? ys[0] : ys[ys.length - 1]);
    S.year = y;
    syncCards();
    hideNote();
    layoutPicker();
    resetBelowSubject();
    try { history.replaceState(null, "", "#" + sec); } catch (e) {}
    if (sec === "chapter") {
      if (restore && restore.s && C.subjects.some(function (s) { return s.key === restore.s; })) {
        S.subject = restore.s; $("selSubject").value = S.subject; loadSubject(restore);
      } else saveSel();
    } else {
      loadIndex(restore);
    }
  }

  function onYearChange() {
    if (S.sec === "chapter") {
      if (S.subject) loadSubject(null); else saveSel();
      return;
    }
    S.exam = ""; S.subject = "";
    resetBelowSubject();
    if (!S.idx) { loadIndex(null); return; }
    afterIndex(null);
  }

  /* ---------- exam-wise / top: index of what exists ---------- */
  function loadIndex(restore) {
    var seq = ++S.seq, sec = S.sec, label = INFO[sec].title;
    showNote(noteLine("Loading " + label + ".", "Please wait."), false, true);
    H.loadSection(sec, function (bytes) {
      if (seq !== S.seq) return;
      showNote(noteLine("Loading " + label + ".", (bytes / 1048576).toFixed(1) + " MB received"), false, true);
    }).then(function (idx) {
      if (seq !== S.seq) return;
      S.idx = idx; hideNote();
      /* if the saved year has no data but another year has, move to it */
      if (!yearHasData(S.year)) {
        var alt = secYears().slice().reverse().filter(yearHasData)[0];
        if (alt && !(restore && restore.y === S.year)) S.year = alt;
      }
      syncYearButtons();
      afterIndex(restore);
    }).catch(function (e) {
      if (seq !== S.seq) return;
      var d = H.describeError(e, S.year, "");
      showNote(noteLine(d.msg, d.sub), true, false);
    });
  }

  function afterIndex(restore) {
    var gs = groupsFor(S.year, ""), sec = S.sec;
    syncYearButtons();
    if (!gs.length) {
      showNote(noteLine(INFO[sec].title + " " + S.year + " is not available yet.", "It will show up here as soon as its data is added to the site."), false, false);
      fillSelectKV($("selSubject"), "Select subject", []); $("selSubject").disabled = true;
      fillSelect($("selExam"), "Select exam", []); $("selExam").disabled = true;
      renderStats(); renderSheet(); saveSel();
      return;
    }
    hideNote();
    if (sec === "exam") {
      var exams = [], seen = {};
      gs.forEach(function (g) { if (!seen[g.exam]) { seen[g.exam] = 1; exams.push(g.exam); } });
      var sel = $("selExam");
      fillSelectKV(sel, "Select exam", exams.map(function (x) {
        var n = gs.filter(function (g) { return g.exam === x; }).reduce(function (a, g) { return a + g.tests; }, 0);
        return [x, H.examLabel(x) + " (" + plural(n, "test", "tests") + ")"];
      }));
      sel.disabled = false;
      fillSelectKV($("selSubject"), "Select subject", []); $("selSubject").disabled = true;
      if (restore && restore.e && seen[restore.e]) { S.exam = restore.e; sel.value = S.exam; fillSubjects(restore); }
      else if (exams.length === 1) { S.exam = exams[0]; sel.value = S.exam; fillSubjects(restore); }
      else { renderStats(); renderSheet(); saveSel(); }
    } else {
      fillSubjects(restore);
    }
  }

  function fillSubjects(restore) {
    var gs = groupsFor(S.year, S.exam).filter(function (g) { return S.sec !== "exam" || g.exam === S.exam; });
    var sel = $("selSubject");
    fillSelectKV(sel, "Select subject", gs.map(function (g) { return [g.base, H.baseLabel(g.base) + " (" + groupsLabelCount(g) + ")"]; }));
    sel.disabled = gs.length === 0;
    S.subject = "";
    var ok = restore && restore.s && gs.some(function (g) { return g.base === restore.s; });
    if (ok) { S.subject = restore.s; sel.value = S.subject; loadSubject(restore); }
    else if (gs.length === 1) { S.subject = gs[0].base; sel.value = S.subject; loadSubject(null); }
    else { resetBelowSubject(); saveSel(); }
  }

  /* ---------- subject data ---------- */
  function loadSubject(restore) {
    var seq = ++S.seq;
    resetBelowSubject();
    if (!S.subject) { hideNote(); saveSel(); return; }
    var key = subjectKey(), label = H.shortSubjectLabel(key);
    showNote(noteLine("Loading " + label + " " + S.year + ".", "Please wait."), false, true);
    H.fetchSubject(S.year, key, function (bytes) {
      if (seq !== S.seq) return;
      showNote(noteLine("Loading " + label + " " + S.year + ".", (bytes / 1048576).toFixed(1) + " MB received"), false, true);
    }).then(function (json) {
      if (seq !== S.seq) return;
      S.data = json; hideNote();
      renderStats();
      var sm = json.summary || {};
      if (sm.pending_sets && sm.pending_sets === sm.total_sets) {
        showNote(noteLine("Coming soon.", "These Top Questions are listed but their content is not published yet. They unlock automatically once the data file is refreshed."), false, false);
      }
      fillCategories(restore);
    }).catch(function (e) {
      if (seq !== S.seq) return;
      var d = H.describeError(e, S.year, S.subject);
      showNote(noteLine(d.msg, d.sub), true, false);
    });
  }

  function fillCategories(restore) {
    var cats = S.data.categories || [];
    if (cats.length > 1) {
      $("catField").hidden = false;
      fillSelect($("selCategory"), "Select category", cats.map(function (c) { return c.category + " (" + plural(c.total_chapters, "chapter", "chapters") + ")"; }));
      var ci = restore && restore.c ? cats.findIndex(function (c) { return c.category === restore.c; }) : -1;
      if (ci >= 0) { $("selCategory").value = String(ci); S.cat = ci; fillChapters(restore); }
      else { renderSheet(); saveSel(); }
    } else if (cats.length === 1) {
      $("catField").hidden = true;
      S.cat = 0;
      fillChapters(restore);
    } else { renderSheet(); saveSel(); }
  }

  function fillChapters(restore) {
    var chs = S.data.categories[S.cat].chapters || [];
    fillSelect($("selChapter"), "Select chapter", chs.map(function (c) {
      var real = c.total_sets - (c.pending_sets || 0);
      return c.chapter + " (" + (real ? plural(real, "test", "tests") : "coming soon") + ")";
    }));
    $("selChapter").disabled = chs.length === 0;
    S.ch = -1;
    var hi = restore && restore.h ? chs.findIndex(function (c) { return c.chapter === restore.h; }) : -1;
    if (hi >= 0) { $("selChapter").value = String(hi); S.ch = hi; }
    renderSheet();
    saveSel();
  }

  /* ---------- test list ---------- */
  function startUrl(setId) {
    return "test.html?y=" + encodeURIComponent(S.year) + "&s=" + encodeURIComponent(subjectKey()) + "&id=" + encodeURIComponent(setId);
  }
  function reviewUrl(setId, attemptId) { return startUrl(setId) + "&attempt=" + encodeURIComponent(attemptId); }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function emptyMsg(title, text) {
    var d = el("div", "empty");
    d.appendChild(el("b", null, title));
    d.appendChild(document.createTextNode(text));
    return d;
  }

  function renderSheet() {
    var sheet = $("sheet");
    clear(sheet);

    if (!S.sec) { sheet.appendChild(emptyMsg("Choose a section to begin.", "Chapter-wise, Exam-wise or Top Questions. Tap one of the cards above, then pick your year, subject and chapter.")); return; }
    if (S.sec !== "chapter" && !S.idx) return;
    if (S.sec === "exam" && !S.exam) { if (S.idx && groupsFor(S.year, "").length) sheet.appendChild(emptyMsg("Select an exam.", "Choose the exam first, then its subject and chapter.")); return; }
    if (!S.subject) { if (S.sec === "chapter" || groupsFor(S.year, S.exam).length) sheet.appendChild(emptyMsg("Select a subject.", "Then choose a chapter. All tests for that chapter are listed here.")); return; }
    if (!S.data) return;
    if (S.cat < 0) { sheet.appendChild(emptyMsg("Select a category.", "This subject is grouped by topic. Choose a category, then a chapter.")); return; }
    if (S.ch < 0) { sheet.appendChild(emptyMsg("Select a chapter.", "The tests for the chapter will appear here.")); return; }

    var key = subjectKey();
    var category = S.data.categories[S.cat];
    var chapter = category.chapters[S.ch];
    var sets = chapter.sets || [];
    var realSets = sets.filter(function (s) { return !s.pending; });
    var totalQ = realSets.reduce(function (a, s) { return a + (s.question_count || 0); }, 0);
    var totalSec = realSets.reduce(function (a, s) { return a + (s.time_seconds || 0); }, 0);

    var head = el("div", "shead");
    var crumb = H.shortSubjectLabel(key) + " / " + S.year;
    if (S.data.categories.length > 1) crumb = H.shortSubjectLabel(key) + " / " + category.category + " / " + S.year;
    head.appendChild(el("div", "crumb", crumb));
    head.appendChild(el("h2", null, chapter.chapter));
    var line = realSets.length ? plural(realSets.length, "test", "tests") + ", " + plural(totalQ, "question", "questions") + ", " + Math.round(totalSec / 60) + " minutes in total."
                               : "Coming soon. " + plural(sets.length, "test", "tests") + " listed, content not published yet.";
    if (chapter.top_n) line = "Top " + chapter.top_n + " questions. " + line;
    head.appendChild(el("p", null, line));
    sheet.appendChild(head);

    var cols = el("div", "cols");
    ["", "Test", "Questions", "Duration", "Marks", "Status", ""].forEach(function (t) { cols.appendChild(el("span", null, t)); });
    sheet.appendChild(cols);

    var rows = el("div", "rows");
    sets.forEach(function (set) {
      var row = el("div", "row" + (set.pending ? " pending" : ""));
      var st = set.pending ? null : H.readStatus(S.year, key, set.set_id);

      var bc = el("div", "bubcell");
      var bub = el("span", "bub" + (st ? " " + st.kind : ""));
      bub.setAttribute("aria-hidden", "true");
      bc.appendChild(bub);
      row.appendChild(bc);

      row.appendChild(el("div", "tname", set.part ? "Part " + set.part : (set.title || set.set_id)));

      var nums = el("div", "nums");
      var q = el("span", null, set.pending ? "-" : String(set.question_count || 0)); q.setAttribute("data-u", set.pending ? "" : "questions");
      var t = el("span", null, set.pending ? "-" : Math.round((set.time_seconds || 0) / 60) + " min"); t.setAttribute("data-u", "");
      var marks = set.marks != null && set.marks !== "" ? set.marks : (set.question_count || 0);
      var m = el("span", null, set.pending ? "-" : String(marks)); m.setAttribute("data-u", set.pending ? "" : "marks");
      nums.appendChild(q); nums.appendChild(t); nums.appendChild(m);
      row.appendChild(nums);

      var stat, btnText, startNew = false;
      if (set.pending) { stat = el("div", "tstatus", "Not published yet"); btnText = "Coming soon"; }
      else if (st && st.kind === "done") { stat = el("div", "tstatus done", "Scored " + st.score + " / " + st.max); btnText = "Start new test"; startNew = true; }
      else if (st && st.kind === "progress") { stat = el("div", "tstatus progress", "In progress, " + mmss(st.left) + " remaining"); btnText = "Resume test"; }
      else { stat = el("div", "tstatus", "Not attempted"); btnText = "Start test"; }
      row.appendChild(stat);

      var acts = el("div", "acts");
      if (set.pending) {
        var dis = el("span", "go ghost disabled", btnText);
        dis.setAttribute("aria-disabled", "true");
        acts.appendChild(dis);
      } else {
        var a = el("a", "go", btnText);
        a.href = startUrl(set.set_id) + (startNew ? "&new=1" : "");
        a.target = "_blank";
        a.rel = "noopener";
        acts.appendChild(a);

        var atts = typeof H.getAttempts === "function" ? H.getAttempts(S.year, key, set.set_id) : [];
        if (atts.length) {
          var sel = el("select", "att-sel");
          sel.setAttribute("aria-label", "Review a past attempt");
          var ph = el("option", null, "Attempts (" + atts.length + ")"); ph.value = ""; sel.appendChild(ph);
          atts.forEach(function (at, i) {
            var o = el("option", null, "Attempt " + (i + 1) + " - " + H.fmtAttemptDate(at.at));
            o.value = at.id; sel.appendChild(o);
          });
          sel.addEventListener("change", function () {
            var id = this.value; this.value = "";
            if (!id) return;
            var w = window.open(reviewUrl(set.set_id, id), "_blank", "noopener");
            if (!w) window.location.href = reviewUrl(set.set_id, id);
          });
          acts.appendChild(sel);
        }
      }
      row.appendChild(acts);
      rows.appendChild(row);
    });
    sheet.appendChild(rows);
  }

  /* ---------- wiring ---------- */
  function resetAll() {
    S.sec = ""; S.subject = ""; S.exam = ""; S.idx = null; S.seq++;
    hideNote();
    syncCards();
    $("pickWrap").hidden = true;
    resetBelowSubject();
    try { localStorage.removeItem(SEL_KEY); history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }

  function init() {
    buildCards();
    fillSelect($("selCategory"), "Select category", []);
    fillSelect($("selChapter"), "Select chapter", []);
    $("pickWrap").hidden = true;
    renderStats();

    $("selExam").addEventListener("change", function (e) {
      S.exam = e.target.value; S.subject = "";
      resetBelowSubject();
      if (!S.exam) { fillSelectKV($("selSubject"), "Select subject", []); $("selSubject").disabled = true; saveSel(); return; }
      fillSubjects(null);
    });
    $("selSubject").addEventListener("change", function (e) { S.subject = e.target.value; loadSubject(null); });
    $("selCategory").addEventListener("change", function (e) {
      S.cat = e.target.value === "" ? -1 : parseInt(e.target.value, 10);
      S.ch = -1;
      if (S.cat < 0) { fillSelect($("selChapter"), "Select chapter", []); $("selChapter").disabled = true; renderSheet(); saveSel(); return; }
      fillChapters(null);
    });
    $("selChapter").addEventListener("change", function (e) {
      S.ch = e.target.value === "" ? -1 : parseInt(e.target.value, 10);
      renderSheet(); saveSel();
    });
    $("resetBtn").addEventListener("click", resetAll);

    /* refresh statuses when returning from a test tab */
    function savedCount() { var n = H.countSaved(), b = $("savedCount"); if (b) b.textContent = n ? " (" + n + ")" : ""; }
    savedCount();
    function refresh() { savedCount(); if (S.data && S.ch >= 0) renderSheet(); }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    window.addEventListener("storage", refresh);

    renderSheet();

    var r = readSel(), hash = (location.hash || "").replace("#", "");
    var valid = function (k) { return C.sectionOrder.indexOf(k) !== -1; };
    if (valid(hash)) selectSection(hash, r && r.sec === hash ? r : null);
    else if (r && valid(r.sec)) selectSection(r.sec, r);
    else if (r && r.s && !r.sec && C.subjects.some(function (s) { return s.key === r.s; })) selectSection("chapter", r);   /* selection saved by the older hub */
    window.addEventListener("hashchange", function () {
      var h2 = (location.hash || "").replace("#", "");
      if (valid(h2) && h2 !== S.sec) selectSection(h2, null);
    });
  }

  init();
})();
