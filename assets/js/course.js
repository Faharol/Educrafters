/* Course data: SMB31202 Scheme of Work, Semester 1, Session 2026/2027 */
window.COURSE = {
  code: "SMB31202",
  name: "English for Technical Communication",
  semester: "Semester 1 · Session 2026/2027",
  assessments: [
    { pct: 30, name: "Reading Test", when: "Week 8 · 23–29 Nov 2026", start: "2026-11-23", detail: "Individual · face-to-face · 1 h 30 min. Section A reading comprehension (20) + Section B theory from Weeks 1–2 (10).", color: "cyan" },
    { pct: 20, name: "Poster Assignment", when: "Brief Wk 5 · Due Wk 12", start: "2026-12-28", detail: "Group · SDG-related topic · online submission. Supervision 1 in Week 6, Supervision 2 in Week 10.", color: "violet" },
    { pct: 20, name: "Writing Test", when: "Week 10 · 14–20 Dec 2026", start: "2026-12-14", detail: "Individual · face-to-face · 45 min. Report from visual data: Introduction → Findings → Recommendations, 220–260 words.", color: "pink" },
    { pct: 30, name: "Speaking Assessment", when: "Weeks 13–14 · 4–17 Jan 2027", start: "2027-01-04", detail: "Face-to-face. Task 1 individual presentation 2–3 min (10%) + Task 2 group discussion 12 min (20%).", color: "lime" }
  ],
  // mode: on = online, f2f = face-to-face, test = assessment, off = break
  weeks: [
    { n: 1, start: "2026-10-05", end: "2026-10-11", mode: "on", title: "Basics of Technical Communication", topics: ["Course overview & assessment", "Definition, dimensions & barriers of communication", "Characteristics & significance of technical communication"] },
    { n: 2, start: "2026-10-12", end: "2026-10-18", mode: "on", title: "Preparing for the Workplace", topics: ["Cover letter", "Résumé", "Job interview"] },
    { n: 3, start: "2026-10-19", end: "2026-10-25", mode: "f2f", title: "Research Skills & Paraphrasing", topics: ["Primary vs secondary research", "Judging source credibility", "Reading abstracts & conclusions", "Paraphrasing techniques"] },
    { n: 4, start: "2026-10-26", end: "2026-11-01", mode: "on", title: "Reading Skills for Technical Communication", topics: ["Text organisation & discourse structure", "Cohesive devices & discourse markers", "Making inferences", "Vocabulary in context"] },
    { n: 5, start: "2026-11-02", end: "2026-11-08", mode: "f2f", title: "Writing for Technical Communication", topics: ["Report structure", "Interpreting charts, tables & graphs", "Register, hedging & parallel structure"], flag: "Poster brief" },
    { n: 6, start: "2026-11-09", end: "2026-11-15", mode: "f2f", title: "Drawing Conclusions & Referencing", topics: ["Conclusions from evidence", "Writing recommendations", "APA / IEEE citation & reference lists"], flag: "Supervision 1" },
    { n: 7, start: "2026-11-16", end: "2026-11-22", mode: "on", title: "Graphics & Visuals in Technical Communication", topics: ["Reading visual data", "Types & functions of visuals", "Honest & accessible visuals", "Visuals on your poster"] },
    { n: 8, start: "2026-11-23", end: "2026-11-29", mode: "test", title: "Reading Test", topics: ["Section A: Reading comprehension (20 marks)", "Section B: Theory, Weeks 1–2 (10 marks)"], flag: "Test 30%" },
    { n: "Break", start: "2026-11-30", end: "2026-12-06", mode: "off", title: "Mid-semester break", topics: ["Rest, then work on your poster"] },
    { n: 9, start: "2026-12-07", end: "2026-12-13", mode: "on", title: "Language Skills for Technical Writing", topics: ["Paraphrasing, synthesis & referencing", "Visual data → report", "Writing Test preparation"] },
    { n: 10, start: "2026-12-14", end: "2026-12-20", mode: "test", title: "Writing Test & Poster Supervision 2", topics: ["Report from visual data, 45 min", "220–260 words", "Poster outline & draft check"], flag: "Test 20%" },
    { n: 11, start: "2026-12-21", end: "2026-12-27", mode: "on", title: "Group Communication", topics: ["Leading a discussion & turn taking", "Agreeing & disagreeing", "Reaching a decision", "Speaking assessment briefing"] },
    { n: 12, start: "2026-12-28", end: "2027-01-03", mode: "f2f", title: "Speaking Practice & Final Consultation", topics: ["Mock individual presentation", "Mock group discussion", "Final poster consultation"], flag: "Poster due" },
    { n: 13, start: "2027-01-04", end: "2027-01-10", mode: "test", title: "Speaking Assessment · Part 1", topics: ["Groups A", "Task 1 presentation + Task 2 discussion"], flag: "Speaking 30%" },
    { n: 14, start: "2027-01-11", end: "2027-01-17", mode: "test", title: "Speaking Assessment · Part 2", topics: ["Groups B", "Same format and rubric as Week 13"], flag: "Speaking 30%" }
  ],
  team: {
    coordinator: "Jasin bin Abd Halim",
    lecturers: ["Dr. Faharol bin Zubir", "Noor Farahhein binti Johari", "PM Dr. Ina Suryani binti Ab Rahim", "Dr. Rozilawati binti Mahadi", "Dr. Wan Safuraa binti Wan Osman", "Shafiq Hizwari bin Md. Hashim"]
  }
};
