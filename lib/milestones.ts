// Fixed roadmap dates from the study plan. Edit these if GATE 2027's
// official dates differ from your current assumptions.

export interface Milestone {
  label: string;
  date: string; // ISO date
}

export const MILESTONES: Milestone[] = [
  { label: "Syllabus Completion Target", date: "2027-01-31" },
  { label: "Final Revision Ends", date: "2027-02-06" },
  { label: "Exam Window Opens", date: "2027-02-06" },
];

export const ROADMAP_PHASES = [
  {
    phase: "Kickoff Phase",
    weeks: "Week 1 / Sep 27 \u2013 Oct 3, 2026",
    description:
      "Set up routine; initiate core threads across C Programming (Data Types and Operators, Control Flow, Functions & Storage), COA (Introduction, Machine Instruction & Addressing Modes), Quantitative Aptitude, and Engineering Mathematics (Probability & Statistics).",
  },
  {
    phase: "Foundations Phase",
    weeks: "Weeks 2\u20136 / Oct 4 \u2013 Nov 7, 2026",
    description:
      "Deep baseline coverage across C Programming, Data Structures, COA (ALU & Control Unit), Algorithms (Analysis, Design Strategies, Greedy, DP), Digital Logic (Number System), Discrete Mathematics, Engineering Mathematics, and Aptitude.",
  },
  {
    phase: "Core Subjects Phase",
    weeks: "Weeks 7\u201312 / Nov 8 \u2013 Dec 19, 2026",
    description:
      "Complete syllabus delivery for Operating Systems, DBMS, TOC, Computer Networks, Compiler Design, Digital Logic (Circuits), and mixed PYQs.",
  },
  {
    phase: "Practice and Revision Phase",
    weeks: "Weeks 13\u201316 / Dec 20, 2026 \u2013 Jan 16, 2027",
    description:
      "Execute full-syllabus PYQ cycles, mock examinations, and structured weak-area repair, converting recurring mistakes into short notes.",
  },
  {
    phase: "Final Revision Phase",
    weeks: "Weeks 17\u201319 / Jan 17 \u2013 Feb 6, 2027",
    description:
      "High-yield review, timed testing, final error-log analysis, and conclude all preparation and tapering.",
  },
  {
    phase: "Exam Window",
    weeks: "From Feb 6, 2027",
    description: "Final exam execution window.",
  },
];