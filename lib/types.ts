export interface UserProfile {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface WeeklyProgress {
  id: string;
  user_id: string;
  week_number: number;
  focus_notes: string | null;
  completed: boolean;
  class_notes: boolean;
  dpp_questions: boolean;
  pyqs: boolean;
  mock_test: boolean;
  error_log: boolean;
  short_notes: boolean;
  updated_at: string;
}

export interface ErrorLogEntry {
  id: string;
  user_id: string;
  log_date: string;
  subject: string;
  topic: string | null;
  question: string | null;
  reason: string | null;
  created_at: string;
}

export interface StudyLink {
  id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: string;
}

export interface FormulaNote {
  id: string;
  user_id: string;
  subject: string;
  title: string;
  tags: string[];
  drive_link: string | null;
  content: string | null;
  created_at: string;
}

export interface MockTest {
  id: string;
  user_id: string;
  test_date: string;
  subject: string | null;
  score: number;
  max_score: number;
  created_at: string;
}

export interface SubjectWeightage {
  id: string;
  subject: string;
  avg_marks: number;
  notes: string | null;
}