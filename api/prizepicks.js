const UPSTREAM = 'https://partner-api.prizepicks.com/projections?per_page=1000&single_stat=true'

export default async function handler(req, res) {
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: {
        Accept: 'application/json',
        // Identify as a browser to avoid bot-blocking
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `PrizePicks API returned ${upstream.status}` })
      return
    }

    const data = await upstream.json()

    // Cache for 55 s on the CDN edge so rapid page loads don't burn extra requests,
    // but clients always get a fresh fetch on their next 5-min auto-refresh cycle.
    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=300')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
