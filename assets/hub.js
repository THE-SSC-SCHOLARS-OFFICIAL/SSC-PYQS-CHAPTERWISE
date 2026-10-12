/* Mock Test Hub: Year -> Subject -> (Category) -> Chapter -> list of tests */
(function () {
  var C = window.HUB_CONFIG, H = window.HubCommon;
  var SEL_KEY = "sscscholars_hub_selection";
  var S = { year: C.years[0], subject: "", cat: -1, ch: -1, data: null, seq: 0 };

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

  /* ---------- remember selection ---------- */
  function saveSel() {
    try {
      var cat = S.data && S.cat >= 0 ? S.data.categories[S.cat].category : "";
      var ch = cat && S.ch >= 0 ? S.data.categories[S.cat].chapters[S.ch].chapter : "";
      localStorage.setItem(SEL_KEY, JSON.stringify({ y: S.year, s: S.subject, c: cat, h: ch }));
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
        [fmtNum(sm.total_sets || 0), "Tests"],
        [fmtNum(sm.total_questions || 0), "Questions"],
        [String(hrs), "Hours of practice"]
      ];
    } else {
      items = [[String(C.years.length), "Years"], [String(C.subjects.length), "Subjects"]];
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

  /* ---------- year toggle ---------- */
  function syncYearButtons() {
    Array.prototype.forEach.call($("yearSeg").children, function (c) { c.setAttribute("aria-pressed", String(c.textContent === S.year)); });
  }
  function buildYears() {
    var seg = $("yearSeg");
    clear(seg);
    C.years.forEach(function (y) {
      var b = el("button", null, y);
      b.type = "button";
      b.setAttribute("aria-pressed", String(y === S.year));
      b.addEventListener("click", function () {
        if (S.year === y) return;
        S.year = y;
        syncYearButtons();
        if (S.subject) loadSubject(null); else saveSel();
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
  function buildSubjects() {
    var sel = $("selSubject");
    clear(sel);
    var o = el("option", null, "Select subject"); o.value = ""; sel.appendChild(o);
    C.subjects.forEach(function (s) { var op = el("option", null, s.label); op.value = s.key; sel.appendChild(op); });
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

  function loadSubject(restore) {
    var seq = ++S.seq;
    resetBelowSubject();
    if (!S.subject) { hideNote(); saveSel(); return; }
    var label = H.shortSubjectLabel(S.subject);
    showNote(noteLine("Loading " + label + " " + S.year + ".", "Please wait."), false, true);
    H.fetchSubject(S.year, S.subject, function (bytes) {
      if (seq !== S.seq) return;
      showNote(noteLine("Loading " + label + " " + S.year + ".", (bytes / 1048576).toFixed(1) + " MB received"), false, true);
    }).then(function (json) {
      if (seq !== S.seq) return;
      S.data = json; hideNote();
      renderStats();
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
    } else if (cats.length === 1) {
      $("catField").hidden = true;
      S.cat = 0;
      fillChapters(restore);
    }
  }

  function fillChapters(restore) {
    var chs = S.data.categories[S.cat].chapters || [];
    fillSelect($("selChapter"), "Select chapter", chs.map(function (c) { return c.chapter + " (" + plural(c.total_sets, "test", "tests") + ")"; }));
    $("selChapter").disabled = chs.length === 0;
    S.ch = -1;
    var hi = restore && restore.h ? chs.findIndex(function (c) { return c.chapter === restore.h; }) : -1;
    if (hi >= 0) { $("selChapter").value = String(hi); S.ch = hi; }
    renderSheet();
    saveSel();
  }

  /* ---------- test list ---------- */
  function startUrl(setId) {
    return "test.html?y=" + encodeURIComponent(S.year) + "&s=" + encodeURIComponent(S.subject) + "&id=" + encodeURIComponent(setId);
  }
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

    if (!S.subject) { sheet.appendChild(emptyMsg("Select a subject to begin.", "Then choose a chapter. All tests for that chapter are listed here.")); return; }
    if (!S.data) return;
    if (S.cat < 0) { sheet.appendChild(emptyMsg("Select a category.", "This subject is grouped by topic. Choose a category, then a chapter.")); return; }
    if (S.ch < 0) { sheet.appendChild(emptyMsg("Select a chapter.", "The tests for the chapter will appear here.")); return; }

    var category = S.data.categories[S.cat];
    var chapter = category.chapters[S.ch];
    var sets = chapter.sets || [];
    var totalQ = sets.reduce(function (a, s) { return a + (s.question_count || 0); }, 0);
    var totalSec = chapter.total_time_seconds || sets.reduce(function (a, s) { return a + (s.time_seconds || 0); }, 0);

    var head = el("div", "shead");
    var crumb = H.shortSubjectLabel(S.subject) + " / " + S.year;
    if (S.data.categories.length > 1) crumb = H.shortSubjectLabel(S.subject) + " / " + category.category + " / " + S.year;
    head.appendChild(el("div", "crumb", crumb));
    head.appendChild(el("h2", null, chapter.chapter));
    head.appendChild(el("p", null, plural(sets.length, "test", "tests") + ", " + plural(totalQ, "question", "questions") +
      ", " + Math.round(totalSec / 60) + " minutes in total."));
    sheet.appendChild(head);

    var cols = el("div", "cols");
    ["", "Test", "Questions", "Duration", "Marks", "Status", ""].forEach(function (t) { cols.appendChild(el("span", null, t)); });
    sheet.appendChild(cols);

    var rows = el("div", "rows");
    sets.forEach(function (set) {
      var st = H.readStatus(S.year, S.subject, set.set_id);
      var row = el("div", "row");

      var bc = el("div", "bubcell");
      var bub = el("span", "bub" + (st ? " " + st.kind : ""));
      bub.setAttribute("aria-hidden", "true");
      bc.appendChild(bub);
      row.appendChild(bc);

      row.appendChild(el("div", "tname", set.part ? "Part " + set.part : (set.title || set.set_id)));

      var nums = el("div", "nums");
      var q = el("span", null, String(set.question_count || 0)); q.setAttribute("data-u", "questions");
      var t = el("span", null, Math.round((set.time_seconds || 0) / 60) + " min"); t.setAttribute("data-u", "");
      var marks = set.marks != null && set.marks !== "" ? set.marks : (set.question_count || 0);
      var m = el("span", null, String(marks)); m.setAttribute("data-u", "marks");
      nums.appendChild(q); nums.appendChild(t); nums.appendChild(m);
      row.appendChild(nums);

      var stat, btnText, ghost = false;
      if (st && st.kind === "done") { stat = el("div", "tstatus done", "Scored " + st.score + " / " + st.max); btnText = "View result"; ghost = true; }
      else if (st && st.kind === "progress") { stat = el("div", "tstatus progress", "In progress, " + mmss(st.left) + " remaining"); btnText = "Resume test"; }
      else { stat = el("div", "tstatus", "Not attempted"); btnText = "Start test"; }
      row.appendChild(stat);

      var a = el("a", "go" + (ghost ? " ghost" : ""), btnText);
      a.href = startUrl(set.set_id);
      a.target = "_blank";
      a.rel = "noopener";
      row.appendChild(a);
      rows.appendChild(row);
    });
    sheet.appendChild(rows);
  }

  /* ---------- wiring ---------- */
  function resetAll() {
    S.subject = ""; S.seq++;
    $("selSubject").value = "";
    hideNote();
    resetBelowSubject();
    try { localStorage.removeItem(SEL_KEY); } catch (e) {}
  }

  function init() {
    buildYears();
    buildSubjects();
    fillSelect($("selCategory"), "Select category", []);
    fillSelect($("selChapter"), "Select chapter", []);
    renderStats();

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
    function refresh() { if (S.data && S.ch >= 0) renderSheet(); }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    window.addEventListener("storage", refresh);

    renderSheet();

    var r = readSel();
    if (r && r.s && C.years.indexOf(r.y) !== -1 && C.subjects.some(function (s) { return s.key === r.s; })) {
      S.year = r.y; S.subject = r.s;
      syncYearButtons();
      $("selSubject").value = S.subject;
      loadSubject(r);
    }
  }

  init();
})();
