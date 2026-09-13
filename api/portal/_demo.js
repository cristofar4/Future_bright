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

/* A made-up roll and staff list for the previews. Invented people: nobody here
   is a real pupil or a real member of staff. */
function rollRow(i, admission, other, surname, klass, guardian, accounts) {
  const fullName = other + " " + surname;
  return {
    id: String(i), admissionNo: admission, fullName, surname, otherNames: other,
    initials: (other[0] + surname[0]).toUpperCase(),
    className: klass, classLevel: klass.replace(/[A-Z]$/, ""),
    status: "active", source: "import",
    guardianEmail: guardian, guardianPhone: "+234 80" + (i % 9) + " " + (100 + i) + " " + (2000 + i * 7),
    joinedOn: new Date(Date.now() - (300 + i * 40) * 86400e3).toISOString(),
    accounts,
  };
}

const DEMO_ROLL = [
  rollRow(1, "BFS/2024/0178", "Daniel",  "James",   "SS2A", "mrs.james@example.com", 2),
  rollRow(2, "BFS/2025/0142", "Chidera", "Okafor",  "SS2A", "amaka.okafor@example.com", 1),
  rollRow(3, "BFS/2025/0187", "Ibrahim", "Bello",   "JSS2A", "amina.bello@example.com", 1),
  rollRow(4, "BFS/2024/0091", "Tunde",   "Adeyemi", "SS3A", null, 0),
  rollRow(5, "BFS/2025/0203", "Ngozi",   "Eze",     "JSS1A", "ngozi.family@example.com", 1),
  rollRow(6, "BFS/2024/0155", "Aisha",   "Musa",    "SS1A", "musa.home@example.com", 2),
  rollRow(7, "BFS/2025/0166", "Emeka",   "Nwosu",   "JSS3A", null, 0),
  rollRow(8, "BFS/2024/0119", "Blessing","Oyelaran","SS3A", "oyelaran@example.com", 1),
];

function staffRow(i, no, other, surname, email, periods, subjects, accounts) {
  const fullName = other + " " + surname;
  return {
    id: String(i), staffNo: no, fullName, surname, otherNames: other,
    initials: (other[0] + surname[0]).toUpperCase(),
    email, status: "active", source: "import",
    joinedOn: new Date(Date.now() - (500 + i * 90) * 86400e3).toISOString(),
    accounts, periods, subjects,
  };
}

const DEMO_STAFF = [
  staffRow(1, "BFS/STF/014", "Folake", "Ogun",    "f.ogun@brightfuture.edu.ng",    0,  null, 1),
  staffRow(2, "BFS/STF/022", "Samuel", "Ibrahim", "s.ibrahim@brightfuture.edu.ng", 30, "Computer Studies", 1),
  staffRow(3, "BFS/STF/007", "Emeka",  "Okafor",  "e.okafor@brightfuture.edu.ng",  30, "Mathematics", 1),
  staffRow(4, "BFS/STF/011", "Ronke",  "Bello",   "r.bello@brightfuture.edu.ng",   30, "English Language", 1),
  staffRow(5, "BFS/STF/019", "Chuka",  "Okoro",   null,                            30, "Biology", 0),
  staffRow(6, "BFS/STF/026", "Tayo",   "Adeyemi", "t.adeyemi@brightfuture.edu.ng", 30, "Physics", 1),
];

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

    case "parent":
      return {
        ...base,
        parent: { fullName: "Mrs. Ada James", firstName: "Ada", initials: "AJ",
                  email: "mrs.james@example.com", phone: "+234 806 222 3344" },
        child: DEMO_STUDENT,
        today: lessonsFor(weekday),
        results: SUBJECTS.map((s) => ({ subject: s.subject, score: s.score })).sort((a, b) => b.score - a.score),
        average: Math.round(SUBJECTS.reduce((n, s) => n + s.score, 0) / SUBJECTS.length),
        attendance: ATTENDANCE,
        assignments: ASSIGNMENTS.slice(0, 4),
        announcements: ANNOUNCEMENTS,
        outstanding: ASSIGNMENTS.slice(0, 4).filter((a) => !a.submitted).length,
      };

    case "teacher": {
      const mine = lessonsFor(weekday).slice(0, 4).map((l, i) => ({
        ...l, teacher: "Mr. Okafor", class_name: ["SS2A", "SS1A", "JSS3A", "SS3A"][i],
      }));
      const classes = [
        { class_name: "SS2A", class_level: "SS2", class_arm: "A", pupils: 24, subjects: "Mathematics" },
        { class_name: "SS1A", class_level: "SS1", class_arm: "A", pupils: 26, subjects: "Mathematics" },
        { class_name: "JSS3A", class_level: "JSS3", class_arm: "A", pupils: 22, subjects: "Mathematics" },
        { class_name: "SS3A", class_level: "SS3", class_arm: "A", pupils: 19, subjects: "Further Mathematics" },
      ];
      return {
        ...base,
        teacher: { fullName: "Mr. Emeka Okafor", firstName: "Emeka", initials: "EO",
                   staffNo: "BFS/STF/014", email: "e.okafor@brightfuture.edu.ng" },
        today: mine,
        classes,
        announcements: ANNOUNCEMENTS,
        totals: { lessonsPerWeek: 20, classes: classes.length,
                  pupils: classes.reduce((n, c) => n + c.pupils, 0), subjects: 2 },
      };
    }

    case "admin":
      return {
        ...base,
        admin: { isAdmin: true, fullName: "Dr. Emeka Anyanwu", firstName: "Emeka", initials: "EA",
                 email: "principal@brightfuture.edu.ng", role: "teacher" },
        totals: { pupils: 512, left_pupils: 38, staff: 54, accounts: 431,
                  student_accounts: 318, parent_accounts: 96, teacher_accounts: 17,
                  lessons: 210, assignments: 46, announcements: 12, active_sessions: 27 },
        byClass: [
          { class_name: "JSS1A", pupils: 28 }, { class_name: "JSS2A", pupils: 26 },
          { class_name: "JSS3A", pupils: 22 }, { class_name: "SS1A", pupils: 26 },
          { class_name: "SS2A", pupils: 24 }, { class_name: "SS3A", pupils: 19 },
        ],
        recentAccounts: [
          { full_name: "Chidera Okafor", role: "student", email: "chidera@example.com", created_at: new Date(Date.now() - 2 * 3600e3).toISOString(), is_admin: false },
          { full_name: "Mrs. Amina Bello", role: "parent", email: "amina@example.com", created_at: new Date(Date.now() - 20 * 3600e3).toISOString(), is_admin: false },
          { full_name: "Mrs. Folake Ogun", role: "teacher", email: "f.ogun@brightfuture.edu.ng", created_at: new Date(Date.now() - 46 * 3600e3).toISOString(), is_admin: false },
          { full_name: "Dr. Emeka Anyanwu", role: "teacher", email: "principal@brightfuture.edu.ng", created_at: new Date(Date.now() - 400 * 3600e3).toISOString(), is_admin: true },
        ],
        announcements: ANNOUNCEMENTS.map((a) => ({ ...a, audience: "all" })),
        register: { sources: [{ source: "import", n: 512 }], imported: 512, openSignup: false, override: null },
      };

    case "pupils": {
      const ADMIN = { isAdmin: true, fullName: "Dr. Emeka Anyanwu", firstName: "Emeka",
                      initials: "EA", email: "principal@brightfuture.edu.ng", role: "teacher" };
      return {
        ...base,
        admin: ADMIN,
        pupils: DEMO_ROLL,
        classes: [
          { class_name: "JSS1A", pupils: 28 }, { class_name: "JSS2A", pupils: 26 },
          { class_name: "JSS3A", pupils: 22 }, { class_name: "SS1A", pupils: 26 },
          { class_name: "SS2A", pupils: 24 }, { class_name: "SS3A", pupils: 19 },
        ],
        totals: { active: 145, left_school: 38, all_rows: 183, accounts: 414 },
        page: 1, pages: 6, perPage: 25, total: 145,
        filters: { q: "", class: "", status: "active" },
      };
    }

    case "staff": {
      const ADMIN = { isAdmin: true, fullName: "Dr. Emeka Anyanwu", firstName: "Emeka",
                      initials: "EA", email: "principal@brightfuture.edu.ng", role: "teacher" };
      return {
        ...base,
        admin: ADMIN,
        staff: DEMO_STAFF,
        totals: { active: 54, left_school: 3, all_rows: 57, accounts: 17, admins: 1 },
        page: 1, pages: 3, perPage: 25, total: 54,
        filters: { q: "", status: "active" },
      };
    }

    default:
      return base;
  }
}
