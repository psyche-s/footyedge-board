export default async function handler(req, res) {
  const key = process.env.FOOTBALL;

  if (!key) {
    return res.status(500).json({
      ok: false,
      reason: "FOOTBALL environment variable missing"
    });
  }

  const response = await fetch("https://v3.football.api-sports.io/status", {
    headers: {
      "x-apisports-key": key
    }
  });

  const data = await response.json();

  return res.status(response.status).json({
    ok: response.ok,
    status: response.status,
    errors: data.errors || null,
    response: data.response || null
  });
}