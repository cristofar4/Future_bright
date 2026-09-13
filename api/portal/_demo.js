/* A single sample student, used by the demo preview.
 *
 * This never touches the database, so the preview works on a deployment that
 * has no DATABASE_URL yet. It is clearly labelled in the interface: it exists
 * so the school can see the portal before their register is loaded, not to
 * stand in for a real record.
 */

const SUBJECTS = [
  { subject: "Mathematics",      accent: "blue",   icon: "calc",   teacher: "Mr. Okafor",   room: "Room 12", score: 88 },
  { subject: "English Language", accent: "purple", icon: "book",   teacher: "Mrs. Bello",   room: "Room 8",  score: 80 },
  { subject: "Biology",          accent: "green",  icon: "leaf",   teacher: "Mr. Okoro",    room: "Lab 1",   score: 85 },
  { subject: "Computer Studies", accent: "teal",   icon: "laptop", teacher: "Mrs. Ibrahim", room: "ICT 2",   score: 78 },
  { subject: "Physics",          accent: "orange", icon: "atom",   teacher: "Mr. Adeyemi",  room: "Lab 2",   score: 83 },
];

const PERIODS = [
  ["08:00 AM", "09:00 AM", "08:00"],
  ["09:00 AM", "10:00 AM", "09:00"],
  ["10:30 AM", "11:30 AM", "10:30"],
  ["12:00 PM", "01:00 PM", "12:00"],
  ["02:00 PM", "03:00 PM", "14:00"],
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function lessonsFor(weekday) {
  // Rotate the subject order per day so the week does not look copy-pasted.
  return PERIODS.map(([starts_at, ends_at, starts_at_24], i) => {
    const s = SUBJECTS[(i + weekday - 1) % SUBJECTS.length];
    return { starts_at, ends_at, starts_at_24, weekday,
             subject: s.subject, accent: s.accent, icon: s.icon, teacher: s.teacher, room: s.room };
  });
}

const ASSIGNMENTS = [
  { id: 1, title: "Mathematics Homework", brief: "Solve exercises 1 - 10 in the textbook.",                 subject: "Mathematics",      accent: "blue",   due_on: addDays(3),  submitted: true  },
  { id: 2, title: "English Essay",        brief: 'Write a 500-word essay on "The Importance of Education".', subject: "English Language", accent: "purple", due_on: addDays(4),  submitted: false },
  { id: 3, title: "Biology Project",      brief: "Research on cell division and present a report.",          subject: "Biology",          accent: "green",  due_on: addDays(6),  submitted: false },
  { id: 4, title: "ICT Practical",        brief: "Create a simple website using HTML & CSS.",                subject: "Computer Studies", accent: "teal",   due_on: addDays(8),  submitted: false },
  { id: 5, title: "Physics Lab Report",   brief: "Write up the pendulum experiment from last week.",         subject: "Physics",          accent: "orange", due_on: addDays(-2), submitted: true  },
];

const ANNOUNCEMENTS = [
  { id: 1, title: "Inter-house Sports Competition", body: "The annual inter-house sports competition will hold next month. Houses should begin practice with their sports prefects.", published_on: addDays(-4) },
  { id: 2, title: "ICT Lab Upgrade",                body: "The ICT lab has been upgraded with new computers and modern software for coding and CBT practice.", published_on: addDays(-7) },
  { id: 3, title: "School Fees Reminder",           body: "Kindly pay your term fees before the end of the month. Speak to the bursary about instalment plans.", published_on: addDays(-10) },
  { id: 4, title: "Second Term Examinations",       body: "End of term examinations begin in the final two weeks of term. Timetables will be posted on the notice board.", published_on: addDays(-14) },
];

const MESSAGES = [
  { id: 1, sender: "Mr. Okafor",    subject: "Well done on your last test", body: "Your work on quadratic equations has improved a great deal. Keep it up.", sent_at: new Date(Date.now() - 5 * 3600e3).toISOString(),  read: false },
  { id: 2, sender: "Mrs. Bello",    subject: "Essay title confirmed",       body: "Please use the title exactly as given. Hand-written submissions are fine.", sent_at: new Date(Date.now() - 26 * 3600e3).toISOString(), read: false },
  { id: 3, sender: "School Office", subject: "Fees reminder",               body: "Kindly pay your term fees before the end of the month.", sent_at: new Date(Date.now() - 50 * 3600e3).toISOString(), read: false },
  { id: 4, sender: "Mr. Okoro",     subject: "Biology practical groups",    body: "You are in group C for the cell division practical. Bring your lab coat.", sent_at: new Date(Date.now() - 96 * 3600e3).toISOString(), read: true },
];

const ATTENDANCE = { present: 46, absent: 2, late: 1, total: 49, percent: 94 };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

export const DEMO_STUDENT = {
  fullName: "Daniel James",
  firstName: "Daniel",
  admissionNo: "BFS/2024/0178",
  className: "SS2A",
  initials: "DJ",
  email: "daniel.james@example.com",
  phone: "+234 806 222 3344",
  guardianName: "Mrs. James",
  guardianPhone: "+234 806 222 3344",
  joinedOn: "2021-09-13",
};

const TERM = { session: "2024/2025", label: "Second Term", daysLeft: 68 };

/** The same shape every real endpoint returns, so the page needs no special case. */
export function demoPayload(section) {
  const weekday = Math.min(Math.max(new Date().getDay(), 1), 5);
  const base = { demo: true, student: DEMO_STUDENT, term: TERM,
                 unreadMessages: MESSAGES.filter((m) => !m.read).length };

  switch (section) {
    case "dashboard":
      return {
        ...base,
        greeting: greeting(),
        today: lessonsFor(weekday),
        assignments: ASSIGNMENTS.slice(0, 4),
        results: SUBJECTS.map((s) => ({ subject: s.subject, score: s.score })).sort((a, b) => b.score - a.score),
        average: Math.round(SUBJECTS.reduce((n, s) => n + s.score, 0) / SUBJECTS.length),
        attendance: ATTENDANCE,
        announcements: ANNOUNCEMENTS,
        unreadMessages: MESSAGES.filter((m) => !m.read).length,
      };

    case "classes":
      return { ...base, week: DAYS.map((name, i) => ({ weekday: i + 1, name, lessons: lessonsFor(i + 1) })), today: weekday };

    case "assignments":
      return { ...base, assignments: ASSIGNMENTS };

    case "results":
      return {
        ...base,
        results: SUBJECTS.map((s) => ({ subject: s.subject, score: s.score, accent: s.accent })).sort((a, b) => b.score - a.score),
        average: Math.round(SUBJECTS.reduce((n, s) => n + s.score, 0) / SUBJECTS.length),
        best: SUBJECTS.reduce((a, b) => (a.score >= b.score ? a : b)).subject,
      };

    case "attendance": {
      const records = [];
      for (let i = 0, added = 0; added < 20; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (d.getDay() === 0 || d.getDay() === 6) { continue; }
        added++;
        records.push({ on_date: d.toISOString().slice(0, 10), state: added === 5 ? "absent" : added === 11 ? "late" : "present" });
      }
      return { ...base, summary: ATTENDANCE, records };
    }

    case "messages":
      return { ...base, messages: MESSAGES, unread: MESSAGES.filter((m) => !m.read).length };

    case "profile":
      return { ...base, subjects: SUBJECTS.map((s) => s.subject) };

    case "calendar":
      return { ...base, announcements: ANNOUNCEMENTS };

    default:
      return base;
  }
}
