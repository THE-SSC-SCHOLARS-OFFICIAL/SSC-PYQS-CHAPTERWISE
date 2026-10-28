/* ===== Mock Hub settings ===== */
window.HUB_CONFIG = {
  brand: "THE SSC SCHOLARS OFFICIAL",

  /* Folder that holds the JSON files */
  dataDir: "data",

  /* Change this number (1 -> 2 -> 3) whenever the JSON files are updated,
     so browsers do not keep serving an old cached copy. */
  dataVersion: "1",

  /* All years known to the site (used by the Saved page) */
  years: ["2025", "2026"],

  /* Base subjects.  key   = part of the file name (2025_<key>.json) for Chapter-wise
                     label = name shown in the Subject dropdown */
  subjects: [
    { key: "Maths",     label: "Maths" },
    { key: "English",   label: "English" },
    { key: "GS",        label: "General Awareness (GS)" },
    { key: "Reasoning", label: "Reasoning" }
  ],

  /* ---- The three sections of the hub (shown as cards on index.html) ---- */
  sectionOrder: ["chapter", "exam", "top"],
  sections: {

    /* 1. Chapter-wise PYQ  ->  data/<year>_<Subject>.json  (8 files, same as before) */
    chapter: {
      label: "Chapter-wise PYQ",
      years: ["2025", "2026"]
    },

    /* 2. Exam-wise PYQ  ->  raw extractor file(s). Each file may hold any year(s);
          the year is read from inside the file.
          When you get 2025 data: put it in the SAME file, or add another file name here. */
    exam: {
      label: "Exam-wise PYQ",
      badge: "NEW",
      years: ["2025", "2026"],
      files: ["exam-ssc-sub.json"],
      /* exam code found in the test id  ->  name shown in the dropdown */
      examLabels: {
        "SELECTION-POST": "SSC Selection Post",
        "STENO": "SSC Steno",
        "CGL": "SSC CGL",
        "CHSL": "SSC CHSL",
        "CPO": "SSC CPO",
        "MTS": "SSC MTS",
        "GD": "SSC GD",
        "JE": "SSC JE"
      }
    },

    /* 3. Top Questions  ->  raw extractor file (both years in one file) */
    top: {
      label: "Top Questions",
      badge: "NEW",
      years: ["2025", "2026"],
      files: ["ssc-sub-top.json"]
    }
  }
};
