const UPSTREAM = 'https://partner-api.prizepicks.com/projections?per_page=1000&single_stat=true'
const TTL_MS   = 5 * 60 * 1000 // 5 minutes — matches the browser's auto-refresh interval

// Module-level cache persists across invocations of the same warm function instance.
// Each Vercel instance independently holds its own copy; cold starts begin with an
// empty cache and make exactly one upstream request before serving from memory.
let cache = { data: null, fetchedAt: 0 }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const now = Date.now()
  const age = now - cache.fetchedAt

  // ── Layer 1: in-process cache hit ─────────────────────────────────────────
  if (cache.data && age < TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.setHeader('X-Cache', `HIT age=${Math.floor(age / 1000)}s`)
    return res.status(200).json(cache.data)
  }

  // ── Layer 2: fetch from PrizePicks ────────────────────────────────────────
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })

    // ── Layer 3: stale fallback on upstream error (429, 5xx, etc.) ───────────
    if (!upstream.ok) {
      if (cache.data) {
        const staleAge = Math.floor(age / 1000)
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60')
        res.setHeader('X-Cache', `STALE age=${staleAge}s upstream=${upstream.status}`)
        return res.status(200).json(cache.data)
      }
      return res.status(upstream.status).json({
        error: `PrizePicks API returned ${upstream.status}`,
      })
    }

    const data = await upstream.json()

    // Refresh the module-level cache
    cache = { data, fetchedAt: now }

    // Tell Vercel's CDN to cache for 5 min so the function isn't invoked at all
    // for the majority of browser requests during that window.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.setHeader('X-Cache', 'MISS')
    return res.status(200).json(data)
  } catch (err) {
    // Network-level failure — serve stale rather than hard-erroring the browser
    if (cache.data) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60')
      res.setHeader('X-Cache', `STALE-ERROR age=${Math.floor(age / 1000)}s`)
      return res.status(200).json(cache.data)
    }
    return res.status(500).json({ error: err.message })
  }
}
