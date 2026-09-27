// Static seed content for the 19-week matrix — the plan itself.
// The interactive checkboxes/notes are stored per-user in Supabase (weekly_progress);
// this file only supplies the read-only "Dates" and default "Focus Areas" text.

export interface WeekPlan {
  weekNumber: number;
  dates: string;
  focusAreas: string;
}

export const WEEKLY_PLAN: WeekPlan[] = [
  { weekNumber: 1, dates: "Sep 27 \u2013 Oct 3", focusAreas: "C Programming (Data Types & Operators, Control Flow, Functions & Storage); COA (Intro, Machine Instructions); Aptitude (Quantitative); Eng. Maths (Probability & Statistics)" },
  { weekNumber: 2, dates: "Oct 4 \u2013 Oct 10", focusAreas: "C Programming (Arrays, Pointers, Strings); Digital Logic (Number System); Verbal Aptitude; Eng. Maths (Single Variable Calculus)" },
  { weekNumber: 3, dates: "Oct 11 \u2013 Oct 17", focusAreas: "Data Structures (Intro, Arrays, Linked List); COA (ALU & Control Unit); Discrete Maths (Mathematical Logic, Set Theory); Analytical Aptitude" },
  { weekNumber: 4, dates: "Oct 18 \u2013 Oct 24", focusAreas: "Algorithms (Analysis, Design Strategies); Discrete Maths (Graph Theory); Eng. Maths (Probability PYQs); C Programming (Structures, Unions, Misc PYQs)" },
  { weekNumber: 5, dates: "Oct 25 \u2013 Oct 31", focusAreas: "Algorithms (Greedy Method, Dynamic Programming); Discrete Maths (Combinatorics); Data Structures (Stack and Queues, Tree)" },
  { weekNumber: 6, dates: "Nov 1 \u2013 Nov 7", focusAreas: "Operating Systems (Intro and Background, Process Management); Eng. Maths (Linear Algebra); Data Structures (Graphs, Hashing)" },
  { weekNumber: 7, dates: "Nov 8 \u2013 Nov 14", focusAreas: "Operating Systems (CPU Scheduling, Process Synchronization); DBMS (ER Model, FD's & Normalization); Verbal Aptitude; Spatial Aptitude" },
  { weekNumber: 8, dates: "Nov 15 \u2013 Nov 21", focusAreas: "DBMS (Transaction & Concurrency Control, Query Language); Operating Systems (Memory Management); Algorithms (Graph Algorithms, Heap Algorithms)" },
  { weekNumber: 9, dates: "Nov 22 \u2013 Nov 28", focusAreas: "TOC (Finite Automata, Push Down Automata); Computer Networks (IPv4 Addressing, Header & Fragmentation, TCP & UDP); Compiler Design (Lexical & Syntax Analysis); COA (Floating Point); OS (Deadlock); DBMS (File Org & Indexing)" },
  { weekNumber: 10, dates: "Nov 29 \u2013 Dec 5", focusAreas: "Digital Logic (Logic Gates, Minimization, Combinational & Sequential Circuits); Compiler Design (SDT, Code Optimization); TOC (Turing Machine); Computer Networks (Error/Flow/MAC, Routing, Switching, Protocols); COA (Pipelining, Cache, I/O); OS (File System, Threads); Algorithms (Backtracking & Branch Bound)" },
  { weekNumber: 11, dates: "Dec 6 \u2013 Dec 12", focusAreas: "Mixed PYQs \u2014 C Programming, COA, Algorithms, Operating Systems, DBMS" },
  { weekNumber: 12, dates: "Dec 13 \u2013 Dec 19", focusAreas: "First PYQ pass complete; formula & short-note consolidation \u2014 Eng. Maths, Discrete Maths, Digital Logic, Computer Networks, Compiler Design, TOC" },
  { weekNumber: 13, dates: "Dec 20 \u2013 Dec 26", focusAreas: "Full-syllabus revision & error repair \u2014 Operating Systems (Deadlock, Memory), DBMS (Transactions, Query Language), Computer Networks (TCP/UDP, Routing)" },
  { weekNumber: 14, dates: "Dec 27 \u2013 Jan 2", focusAreas: "Timed PYQ sets, high-yield rotation \u2014 Algorithms (DP, Graph Algorithms), COA (Instruction Pipelining, Cache), TOC (Finite Automata)" },
  { weekNumber: 15, dates: "Jan 3 \u2013 Jan 9", focusAreas: "Full mocks under exam timing \u2014 Data Structures (Tree, Graphs, Hashing), Discrete Maths (Graph Theory, Combinatorics), Aptitude (Quantitative, Analytical)" },
  { weekNumber: 16, dates: "Jan 10 \u2013 Jan 16", focusAreas: "Mock exams, weak-area repair \u2014 Operating Systems (CPU Scheduling, Synchronization), DBMS (Normalization, ER Model), Computer Networks (IPv4, Header & Fragmentation)" },
  { weekNumber: 17, dates: "Jan 17 \u2013 Jan 23", focusAreas: "High-yield revision \u2014 Algorithms, Operating Systems, DBMS, COA, Discrete Mathematics" },
  { weekNumber: 18, dates: "Jan 24 \u2013 Jan 30", focusAreas: "Timed mocks, error-log review \u2014 C Programming, Data Structures, Digital Logic, Compiler Design" },
  { weekNumber: 19, dates: "Jan 31 \u2013 Feb 6", focusAreas: "Final revision and taper; conclude all scheduled study \u2014 Eng. Maths, Aptitude, and final pass across Algorithms, OS, COA" },
];