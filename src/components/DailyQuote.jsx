const QUOTES = [
  {
    text: "The goal is not to win every bet. The goal is to make the right decision every time.",
    author: "EV Mindset",
  },
  {
    text: "A bad outcome doesn't make a good bet wrong. A good outcome doesn't make a bad bet right.",
    author: "Process Thinking",
  },
  {
    text: "Win rate is vanity. Expected value is sanity.",
    author: "Sharp Bettor's Creed",
  },
  {
    text: "You can't control the outcome. You can only control the process.",
    author: "Discipline First",
  },
  {
    text: "Variance is not your enemy. Tilt is.",
    author: "Bankroll Management",
  },
  {
    text: "Patience is the edge. Everyone wants to act. The winner waits for value.",
    author: "Long-Game Thinking",
  },
  {
    text: "The sharpest bettors lose games too. They just never lose their process.",
    author: "Sharp Money",
  },
  {
    text: "Size your bets on the strength of your edge, not the strength of your conviction.",
    author: "Kelly Criterion",
  },
  {
    text: "Every bad bet was once called a sure thing.",
    author: "Humility in Handicapping",
  },
  {
    text: "Trust the process on your worst days. Anyone can trust it on the best.",
    author: "Discipline Over Emotion",
  },
  {
    text: "The line doesn't care about your feelings.",
    author: "Market Reality",
  },
  {
    text: "One bad week doesn't erase a sound strategy. One hot streak doesn't validate a flawed one.",
    author: "Sample Size Thinking",
  },
  {
    text: "Bet what you know, not what you hope.",
    author: "Information Edge",
  },
  {
    text: "The house has an edge because most bettors let emotion override math.",
    author: "Beating the Market",
  },
  {
    text: "Grind when it's boring. Protect the bankroll when it's tempting.",
    author: "Bankroll Discipline",
  },
  {
    text: "Never confuse a good result with a good decision.",
    author: "Outcome vs. Process",
  },
  {
    text: "Your bankroll is your weapon. Don't fire it at bad angles.",
    author: "Capital Preservation",
  },
  {
    text: "Emotion is the rake you didn't account for.",
    author: "Tilt Awareness",
  },
  {
    text: "Sharp money is quiet. Loud picks are usually noise.",
    author: "Signal vs. Noise",
  },
  {
    text: "Every bet is a sample size of one. Your edge lives in thousands.",
    author: "Long-Term Variance",
  },
  {
    text: "A 55% edge applied consistently beats a 70% hunch every time.",
    author: "Sustainable Edge",
  },
  {
    text: "Log every bet. Review every loss. The record is your only honest coach.",
    author: "Accountability System",
  },
  {
    text: "Stop chasing. Value finds you when you're looking in the right places.",
    author: "Selective Betting",
  },
  {
    text: "The worst thing that can happen to a new bettor is winning big early.",
    author: "Beginner's Luck Warning",
  },
  {
    text: "Flat betting isn't timid. It's disciplined.",
    author: "Unit Sizing",
  },
  {
    text: "Discipline in the lean times builds the character that profits in the good ones.",
    author: "Long-Run Mindset",
  },
  {
    text: "The edge is rarely obvious. If it were, it wouldn't exist.",
    author: "Market Efficiency",
  },
  {
    text: "Reacting to yesterday's results is how recreational bettors think. Process is how professionals think.",
    author: "Professional Approach",
  },
  {
    text: "It's not about being right. It's about being right more often than the market expects.",
    author: "Edge Definition",
  },
  {
    text: "The best time to skip a bet is when you have no edge. The second best time is always.",
    author: "Selective Aggression",
  },
  {
    text: "Protect the downside and the upside takes care of itself.",
    author: "Risk-First Thinking",
  },
  {
    text: "Pressure is a privilege. It means you have something worth protecting.",
    author: "Bankroll Mindset",
  },
]

// Deterministic daily index — same quote all day, rotates at midnight
function getDailyQuote() {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  return QUOTES[dayIndex % QUOTES.length]
}

export default function DailyQuote() {
  const quote = getDailyQuote()

  return (
    <div style={{
      borderLeft: '3px solid var(--accent)',
      background: 'var(--bg-card)',
      borderRadius: '0 8px 8px 0',
      padding: '11px 16px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'baseline',
      gap: '10px',
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: '11px',
        fontWeight: '700',
        color: 'var(--accent)',
        textTransform: 'uppercase',
        letterSpacing: '0.6px',
        flexShrink: 0,
      }}>
        Daily
      </span>
      <span style={{
        fontSize: '13px',
        color: 'var(--text)',
        fontStyle: 'italic',
        lineHeight: '1.5',
        flex: 1,
        minWidth: 0,
      }}>
        "{quote.text}"
      </span>
      <span style={{
        fontSize: '11px',
        color: 'var(--text-dim)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        — {quote.author}
      </span>
    </div>
  )
}
