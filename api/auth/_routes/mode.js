/* GET /api/auth/mode
 *
 * Lets the sign-up page tell the visitor what to expect: whether a database is
 * attached at all, and whether their details must match the school register.
 * Deliberately returns nothing about who is on that register.
 */
import { json, methodNotAllowed } from "../../_lib/http.js";
import { isOpenSignup } from "../_mode.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  try {
    const open = await isOpenSignup();
    return json(res, 200, { configured: true, openSignup: open });
  } catch (err) {
    if (err.code === "NO_DATABASE") {
      return json(res, 200, { configured: false, openSignup: false });
    }
    console.error("[mode]", err);
    return json(res, 200, { configured: false, openSignup: false, error: true });
  }
}
