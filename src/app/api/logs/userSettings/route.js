import { getUserSettingsAuditRows } from "@/_helpers/userSettingsAudit";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req, res) {
  const ROLE = req.headers.get("userRole");
  let forUser = req.headers.get("forUser");

  if (forUser === "undefined" || !forUser) {
    forUser = req.headers.get("userID");
  } else if (ROLE !== "admin") {
    return Response.json({ message: "Unauthorized" }, { status: 403 });
  }

  const weeksInPast = req.headers.get("week") - 1;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeksInPast * 7) - 7);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - (weeksInPast * 7) + 1);

  try {
    const rows = await getUserSettingsAuditRows({
      userId: forUser,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });

    return Response.json({ logs: rows });
  } catch (error) {
    console.log(error);
    return Response.json({ error: "Failed to fetch settings history" }, { status: 500 });
  }
}

