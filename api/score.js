// POST /api/score
// Body: { title: string, skills: string }
// Returns: { score: number, category: string, explanation: string, skills: string[] }
//
// Requires an ANTHROPIC_API_KEY environment variable set in the Vercel
// project (Settings -> Environment Variables). The key never reaches
// the browser — this function is the only thing that calls Anthropic.

const SYSTEM_PROMPT = [
  'You are a labor-market analyst. Given a job title and 3 self-reported skills, produce:',
  '1. A realism-grounded automation-risk score from 0-100 (0 = very safe, 100 = high risk), based on how much of the role involves repetitive, pattern-based, or purely information-processing tasks versus physical dexterity, real-time human judgment, or interpersonal trust.',
  '2. A one-word category: "Safe" (0-33), "Watch" (34-66), or "At risk" (67-100)',
  '3. A 2-3 sentence plain-language explanation, specific to this exact job title, not generic.',
  '4. Exactly 3 specific, actionable skills this person could learn in the next 90 days to reduce their risk score, tailored to their stated skills.',
  'Respond only in JSON: {"score": int, "category": string, "explanation": string, "skills": [string, string, string]}',
  'Be balanced and evidence-based \u2014 don\u2019t be alarmist, don\u2019t be dismissive.'
].join(' ');

function clampScore(n) {
  n = Math.round(Number(n));
  if (Number.isNaN(n)) return 50;
  return Math.max(1, Math.min(99, n));
}

function categoryFromScore(score) {
  if (score >= 67) return 'At risk';
  if (score >= 34) return 'Watch';
  return 'Safe';
}

function normalizeCategory(cat, score) {
  const c = String(cat || '').trim().toUpperCase();
  if (c === 'SAFE') return 'Safe';
  if (c === 'WATCH') return 'Watch';
  if (c === 'AT RISK' || c === 'AT-RISK' || c === 'ATRISK') return 'At risk';
  return categoryFromScore(score);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const title = (body && body.title ? String(body.title) : '').trim().slice(0, 200);
  const skills = (body && body.skills ? String(body.skills) : '').trim().slice(0, 300);

  if (!title || !skills) {
    res.status(400).json({ error: 'Missing "title" or "skills" in request body' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: 'Job title: ' + title + '\nTop 3 skills: ' + skills }
        ]
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(502).json({ error: 'Upstream API error', detail: errText });
      return;
    }

    const data = await upstream.json();
    const text = (data.content || [])
      .map((block) => (block.type === 'text' ? block.text : ''))
      .filter(Boolean)
      .join('\n');

    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    const score = clampScore(parsed.score);
    const category = normalizeCategory(parsed.category, score);
    const explanation = typeof parsed.explanation === 'string' && parsed.explanation.trim()
      ? parsed.explanation.trim()
      : '';
    let skillsList = Array.isArray(parsed.skills) ? parsed.skills.filter(Boolean).slice(0, 3) : [];

    res.status(200).json({ score, category, explanation, skills: skillsList });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: String(err && err.message ? err.message : err) });
  }
};
