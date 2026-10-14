/* ETC Lab: per-week hook, wall prompt and mission copy.
   Written for engineering undergraduates (19 to 22). Second person, short lines, no invented statistics.
   Course facts (marks, timings) come from the Scheme of Work. */
window.HOOKS = {
  1: {
    head: "Your manager replied: noted.",
    scene: "You sent your supervisor a 400-word WhatsApp about a problem in the lab. Three days later, one word came back. Nothing changed.",
    why: "Purpose, audience, channel, barriers. Week 1 gives you the words for why that message died, and the Reading Test asks about them in Week 8.",
    ask: "Think of one message you sent this month that got the wrong response. What went wrong: the words, the channel, or the reader?",
    wall: "One message you sent recently that got the wrong response. What went wrong?",
    boss: "Barriers, types and the CMAPP model. This is Section B material.",
    words: 2
  },
  2: {
    head: "Your résumé gets a few seconds.",
    scene: "A recruiter opens your internship application between two meetings. Your résumé has to say the right thing before the next tab opens.",
    why: "Cover letters, résumés and interviews are Week 2, and they are examined in Section B of the Reading Test.",
    ask: "What is the one line on your résumé that you would want a recruiter to read first?",
    wall: "Your one line: the thing a recruiter should know about you first.",
    boss: "Claims versus evidence, tailoring a résumé, interview moves.",
    words: 2
  },
  3: {
    head: "Changing a few words is still copying.",
    scene: "Your poster group pastes three sentences from a Scopus article, swaps some synonyms, and submits. Turnitin lights up.",
    why: "Credible sources, abstracts, and real paraphrasing. Your poster needs three sources and two of them from Scopus or Web of Science.",
    ask: "Take one sentence from any article you have read this semester. Say the same thing in a completely new shape.",
    wall: "Paraphrase this in one line: \"Data centres now use as much water as a small town.\"",
    boss: "Primary versus secondary research, source credibility, paraphrasing moves.",
    words: 3
  },
  4: {
    head: "The datasheet is long. You need one number.",
    scene: "It is late. The component datasheet runs for dozens of pages and your circuit needs one value. You do not read it all. You hunt.",
    why: "Text organisation, discourse markers, inference and vocabulary in context: the exact skills Section A of the Reading Test checks.",
    ask: "How do you read a long technical document when you only need one thing? What do you look at first?",
    wall: "The first thing you look at when you open a long technical document.",
    boss: "Cohesion, discourse markers and inference.",
    words: 3
  },
  5: {
    head: "The chart is clear. Your paragraph is not.",
    scene: "Your manager sends a chart of monthly energy use and says: one page, by Friday, with a recommendation. You open a blank document.",
    why: "Report structure, interpreting visual data, register. This is the shape of the Writing Test in Week 10, worth 20%.",
    ask: "Look at any chart on your phone (fitness, data use, grades). Describe the main trend in one sentence a manager would accept.",
    wall: "Describe one trend from any chart you have on your phone, in one manager-ready sentence.",
    boss: "Introduction, findings, recommendation, and the language of trends.",
    words: 3
  },
  6: {
    head: "\"I think\" is not a conclusion.",
    scene: "The data points one way. The boss prefers the other. Your group writes a recommendation for the boss. The report is now fiction.",
    why: "Conclusions from evidence, recommendations that follow, and APA or IEEE referencing. Your poster and your report both get marked on this.",
    ask: "When did you last change your conclusion because of who was reading it? Was that honest?",
    wall: "One conclusion you are sure of, and the evidence that earns it. Two sentences.",
    boss: "Evidence to conclusion to recommendation, and citation formats.",
    words: 3
  },
  7: {
    head: "A 3D pie chart is a crime scene.",
    scene: "The presenter has a bar chart with the axis starting at 97. The difference looks huge. It is not. Nobody in the room notices.",
    why: "Reading visual data, choosing honest visuals, and making the chart for your poster. Week 7 is online, so this is self-study with checks.",
    ask: "Where have you seen a chart that lied to you? Describe the trick.",
    wall: "A chart that lied to you. What was the trick?",
    boss: "Types of visuals, honest axes, accessibility.",
    words: 2
  },
  8: {
    head: "One hour thirty. One passage. Thirty marks.",
    scene: "Face-to-face, on paper. Section A is a 600-word engineering passage. Section B is the theory from Weeks 1 and 2.",
    why: "This is the Reading Test, 30% of your grade. The week is a briefing and a warm-up, not new content.",
    ask: "What is your plan for the first five minutes of the paper?",
    wall: "Your plan for the first five minutes of the Reading Test.",
    boss: "A last run through Weeks 1 to 4.",
    words: 3
  },
  9: {
    head: "Same data. Two sentences. One gets the marks.",
    scene: "\"Sales went up a lot in March.\" \"Sales rose by 18% in March, the sharpest increase of the quarter.\" Same chart. Only one sounds like a report.",
    why: "Paraphrasing, synthesis and the language of visual data, aimed straight at the Writing Test next week.",
    ask: "Rewrite one lazy sentence from your own notes so it sounds like a report.",
    wall: "Rewrite one lazy sentence from your notes so a manager would accept it.",
    boss: "Trend verbs, hedging, parallel structure, citations.",
    words: 2
  },
  10: {
    head: "Forty-five minutes. One chart. One manager.",
    scene: "The Writing Test: a workplace scenario, a chart and a table, 220 to 260 words, on paper. Introduction, findings, a justified recommendation.",
    why: "This is 20% of your grade. The same week is Poster Supervision 2, so bring your outline and draft.",
    ask: "Which of the four marking criteria scares you most, and what will you do about it this week?",
    wall: "The marking criterion you are most worried about, and your fix.",
    boss: "A timed run through report language.",
    words: 2
  },
  11: {
    head: "The loudest person is not the leader.",
    scene: "Four engineers, twelve minutes, one decision to make. Two people talk, one nods, one checks the time. The meeting ends with no recommendation.",
    why: "Leading a discussion, turn-taking, agreeing and disagreeing, reaching a decision. This is Task 2 of the Speaking Assessment, 20%.",
    ask: "What phrase do you use to disagree with a friend without starting a fight?",
    wall: "Your best phrase for disagreeing politely.",
    boss: "Discussion moves: lead, agree, disagree, decide.",
    words: 2
  },
  12: {
    head: "Two minutes to prepare. Then you stand up.",
    scene: "You get a scenario, an audience and an option you did not choose. Two minutes later you present it for three minutes, with evidence.",
    why: "Mock presentation and mock discussion, with feedback. Your poster is due at the end of this week.",
    ask: "What do you do with your hands when you present? Honestly.",
    wall: "The hardest part of presenting for you, in one line.",
    boss: "Structure of a proposal, signposting, handling questions.",
    words: 2
  },
  13: {
    head: "This is the real one.",
    scene: "Groups A present and discuss this week. Task 1 is your individual proposal, 2 to 3 minutes. Task 2 is the group discussion, 12 minutes.",
    why: "Speaking Assessment, 30%. Marked on accuracy, range and register, fluency, and how well you interact.",
    ask: "What is the one phrase you will use to bring a quiet person into the discussion?",
    wall: "One line you will use to bring a quiet teammate into the discussion.",
    boss: "A final sweep of the discussion phrases.",
    words: 2
  },
  14: {
    head: "Last week. Groups B.",
    scene: "Same format, same rubric as Week 13. Then the semester is done.",
    why: "Speaking Assessment, 30%. Everything from Week 11 onward comes together here.",
    ask: "What is one thing you can do in English now that you could not do in October?",
    wall: "One thing you can do in English now that you could not do in October.",
    boss: "The whole semester in ten questions.",
    words: 2
  }
};
/* Short lines for the home page marquees: real report and discussion language from the course */
window.PHRASES = {
  report: ["Sales rose sharply in March.", "The figures suggest that…", "In contrast, Line 2 fell.", "It is recommended that…", "This accounts for 40% of the total.", "Over the period, demand doubled.", "The data indicates a clear trend.", "To sum up, the evidence shows…"],
  talk: ["Could I come in here?", "That's a fair point, but…", "Shall we decide?", "I see it differently.", "Let's hear from Aiman.", "So we agree on option B?", "Can I add to that?", "What do you think?"]
};
