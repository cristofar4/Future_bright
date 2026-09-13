/* Whether sign-up currently requires a match in the school register.
 *
 *   PORTAL_OPEN_SIGNUP=true   anyone may sign up (evaluation only)
 *   PORTAL_OPEN_SIGNUP=false  always require a register match
 *   unset                     open until a register has been imported
 *
 * The default matters: a fresh deployment has nobody on the register, so the
 * owner can create an account and look around. The moment a real register is
 * imported the check turns itself on, which is the state a live school wants.
 */
import { query } from "../_lib/db.js";

export async function isOpenSignup() {
  const flag = String(process.env.PORTAL_OPEN_SIGNUP || "").toLowerCase();
  if (flag === "true" || flag === "1")  return true;
  if (flag === "false" || flag === "0") return false;

  // Only imported rows count. Rows an open sign-up created must not close it,
  // or the first person through the door locks it behind them.
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM register       WHERE status = 'active' AND source = 'import'
       UNION ALL
       SELECT 1 FROM staff_register WHERE status = 'active' AND source = 'import'
     ) AS has_register`
  );
  return !rows[0].has_register;
}
