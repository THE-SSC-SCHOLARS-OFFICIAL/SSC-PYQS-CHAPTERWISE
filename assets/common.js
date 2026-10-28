/* Shared helpers used by both the hub (index.html) and the test page (test.html) */
(function () {
  var C = window.HUB_CONFIG;
  var cache = {};

  function dataUrl(year, subject) {
    return C.dataDir + "/" + year + "_" + subject + ".json" +
      (C.dataVersion ? "?v=" + encodeURIComponent(C.dataVersion) : "");
  }

  function normaliseNames(j) {
    if (!j || j.__names) return;
    (j.categories || []).forEach(function (c) {
      c.category = decodeText(c.category);
      (c.chapters || []).forEach(function (ch) {
        ch.chapter = decodeText(ch.chapter);
        (ch.sets || []).forEach(function (st) { st.title = decodeText(st.title); });
      });
    });
    j.__names = true;
  }

  /* ================= Subject keys =================
     Chapter-wise : "Maths", "GS" ...        (unchanged, file <year>_<key>.json)
     Exam-wise    : "ex.<EXAM>.<Subject>"    e.g. ex.STENO.GS
     Top Questions: "top.<Subject>"          e.g. top.Maths                          */
  function parseKey(subject) {
    var s = String(subject || ""), m = s.match(/^ex\.([^.]+)\.(.+)$/);
    if (m) return { mode: "exam", exam: m[1], base: m[2] };
    m = s.match(/^top\.(.+)$/);
    if (m) return { mode: "top", exam: "", base: m[1] };
    return { mode: "chapter", exam: "", base: s };
  }
  function makeKey(mode, exam, base) {
    if (mode === "exam") return "ex." + exam + "." + base;
    if (mode === "top") return "top." + base;
    return base;
  }
  var SUBJ_MAP = { "math": "Maths", "maths": "Maths", "mathematics": "Maths", "quant": "Maths", "quantitative aptitude": "Maths",
    "english": "English", "english language": "English",
    "general awareness": "GS", "gs": "GS", "ga": "GS", "gk": "GS", "general studies": "GS", "general knowledge": "GS",
    "reasoning": "Reasoning", "general intelligence and reasoning": "Reasoning", "general intelligence": "Reasoning" };
  function subjKeyOf(name) {
    var n = String(name || "").trim().toLowerCase();
    if (SUBJ_MAP[n]) return SUBJ_MAP[n];
    return String(name || "").replace(/[^A-Za-z0-9]+/g, "") || "Other";
  }
  function baseLabel(base) {
    for (var i = 0; i < C.subjects.length; i++) if (C.subjects[i].key === base) return C.subjects[i].label;
    return base;
  }
  function prettyExam(code) {
    return String(code).split("-").map(function (w) {
      return w.length <= 4 && w.length > 1 && !/[AEIOU]/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(" ");
  }
  function examLabel(code) {
    var L = (C.sections && C.sections.exam && C.sections.exam.examLabels) || {};
    return L[code] || prettyExam(code);
  }
  function subjectLabel(key) {
    var p = parseKey(key);
    if (p.mode === "exam") return examLabel(p.exam) + " \u00B7 " + baseLabel(p.base);
    if (p.mode === "top") return "Top Questions \u00B7 " + baseLabel(p.base);
    return baseLabel(p.base);
  }
  function shortSubjectLabel(subject) {
    var p = parseKey(subject), b = baseLabel(p.base).replace(/\s*\(.*\)\s*/, "");
    if (p.mode === "exam") return examLabel(p.exam) + " \u00B7 " + b;
    if (p.mode === "top") return "Top \u00B7 " + b;
    return b;
  }

  /* ================= JSON loading ================= */
  function fetchJson(url, onProgress) {
    return fetch(url, { cache: "force-cache" }).then(function (res) {
      if (!res.ok) { var e = new Error("HTTP " + res.status); e.status = res.status; e.url = url; throw e; }
      if (!res.body || !res.body.getReader || !onProgress) return res.json();
      var reader = res.body.getReader(), chunks = [], got = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          chunks.push(r.value); got += r.value.length; onProgress(got);
          return pump();
        });
      }
      return pump().then(function () { return new Blob(chunks).text(); })
                   .then(function (t) { return JSON.parse(t); });
    });
  }

  /* Chapter-wise: one JSON per year+subject (cached in memory and by the browser) */
  function fetchChapterSubject(year, subject, onProgress) {
    var key = year + "_" + subject;
    if (cache[key]) return Promise.resolve(cache[key]);
    return fetchJson(dataUrl(year, subject), onProgress).then(function (j) { normaliseNames(j); cache[key] = j; return j; });
  }

  /* ================= Exam-wise / Top Questions (raw extractor files) ================= */
  var rawCache = {}, secCache = {};
  function fileUrl(name) { return C.dataDir + "/" + name + (C.dataVersion ? "?v=" + encodeURIComponent(C.dataVersion) : ""); }

  function loadFiles(sec, onProgress) {
    var files = (C.sections[sec] && C.sections[sec].files) || [], cur = [];
    return Promise.all(files.map(function (name, i) {
      if (rawCache[name]) return Promise.resolve({ name: name, json: rawCache[name] });
      return fetchJson(fileUrl(name), function (b) {
        cur[i] = b;
        if (onProgress) onProgress(cur.reduce(function (a, v) { return a + (v || 0); }, 0));
      }).then(function (j) { rawCache[name] = j; return { name: name, json: j }; },
              function (e) { if (e && e.status === 404) return { name: name, json: null, url: e.url }; throw e; });
    })).then(function (arr) {
      var ok = arr.filter(function (a) { return a.json; });
      if (!ok.length) { var e = new Error("HTTP 404"); e.status = 404; e.url = arr.length ? arr[0].url : ""; e.file = arr.length ? arr[0].name : "(no file configured)"; throw e; }
      return ok;
    });
  }

  var SUBJ_TOK = "MATHS|MATH|REASONING|ENGLISH|GA|GS|GK";
  function idInfo(id, hasExam) {
    id = String(id || "");
    var re = hasExam ? new RegExp("^SSC-SUB-(\\d{2})-(.+?)-(" + SUBJ_TOK + ")-(.*)$", "i")
                     : new RegExp("^SSC-SUB-(\\d{2})-()(" + SUBJ_TOK + ")-(.*)$", "i");
    var m = id.match(re);
    if (!m) return { year: (id.match(/^SSC-SUB-(\d{2})-/) || [])[1] ? "20" + id.match(/^SSC-SUB-(\d{2})-/)[1] : "", exam: "GENERAL", subjTok: "", chapter: "", part: 0, topN: 0 };
    var rest = m[4], part = 0, topN = 0, pm = rest.match(/-part-(\d+)$/i);
    if (pm) { part = parseInt(pm[1], 10); rest = rest.replace(/-part-\d+$/i, ""); }
    var tm = rest.match(/-TOP-(\d+)(?:-QUESTIONS?)?$/i);
    if (tm) { topN = parseInt(tm[1], 10); rest = rest.replace(/-TOP-\d+(?:-QUESTIONS?)?$/i, ""); }
    return { year: "20" + m[1], exam: m[2] ? m[2].toUpperCase().replace(/_/g, "-") : "", subjTok: m[3], chapter: rest.replace(/-/g, " "), part: part, topN: topN };
  }

  function info(t, sec) {
    var hasExam = sec === "exam", ti = idInfo(t.id, hasExam);
    var p = (t.catalog && t.catalog.path) || [], hasYear = /^\d{4}$/.test(p[0] || "");
    var year = hasYear ? p[0] : ti.year, rest = hasYear ? p.slice(1) : p.slice(0);
    var subjName = rest[0] || (t.meta && t.meta.subject) || ti.subjTok || "Other";
    var mid = rest.slice(1);
    return {
      year: year, exam: hasExam ? ti.exam : "", base: subjKeyOf(subjName), baseName: subjName,
      cat: mid.length > 1 ? mid.slice(0, -1).join(" / ") : subjName,
      chapter: mid.length ? mid[mid.length - 1] : (ti.chapter || t.title || t.id),
      part: ti.part, topN: ti.topN
    };
  }
  function pendInfo(sk, sec) {
    var ti = idInfo(sk.id, sec === "exam");
    return { year: ti.year, exam: sec === "exam" ? ti.exam : "", base: subjKeyOf(ti.subjTok), baseName: ti.subjTok, cat: "", chapter: ti.chapter || sk.id, part: ti.part, topN: ti.topN };
  }
  function testQs(t) {
    if (t.total_questions) return t.total_questions;
    var n = 0, s = t.sections || {};
    Object.keys(s).forEach(function (k) { n += (s[k].question_count || (s[k].questions || []).length); });
    return n || (t.questions || []).length;
  }

  /* index of everything in a section: groups of (year, exam, subject) */
  function buildIndex(sec, files) {
    var map = {}, order = [];
    function grp(i) {
      var k = i.year + "|" + i.exam + "|" + i.base;
      if (!map[k]) { map[k] = { year: i.year, exam: i.exam, base: i.base, baseName: i.baseName, tests: 0, questions: 0, pending: 0 }; order.push(k); }
      return map[k];
    }
    var have = {};
    files.forEach(function (f) {
      (f.json.tests || []).forEach(function (t) { have[t.id] = 1; var g = grp(info(t, sec)); g.tests++; g.questions += testQs(t); });
    });
    files.forEach(function (f) {
      (f.json.skipped_tests || []).forEach(function (sk) { if (have[sk.id]) return; have[sk.id] = 1; grp(pendInfo(sk, sec)).pending++; });
    });
    return order.map(function (k) { return map[k]; });
  }

  function loadSection(sec, onProgress) {
    if (secCache[sec]) return secCache[sec];
    var p = loadFiles(sec, onProgress).then(function (files) { return { sec: sec, files: files, groups: buildIndex(sec, files) }; });
    p.catch(function () { delete secCache[sec]; });
    secCache[sec] = p;
    return p;
  }

  /* Raw extractor tests -> the same chapter/set structure the Chapter-wise JSON has,
     so the hub list, test engine, saved page and dashboard all work unchanged. */
  function shapeSection(S, year, exam, base) {
    var sec = S.sec, cats = [], cmap = {}, baseName = base;
    function getCat(name) {
      if (!cmap[name]) { cmap[name] = { category: name, chapters: [], _m: {} }; cats.push(cmap[name]); }
      return cmap[name];
    }
    function getChap(i, t) {
      var c = getCat(i.cat);
      if (!c._m[i.chapter]) {
        var mk = t && t.marking || {}, mt = t && t.meta || {};
        var ch = { chapter: i.chapter, chapter_slug: i.chapter.replace(/[^A-Za-z0-9]+/g, "_"), base_id: t ? t.id : "", top_n: i.topN || 0,
          total_sets: 0, total_questions: 0, total_time_seconds: 0, pending_sets: 0,
          api_meta: { correct_score: mk.correct != null ? mk.correct : (mt.correct_score != null ? mt.correct_score : 2),
                      negative_score: mk.negative != null ? mk.negative : (mt.negative_score != null ? mt.negative_score : 0.5) },
          sets: [] };
        c._m[i.chapter] = ch; c.chapters.push(ch);
      }
      return c._m[i.chapter];
    }
    S.files.forEach(function (f) {
      (f.json.tests || []).forEach(function (t) {
        var i = info(t, sec);
        if (i.year !== year || i.exam !== exam || i.base !== base) return;
        baseName = i.baseName;
        var ch = getChap(i, t), secs = t.sections, names = secs && typeof secs === "object" && !Array.isArray(secs) ? Object.keys(secs) : [];
        var cs = ch.api_meta.correct_score, ns = ch.api_meta.negative_score;
        function add(sid, part, title, s, qs, secs_) {
          var qn = qs.length, sc = parseFloat(cs) || 2;
          var sets = {
            set_id: sid, part: part, title: title, access: "paid", question_count: qn, declared_questions: qn, count_matches_listing: true,
            time_label: Math.round(secs_ / 60) + " Min", time_seconds: secs_, marks: Math.round(qn * sc * 100) / 100,
            correct_score: String(cs), negative_score: String(ns), in_listing: true,
            questions: qs.map(function (q, n) {
              var mk = q.marks || {};
              return { q_no: n + 1, uid: String(q.quid || q.local_id || q.uid || ""), category: i.cat, chapter: i.chapter, topic: q.topic || "", difficulty_level: "",
                question: q.question || {}, options: q.options || {}, answer: q.answer, solution: q.solution || {}, extra_image_fields: {},
                correct_score: mk.correct != null ? mk.correct : "", negative_score: mk.negative != null ? mk.negative : "" };
            })
          };
          ch.sets.push(sets); ch.total_sets++; ch.total_questions += qn; ch.total_time_seconds += secs_;
        }
        if (names.length) {
          names.forEach(function (sn, idx) {
            var s = secs[sn], qs = s.questions || [];
            if (!qs.length) return;
            var dm = String(sn).match(/(\d+)/), part = names.length === 1 && i.part ? i.part : (dm ? parseInt(dm[1], 10) : idx + 1);
            add(names.length === 1 ? t.id : t.id + "-" + String(sn).replace(/[^A-Za-z0-9]+/g, "-"), part,
                (t.title || i.chapter) + " " + sn, s, qs, s.time_seconds || Math.round((qs.length) * 72));
          });
        } else if (Array.isArray(t.questions) && t.questions.length) {
          var tm = (t.timing && t.timing.full_mock_seconds) || (t.meta && t.meta.timer_seconds) || t.questions.length * 72;
          add(t.id, i.part || ch.sets.length + 1, t.title || i.chapter, null, t.questions, tm);
        }
      });
      (f.json.skipped_tests || []).forEach(function (sk) {
        var i = pendInfo(sk, sec);
        if (i.year !== year || i.exam !== exam || i.base !== base) return;
        if (!i.cat) i.cat = baseLabel(base).replace(/\s*\(.*\)\s*/, "");
        /* the real tests (if any) decide the category name; pending chapters join that category */
        if (cats.length === 1) i.cat = cats[0].category;
        var exists = false;
        cats.forEach(function (c) { c.chapters.forEach(function (ch) { ch.sets.forEach(function (s) { if (s.set_id === sk.id) exists = true; }); }); });
        if (exists) return;
        var ch = getChap(i, null);
        if (!ch.top_n && i.topN) ch.top_n = i.topN;
        ch.sets.push({ set_id: sk.id, part: i.part || ch.sets.length + 1, title: sk.id, pending: true, pending_reason: sk.reason || "", question_count: 0, time_seconds: 0, questions: [] });
        ch.total_sets++; ch.pending_sets++;
      });
    });
    var sum = { total_categories: 0, total_chapters: 0, total_sets: 0, total_questions: 0, total_time_seconds: 0, pending_sets: 0 };
    cats.forEach(function (c) {
      delete c._m;
      c.chapters.forEach(function (ch) { ch.sets.sort(function (a, b) { return (a.part || 0) - (b.part || 0); }); });
      c.total_chapters = c.chapters.length;
      c.total_sets = c.chapters.reduce(function (a, ch) { return a + ch.total_sets; }, 0);
      c.total_questions = c.chapters.reduce(function (a, ch) { return a + ch.total_questions; }, 0);
      c.total_time_seconds = c.chapters.reduce(function (a, ch) { return a + ch.total_time_seconds; }, 0);
      sum.total_categories++; sum.total_chapters += c.total_chapters; sum.total_sets += c.total_sets;
      sum.total_questions += c.total_questions; sum.total_time_seconds += c.total_time_seconds;
      c.chapters.forEach(function (ch) { sum.pending_sets += ch.pending_sets; });
    });
    return { exam: sec === "exam" ? examLabel(exam) : "Top Questions", exam_label: sec === "exam" ? examLabel(exam) : "", year: year, subject: base, subject_name: baseName,
      summary: sum, categories: cats };
  }

  function fetchSubject(year, subject, onProgress) {
    var pk = parseKey(subject);
    if (pk.mode === "chapter") return fetchChapterSubject(year, subject, onProgress);
    var key = "S|" + year + "|" + subject;
    if (cache[key]) return Promise.resolve(cache[key]);
    return loadSection(pk.mode, onProgress).then(function (S) {
      var j = shapeSection(S, year, pk.exam, pk.base);
      normaliseNames(j); cache[key] = j; return j;
    });
  }

  function describeError(e, year, subject) {
    if (location.protocol === "file:") {
      return { msg: "This page was opened from the local file system.",
               sub: "Browsers block JSON loading from file:// addresses. Open a terminal in this folder, run " +
                    "\"python -m http.server 8000\" and visit http://localhost:8000, or host the site on GitHub Pages." };
    }
    if (e && e.status === 404 && e.file) {
      return { msg: e.file + " was not found.",
               sub: "Place the file in the \"" + C.dataDir + "\" folder (expected at " + (e.url || "") + "). The file name is listed in assets/config.js." };
    }
    if (e && e.status === 404) {
      return { msg: year + "_" + subject + ".json was not found.",
               sub: "Place the file in the \"" + C.dataDir + "\" folder (expected at " + (e.url || "") + ")." };
    }
    return { msg: "The data could not be loaded.", sub: String((e && e.message) || e) };
  }

  /* ---- progress (saved test state in localStorage) ---- */
  function storageKey(year, subject, setId) { return "sscscholars_hub_" + year + "_" + subject + "_" + setId; }

  function readStatus(year, subject, setId) {
    try {
      var raw = localStorage.getItem(storageKey(year, subject, setId));
      if (!raw) return null;
      var s = JSON.parse(raw).s;
      if (!s) return null;
      if (s.phase === "submitted" && s.result) return { kind: "done", score: s.result.score, max: s.result.maxMarks };
      if (s.phase === "testing" || s.phase === "paused") return { kind: "progress", left: s.timeLeft };
      return null;
    } catch (e) { return null; }
  }

  /* ---- JSON structure helpers ---- */
  function findSet(json, setId) {
    var cats = json.categories || [];
    for (var a = 0; a < cats.length; a++) {
      var chs = cats[a].chapters || [];
      for (var b = 0; b < chs.length; b++) {
        var sets = chs[b].sets || [];
        for (var c = 0; c < sets.length; c++) {
          if (sets[c].set_id === setId) return { category: cats[a], chapter: chs[b], set: sets[c], multiCategory: cats.length > 1 };
        }
      }
    }
    return null;
  }

  function fmtScore(v) {
    var n = parseFloat(v);
    if (isNaN(n)) return "";
    return String(Math.round(n * 100) / 100);
  }

  function minutesFromLabel(label) {
    var m = String(label || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) * 60 : 0;
  }

  /* Relative image paths (when images were downloaded locally) are resolved against the data folder */
  var IMG_RE = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi;
  /* Some questions arrive with their HTML tags escaped (&lt;span class=&quot;math-tex&quot;&gt;) and would
     show up as visible text. This turns only genuine HTML tags back into tags and leaves math symbols
     such as "x &lt; y" untouched. */
  /* Text in the data is sometimes escaped twice (&amp;#39; &amp;nbsp; &amp;quot; &amp;times; ...), so the
     browser shows "&#39;" or "&nbsp;" literally. Turn every double-escaped entity back into a normal one;
     the browser then decodes it. A plain "&amp;" followed by a space or letter (e.g. "Profit &amp; Loss") is untouched. */
  var DBL_ENT = /&amp;(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g;
  function undouble(html) {
    for (var i = 0; i < 3 && html.indexOf("&amp;") !== -1; i++) {
      var n = html.replace(DBL_ENT, "&$1;");
      if (n === html) break;
      html = n;
    }
    return html;
  }
  /* Plain-text fields (chapter names, titles, topics): decode all entities to real characters */
  var _ta = null;
  function decodeText(s) {
    if (s == null) return "";
    s = String(s);
    if (s.indexOf("&") === -1) return s;
    s = undouble(s);
    if (!_ta) _ta = document.createElement("textarea");
    _ta.innerHTML = s;
    return _ta.value;
  }

  var ESC_TAG = /&lt;(\/?)(span|p|br|b|i|u|em|strong|sub|sup|img|div|font|table|thead|tbody|tr|td|th|ul|ol|li|h[1-6])((?:\s[^<>]*?)?)(\/?)&gt;/gi;
  function unescapeTags(html) {
    if (!html) return "";
    html = undouble(html);
    if (html.indexOf("&lt;") === -1) return html;
    return html.replace(ESC_TAG, function (m, slash, tag, attrs, selfc) {
      attrs = attrs.replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&");
      return "<" + slash + tag + attrs + selfc + ">";
    });
  }

  function fixSrc(html) {
    html = unescapeTags(html);
    if (!html || html.toLowerCase().indexOf("<img") === -1) return html || "";
    var base = (C.imagesBase || (C.dataDir + "/"));
    return html.replace(IMG_RE, function (m, head, q, u) {
      if (/^(https?:|data:|\/\/|\/)/i.test(u)) return m;
      return head + q + base + u.replace(/^\.\//, "") + q;
    });
  }
  function fixUrl(u) {
    if (!u || /^(https?:|data:|\/\/|\/)/i.test(u)) return u || "";
    return (C.imagesBase || (C.dataDir + "/")) + u.replace(/^\.\//, "");
  }
  function withImg(html, url) {
    html = html || "";
    if (!url || html.indexOf(url) !== -1) return html;
    return html + '<br><img src="' + url + '" alt="">';
  }

  function normQuestion(q, i, setCs, setNs) {
    var ex = q.extra_image_fields || {};
    var optsRaw = q.options || {};
    var opts = {};
    for (var n = 1; n <= 5; n++) {
      var v = optsRaw[String(n)] || optsRaw["option_" + n];
      if (!v) continue;
      if (typeof v === "string") v = { en: v, hi: "" };
      var oi = ex["option_image_" + n];
      opts["option_" + n] = {
        en: fixSrc(withImg(v.en || "", oi)),
        hi: v.hi ? fixSrc(withImg(v.hi, oi)) : "",
        image: ""
      };
    }
    var qq = q.question || {};
    var sol = q.solution || q.solution_text || {};
    var si = ex.solution_image;
    var ans = String(q.answer == null ? "" : q.answer).trim().replace(/^option[_\s]?(\d+)$/i, "$1");
    var qimg = ex.question_image ? fixUrl(ex.question_image) : "";
    return {
      q_no: q.q_no || (i + 1),
      id: String(q.uid || q.id || ""),
      topic: decodeText(q.topic),
      difficulty_level: q.difficulty_level || "",
      question: { en: fixSrc(qq.en || ""), hi: fixSrc(qq.hi || "") },
      question_image: qimg,
      options: opts,
      answer: ans,
      correct_score: (q.correct_score !== undefined && q.correct_score !== "") ? q.correct_score : setCs,
      negative_score: (q.negative_score !== undefined && q.negative_score !== "") ? q.negative_score : setNs,
      solution_text: { en: fixSrc(withImg(sol.en || "", si)), hi: sol.hi ? fixSrc(withImg(sol.hi, si)) : "" },
      solution_image: ""
    };
  }

  /* One set from the JSON -> engine config + questions */
  function buildTest(json, found, year, subject) {
    var set = found.set, chapter = found.chapter, category = found.category;
    var meta = chapter.api_meta || {};
    var csRaw = set.correct_score != null && set.correct_score !== "" ? set.correct_score : (meta.correct_score != null ? meta.correct_score : 2);
    var nsRaw = set.negative_score != null && set.negative_score !== "" ? set.negative_score : (meta.negative_score != null ? meta.negative_score : 0.5);
    var secs = parseInt(set.time_seconds, 10) || minutesFromLabel(set.time_label) || 1800;
    var partTxt = set.part ? "PART " + set.part : (set.title || "");
    var label = shortSubjectLabel(subject);
    if (found.multiCategory) label += " - " + category.category;
    var qs = (set.questions || []).map(function (q, i) { return normQuestion(q, i, csRaw, nsRaw); });
    return {
      cfg: {
        examTitle: (chapter.chapter + " - " + partTxt + " (" + (json.exam_label ? json.exam_label + " " : "") + year + ")").toUpperCase(),
        sectionLabel: label,
        storageKey: storageKey(year, subject, set.set_id),
        year: String(year),
        subject: subject,
        setId: set.set_id,
        chapterName: chapter.chapter,
        setTitle: partTxt,
        totalTimeSeconds: secs,
        correctScoreDisplay: fmtScore(csRaw),
        negativeScoreDisplay: fmtScore(nsRaw),
        defaultCorrectScore: parseFloat(csRaw) || 2,
        defaultNegativeScore: isNaN(parseFloat(nsRaw)) ? 0.5 : parseFloat(nsRaw)
      },
      questions: qs
    };
  }

  /* ---- Saved (bookmarked) questions: kept in this browser only ---- */
  var SAVED_KEY = "sscscholars_saved_v1";
  function readSaved() {
    try { var a = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeSaved(list) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function savedId(year, subject, setId, idx) { return year + "|" + subject + "|" + setId + "|" + idx; }
  function addSaved(entry) {
    var list = readSaved().filter(function (x) { return x.id !== entry.id; });
    list.push(entry);
    return writeSaved(list);
  }
  function removeSaved(id) {
    return writeSaved(readSaved().filter(function (x) { return x.id !== id; }));
  }
  function countSaved() { return readSaved().length; }

  /* ---- Attempt history: every submitted attempt of a test is kept (no limit), reviewable from the hub ---- */
  function attemptsKey(year, subject, setId) { return "sscscholars_hub_attempts_" + year + "_" + subject + "_" + setId; }
  function readAttemptsRaw(key) {
    try { var a = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function getAttempts(year, subject, setId) {
    var key = attemptsKey(year, subject, setId), list = readAttemptsRaw(key);
    /* attempts submitted before this feature existed: pick up the saved result as an attempt */
    try {
      var cur = JSON.parse(localStorage.getItem(storageKey(year, subject, setId)) || "null");
      if (cur && cur.s && cur.s.phase === "submitted" && cur.s.finishedAt) {
        var id = String(cur.s.finishedAt);
        if (!list.some(function (a) { return a.id === id; })) {
          list.push({ id: id, at: cur.s.finishedAt, n: cur.n, s: cur.s });
          try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
        }
      }
    } catch (e) {}
    return list.slice().sort(function (a, b) { return a.at - b.at; });
  }
  function addAttempt(year, subject, setId, n, snapshot) {
    var key = attemptsKey(year, subject, setId), list = readAttemptsRaw(key);
    var at = snapshot.finishedAt || Date.now(), id = String(at);
    list = list.filter(function (a) { return a.id !== id; });
    list.push({ id: id, at: at, n: n, s: snapshot });
    try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function getAttempt(year, subject, setId, attemptId) {
    var list = getAttempts(year, subject, setId);
    for (var i = 0; i < list.length; i++) if (list[i].id === String(attemptId)) return { attempt: list[i], number: i + 1 };
    return null;
  }
  function fmtAttemptDate(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ", " +
      d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }

  window.HubCommon = {
    dataUrl: dataUrl, fetchSubject: fetchSubject, describeError: describeError,
    storageKey: storageKey, readStatus: readStatus, findSet: findSet,
    buildTest: buildTest, getAttempts: getAttempts, addAttempt: addAttempt, getAttempt: getAttempt, fmtAttemptDate: fmtAttemptDate, readSaved: readSaved, addSaved: addSaved, removeSaved: removeSaved, savedId: savedId, countSaved: countSaved, unescapeTags: unescapeTags, decodeText: decodeText, fmtScore: fmtScore, shortSubjectLabel: shortSubjectLabel,
    subjectLabel: subjectLabel, parseKey: parseKey, makeKey: makeKey, examLabel: examLabel, baseLabel: baseLabel, loadSection: loadSection
  };
})();
