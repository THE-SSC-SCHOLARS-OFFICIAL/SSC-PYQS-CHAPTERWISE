DATA FOLDER
===========

1) CHAPTER-WISE PYQ  (8 files, naam bilkul aisa):

    2025_Maths.json      2025_English.json      2025_GS.json      2025_Reasoning.json
    2026_Maths.json      2026_English.json      2026_GS.json      2026_Reasoning.json

2) EXAM-WISE PYQ  (extractor ki raw file jaisi hai waisi hi rakho):

    exam-ssc-sub.json
    -> abhi isme sirf 2026 hai (Selection Post + Steno).
    -> 2025 aane par:  option A) nayi extract file isi naam se replace kar do (agar usme 2025+2026 dono hain)
                       option B) 2025 ki alag file daalo (jaise exam-ssc-sub-2025.json) aur
                                 assets/config.js me  sections.exam.files  list me uska naam add kar do.
    -> Year / Exam / Subject file ke andar se apne aap detect hote hain. Naya exam (CGL, CHSL ...) aaye to
       dropdown me khud aa jayega (naam badalna ho to config.js ke examLabels me likho).

3) TOP QUESTIONS  (extractor ki raw file):

    ssc-sub-top.json
    -> abhi isme tests khaali hain (server ne "content_not_ready" diya), isliye hub me chapters "Coming soon" dikhte hain.
    -> Jab content ready ho, extractor dobara chalao aur isi naam se file replace kar do. 2025 + 2026 dono ek hi file me ho sakte hain.

Har baar data file badalne par assets/config.js me  dataVersion  ka number badha do (1 -> 2 -> 3),
warna browser purani cached file dikha sakta hai.

Agar extractor me DOWNLOAD_IMAGES = True kiya tha to uska "images" folder bhi yahin
(data/images/...) copy karna.
