"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SubjectWeightage } from "@/lib/types";

export default function SubjectWeightageChart() {
  const [subjects, setSubjects] = useState<SubjectWeightage[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subject_weightage")
        .select("*")
        .order("avg_marks", { ascending: false });

      if (data) setSubjects(data as SubjectWeightage[]);
    })();
  }, []);

  const maxMarks = Math.max(...subjects.map((s) => s.avg_marks), 1);

  return (
    <div className="bg-white rounded-2xl border p-5">
      <h3 className="font-semibold mb-4">Subject-Wise Weightage (avg. marks)</h3>
      <div className="space-y-3">
        {subjects.map((s) => (
          <div key={s.id}>
            <div className="flex justify-between text-sm mb-1">
              <span>{s.subject}</span>
              <span className="text-gray-500">{s.avg_marks} marks</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full"
                style={{ width: `${(s.avg_marks / maxMarks) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Edit these numbers directly in the subject_weightage table once you've
        done your own PYQ mark-distribution analysis.
      </p>
    </div>
  );
}