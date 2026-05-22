const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;

export async function getAISuggestions({ activityName, activityTier, isTripType, location = 'NYC' }) {
  const locationContext = isTripType
    ? `near ${location} or within a day trip / weekend trip distance`
    : `in ${location}`;

  const prompt = `You are helping a fun friend group called "We Limin'" find real experiences to do together.

Activity: "${activityName}" (${activityTier} tier)
Location: ${locationContext}

Give exactly 3 real, bookable experience suggestions for this activity ${locationContext}.

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "name": "Venue or Experience Name",
    "desc": "One fun sentence description.",
    "tag": "Short label like 'As seen on TikTok 🎵' or 'Great for groups 👥' or 'Bougie pick 💅' or 'Top rated ⭐' or 'Fan favorite 🔥'",
    "url": "Real website URL or null"
  }
]`;

  console.log('[ai] calling Anthropic with location=', location, 'activity=', activityName, 'keyPresent=', !!ANTHROPIC_KEY, 'keyLen=', ANTHROPIC_KEY?.length || 0);

  // 529 (overloaded) gets internal retry with backoff. Other non-2xx
  // statuses bubble up to the screen's existing error/retry banner.
  const OVERLOAD_RETRIES = 3;
  const backoffMs = [400, 1000, 2000];
  let res;
  for (let attempt = 0; attempt <= OVERLOAD_RETRIES; attempt++) {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        // Required when calling /v1/messages from a browser-like fetch
        // (React Native counts). Without this Anthropic returns 400.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    console.log('[ai] response status=', res.status, res.statusText || '', 'attempt=', attempt);
    if (res.status !== 529) break;
    if (attempt === OVERLOAD_RETRIES) break;
    await new Promise(r => setTimeout(r, backoffMs[attempt] || 2000));
  }

  // Special-case overloaded so the screen can show a friendlier copy.
  if (res.status === 529) {
    const err = new Error('The lime is overloaded, try again in a min 🍋');
    err.code = 'lime_overloaded';
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log('[ai] non-OK body:', body.slice(0, 400));
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }

  const data = await res.json();
  if (data?.type === 'error' || data?.error) {
    console.log('[ai] response body indicates error:', JSON.stringify(data));
    throw new Error(`Anthropic error: ${data.error?.message || 'unknown'}`);
  }

  const text = data.content?.[0]?.text || '';
  console.log('[ai] text preview:', text.slice(0, 200));
  if (!text) throw new Error('Empty response from Anthropic');

  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  console.log('[ai] parsed', Array.isArray(parsed) ? parsed.length : 'non-array', 'suggestions');
  return parsed;
}

// Exposed so the screen can use it as a last-resort default after
// repeated retries fail. Not invoked from inside getAISuggestions.
export function getAIFallback(activityName, location) {
  return [
    { name: `${activityName} on Airbnb Experiences`, desc: `Find curated local experiences in ${location}.`, tag: 'Great for groups 👥', url: `https://www.airbnb.com/s/experiences?query=${encodeURIComponent(activityName + ' ' + location)}` },
    { name: 'Fever', desc: 'Curated events and experiences happening near you right now.', tag: 'Trending 🔥', url: 'https://feverup.com/' },
    { name: 'ClassPass', desc: 'Book fitness and wellness experiences across the city.', tag: 'Popular pick ⭐', url: 'https://classpass.com/' },
  ];
}
