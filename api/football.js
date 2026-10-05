export default async function handler(req, res) {
  try {
    const key = process.env.FOOTBALL;

    if (!key) {
      return res.status(500).json({
        ok: false,
        error: "FOOTBALL environment variable missing"
      });
    }

    const endpoint = req.query.endpoint;

    const allowed = [
      "fixtures",
      "odds",
      "fixtures/lineups",
      "injuries",
      "predictions",
      "teams",
      "players",
      "standings"
    ];

    if (!allowed.includes(endpoint)) {
      return res.status(400).json({
        ok: false,
        error: "Unsupported endpoint"
      });
    }

    const params = new URLSearchParams();

    for (const [keyName, value] of Object.entries(req.query)) {
      if (keyName === "endpoint") continue;

      if (Array.isArray(value)) {
        value.forEach(v => params.append(keyName, v));
      } else if (value !== undefined) {
        params.set(keyName, value);
      }
    }

    const url =
      `https://v3.football.api-sports.io/${endpoint}` +
      (params.toString() ? `?${params}` : "");

    const response = await fetch(url, {
      headers: {
        "x-apisports-key": key
      }
    });

    const data = await response.json();

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=1800, stale-while-revalidate=300"
    );

    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: String(error)
    });
  }
}