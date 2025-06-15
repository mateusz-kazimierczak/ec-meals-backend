import { BigQuery } from "@google-cloud/bigquery";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const bqClient = new BigQuery(
    {
      projectID: "ec-meals-462913",
      credentials: JSON.parse(process.env.GCP_AUTH || "{}"),

    }
  )

export async function GET(req, res) {
  const user_id = req.headers.get("userId");
  const weeksInPast = req.headers.get("week") - 1

  // Get dates between for each weeksInPast option (1 to 4)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeksInPast * 7) - 7);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - (weeksInPast * 7) + 1);

  const query = `
    SELECT *
    FROM \`ec-meals-462913.meal_history.HISTORY\`
    WHERE USER_ID = @user_id
    AND CHANGE_TIME BETWEEN @start_date AND @end_date
  `;
  
  const options = {
    query: query,
    params: {
      user_id: user_id,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    },
    location: 'US',
  };

  try {
    const [rows] = await bqClient.query(options);
    return Response.json({ logs: rows });
  } catch (error) {
    console.error("BigQuery query error:", JSON.stringify(error, null, 2));
    return Response.json({ error: "Failed to fetch logs" }, { status: 500 });
  }

}
