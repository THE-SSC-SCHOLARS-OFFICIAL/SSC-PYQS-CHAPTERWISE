/* ===== Mock Hub settings ===== */
window.HUB_CONFIG = {
  brand: "THE SSC SCHOLARS OFFICIAL",

  /* Folder that holds the JSON files, named <year>_<subject>.json
     for example data/2025_Maths.json, data/2026_GS.json */
  dataDir: "data",

  /* Change this number (1 -> 2 -> 3) whenever the JSON files are updated,
     so browsers do not keep serving an old cached copy. */
  dataVersion: "1",

  /* Years offered in the Year toggle */
  years: ["2025", "2026"],

  /* key   = part of the file name (2025_<key>.json)
     label = name shown in the Subject dropdown */
  subjects: [
    { key: "Maths",     label: "Maths" },
    { key: "English",   label: "English" },
    { key: "GS",        label: "General Awareness (GS)" },
    { key: "Reasoning", label: "Reasoning" }
  ]
};
