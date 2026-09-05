import { manualSections } from '../data/manualContent.js';

// Flattens the shared manual content into plain reference text for the
// system prompt. Importing directly from the same file the in-app manual
// uses means this stays accurate automatically as the manual is updated —
// no separate copy to maintain or let drift out of sync.
function buildManualReference() {
  return manualSections.map(category =>
    `## ${category.title}\n` +
    category.subsections.map(sub => `### ${sub.title}\n${sub.content}`).join('\n\n')
  ).join('\n\n');
}

const PRICING_REFERENCE = `
PRICING PLANS:
- Basic ($9.99/month): Live rink event tracking, AI Roster Sync (paste, photo & PDF import), basic play-by-play log, PDF & Excel exports.
- Pro ($14.99/month): Everything in Basic, plus Faceoff Hub, Zone Entries & Breakouts tracking, Live AI Tactical Intel, HTML report exports, line management tools, priority support.
- Team ($29.99/month): Everything in Pro, plus up to 5 user accounts, season stats dashboard, custom branding on reports, early access to new features.
`;

const SYSTEM_PROMPT = `You are the AI support assistant for Top Cheese Hockey (topcheesehockey.com), a live hockey stat-tracking app built for coaches to use from the bench during games.

Your job is to answer questions about the product accurately, using ONLY the reference material below. Do not invent features, pricing, or behavior that isn't described here.

${PRICING_REFERENCE}

FULL USER MANUAL (your primary knowledge source):
${buildManualReference()}

RULES:
- Be warm, concise, and direct — this is a busy coach, not someone browsing for fun.
- If you don't know the answer, or the question is about someone's specific account, billing, refund, or something you can't verify from this material, say so plainly and direct them to email hello@topcheesehockey.com or use the Contact page — do not guess or make up an answer.
- Never take or claim to take any account action yourself (cancellations, refunds, plan changes, data deletion). Always route those to a human via email.
- If someone explicitly asks for a human, immediately point them to hello@topcheesehockey.com rather than continuing to try to resolve it yourself.
- Keep answers short — a few sentences, not an essay — unless the question genuinely needs a walkthrough.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Support chat error: ANTHROPIC_API_KEY is not set in the environment.');
    return res.status(500).json({ error: 'Support chat is not configured yet. Please email hello@topcheesehockey.com instead.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Anthropic API error:', error);
      return res.status(500).json({ error: 'Something went wrong. Please email hello@topcheesehockey.com instead.' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Sorry, I couldn't come up with an answer to that — please email hello@topcheesehockey.com and we'll help directly.";
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Support chat error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please email hello@topcheesehockey.com instead.' });
  }
}
