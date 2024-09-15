import { google, calendar_v3 } from "googleapis";
import "dotenv/config";
let instance: calendar_v3.Calendar | null;
class Calendar {
  constructor() {
    if (instance) {
      return instance;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/gm, "\n"),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: "https://www.googleapis.com/auth/calendar",
    });
    const d = google.calendar({
      version: "v3",
      auth: auth,
    });
    instance = d;
    return instance;
  }
}
export const calendar = new Calendar() as calendar_v3.Calendar;
