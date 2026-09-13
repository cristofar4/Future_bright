/* Input validation. Every endpoint runs its body through here before touching
   the database, so nothing downstream has to guess about types or lengths. */

export const CLASS_LEVELS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];
export const ROLES = ["student", "parent", "teacher"];

export const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;

export function str(value, max = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/** Compare admission/staff numbers ignoring case and spacing. */
export function normaliseRef(value) {
  return str(value, 60).replace(/\s+/g, "").toUpperCase();
}

export function normaliseEmail(value) {
  return str(value, 254).toLowerCase();
}

/** Digits only, so "+234 801 234 5678" and "08012345678" compare sensibly. */
export function normalisePhone(value) {
  const digits = str(value, 40).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;   // last 10 ignores country code
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

/**
 * Password rules: length does more for real-world strength than character
 * classes, so we ask for length and reject the handful of obvious choices.
 */
export function checkPassword(password, { email, fullName } = {}) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`;
  }
  if (password.length > MAX_PASSWORD) {
    return "Password is too long.";
  }
  const lower = password.toLowerCase();
  const banned = ["password", "12345678", "qwerty", "brightfuture", "letmein", "admin123"];
  if (banned.some((b) => lower.includes(b))) {
    return "That password is too easy to guess. Please choose another.";
  }
  if (email && lower.includes(String(email).split("@")[0].toLowerCase()) ) {
    return "Password must not contain your email address.";
  }
  if (fullName) {
    for (const part of String(fullName).toLowerCase().split(/\s+/)) {
      if (part.length >= 4 && lower.includes(part)) {
        return "Password must not contain your name.";
      }
    }
  }
  return null;
}

/** A full name must contain at least two words, so surname matching can work. */
export function checkFullName(fullName) {
  const name = str(fullName, 120);
  if (name.length < 3) return "Please enter your full name.";
  if (name.split(/\s+/).filter(Boolean).length < 2) {
    return "Please enter both your first name and surname.";
  }
  if (!/^[\p{L}\p{M}'\-. ]+$/u.test(name)) {
    return "Please use letters only in your name.";
  }
  return null;
}

/** Does the surname on the register appear in the name they typed? */
export function nameMatchesSurname(fullName, surname) {
  const want = str(surname, 60).toLowerCase().replace(/[^\p{L}]/gu, "");
  if (!want) return false;
  return str(fullName, 120)
    .toLowerCase()
    .split(/\s+/)
    .some((part) => part.replace(/[^\p{L}]/gu, "") === want);
}
