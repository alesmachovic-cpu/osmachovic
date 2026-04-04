import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Si realitný copywriter pre Vianema Real. Píšeš pre makléra Aleša Machoviča.

ŠTÝL PÍSANIA — Apple dizajn textu:
- Žiadne klišé: ZAKÁZANÉ "nezmeškajte", "skvelá príležitosť", "ideálny pre", "moderný", "priestranný"
- Píš konkrétne a zmysluplne — každá veta musí niečo povedať
- Emotívne ale pravdivé — nie predajné frázy
- Krátke vety. Silné slová.

POVINNÁ ŠTRUKTÚRA NADPISOV:
- VÝHRADNÁ: "IBA U NÁS! [Názov + Lokalita]" / začína: "VIANEMA ponúka na predaj"
- NEVÝHRADNÁ: "NA PREDAJ! [Názov + Lokalita]" / začína: "VIANEMA ponúka na predaj"
- PRENÁJOM: "NA NÁJOM! [Názov + Lokalita]" / začína: "VIANEMA ponúka na nájom"
- PRIPRAVUJEME: "PRIPRAVUJEME na predaj [Názov + Lokalita]" / začína: "VIANEMA pripravuje do ponuky"

BAŤOVSKÁ CENA — povinne pri predaji:
- Cena musí končiť na 900 alebo 99,90 €
- 200 000 € → 199 900 €, 335 000 € → 334 900 €

FORMÁT — presne toto poradie, BEZ nadpisov sekcií, BEZ hviezd (**), BEZ markdown:

Lokalita: [Kraj · Okres · Mesto/Časť · Ulica]
Izby: [počet]
Výmera: [m² bytu + príslušenstvo m²]
Financie: [Cena Baťa] €

[prázdny riadok]

[ÚVOD — 2 vety. Najsilnejšie veci o tejto nehnuteľnosti alebo polohe. Konkrétne, nie všeobecné.]

[prázdny riadok]

[INTERIÉR — 3-4 vety o materiáloch, rekonštrukcii, dispozícii. Bez nadpisu.]

[prázdny riadok]

[BYTOVÝ DOM — 2 vety o dome, stave, poschodí. Bez nadpisu.]

[prázdny riadok]

[LOKALITA — 3-4 vety. Použi VÝHRADNE overené fakty z vyhľadávania — konkrétne názvy zastávok, škôl, obchodov, parkov. Bez nadpisu.]

[prázdny riadok]

• [fakt 1]
• [fakt 2]
• [fakt 3]
• [fakt 4]
• [fakt 5]`

const FOOTER = (cena: string) => `Cena: ${cena} € vrátane kompletného realitného servisu spoločnosti Vianema.
Dohodnite si obhliadku, radi vám nehnuteľnosť ukážeme. Kontakt: Aleš Machovič +421 915 627 008 machovic@vianema.eu

VIANEMA. Komplexné služby pre váš Projekt Bývanie a Investície pod jednou strechou.
Právny servis a poradenstvo, finančné služby a investičné poradenstvo, poistenie, služby znalca a znalecké posudky, odkup nehnuteľností, development, rekonštrukcie vrátane architektonickej a dizajnérskej expertízy, sťahovacie služby, manažment prenajatých nehnuteľností, kúpa - predaj, import áut.`

function bataPrice(cena: string): string {
  const num = parseFloat(cena.replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return cena
  const rounded = Math.floor(num / 1000) * 1000 - 100
  return rounded.toLocaleString('sk-SK')
}

async function tryOpenAI(prompt: string, system?: string) {
  const messages: any[] = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 2000, messages })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.choices?.[0]?.message?.content
}

async function tryClaude(prompt: string, images?: any[], system?: string) {
  const content: any[] = []
  if (images?.length) images.forEach(img => content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } }))
  content.push({ type: 'text', text: prompt })
  const body: any = { model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content }] }
  if (system) body.system = system
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content?.[0]?.text
}

async function tryGemini(prompt: string, webSearch = false) {
  const body: any = { contents: [{ parts: [{ text: prompt }] }] }
  if (webSearch) body.tools = [{ google_search: {} }]
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.candidates?.[0]?.content?.parts?.[0]?.text
}

async function getLocalityInfo(lokalita: string): Promise<string> {
  if (!lokalita) return ''
  // Použijeme len mesto/časť, nie ulicu — ulica by zamiešala výsledky
  const miestoKast = lokalita.split(',').slice(-2).join(',').trim()
  const prompt = `Vyhľadaj konkrétne informácie o lokalite: ${miestoKast}, Slovensko.
Uveď KONKRÉTNE NÁZVY (nie všeobecnosti):
- MHD: čísla liniek, názvy zastávok v dochádzkovej vzdialenosti (max 5 min pešo)
- Školy: konkrétne názvy ZŠ, gymnázií, škôlok v okolí
- Obchody: Billa, Lidl, Tesco, konkrétne nákupné centrá
- Parky a zeleň: názvy parkov, nábrežia, cyklotrás
- Čas do centra mesta MHD

Len overené fakty. Odrážky. Max 8 bodov.`
  try {
    return await tryGemini(prompt, true) || ''
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  const { prompt, images, type, lokalita, params, system } = await req.json()

  if (images?.length) {
    try {
      const text = await tryClaude(prompt, images)
      if (text) return NextResponse.json({ text, model: 'Claude' })
    } catch {}
    return NextResponse.json({ text: 'Fotky prijaté ale analýza zlyhala.', model: 'none' })
  }

  if (type === 'chat') {
    // Chat sa používa LEN na úpravu vygenerovaného textu
    // Pred generovaním AI nič nespochybňuje
    const chatSystem = `Si asistent makléra ktorý upravuje vygenerovaný inzerát podľa jeho pokynov.
Uprav text presne podľa pokynov. Ak pokyn je jasný — uprav a vráť LEN upravený text.
Ak pokyn nie je jasný — opýtaj sa jednou krátkou otázkou. Bez markdown.`

    const fullPrompt = `${chatSystem}\n\n${prompt}`
    try {
      const text = await tryGemini(fullPrompt)
      if (text) return NextResponse.json({ text, model: 'Gemini' })
    } catch {}
    try {
      const text = await tryOpenAI(prompt, chatSystem)
      if (text) return NextResponse.json({ text, model: 'ChatGPT' })
    } catch {}
    return NextResponse.json({ text: 'Chyba.', model: 'none' })
  }

  if (type === 'generate') {
    const lokalityInfo = await getLocalityInfo(lokalita)
    const cenaRaw = params?.Cena || ''
    const cenaBata = cenaRaw ? bataPrice(cenaRaw) : ''
    const isNajom = (params?.['Typ ponuky'] || '').includes('NÁJOM')

    const fullPrompt = `Vygeneruj inzerát podľa pravidiel.

PARAMETRE:
${Object.entries(params || {}).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join('\n')}
${!isNajom && cenaBata ? `Cena (Baťovský formát): ${cenaBata} €` : ''}

${lokalityInfo ? `OVERENÉ FAKTY O LOKALITE (použi toto v sekcii Lokalita):\n${lokalityInfo}` : ''}

POZNÁMKY MAKLÉRA:
${prompt}

Napíš inzerát PRESNE podľa šablóny. BEZ nadpisov sekcií. BEZ hviezd. BEZ klišé.
${!isNajom ? `Cena v texte: ${cenaBata || cenaRaw} €` : ''}`

    let text = ''
    let usedModel = ''

    try { text = await tryOpenAI(fullPrompt, SYSTEM_PROMPT) || ''; if (text) usedModel = 'ChatGPT' } catch {}
    if (!text) { try { text = await tryClaude(fullPrompt, undefined, SYSTEM_PROMPT) || ''; if (text) usedModel = 'Claude' } catch {} }
    if (!text) { try { text = await tryGemini(SYSTEM_PROMPT + '\n\n' + fullPrompt) || ''; if (text) usedModel = 'Gemini' } catch {} }
    if (!text) return NextResponse.json({ text: 'Chyba pri generovaní.', model: 'none' })

    const footer = FOOTER(cenaBata || cenaRaw)
    return NextResponse.json({ text: `${text}\n\n---\n\n${footer}`, model: usedModel, lokalityInfo })
  }

  try { const text = await tryOpenAI(prompt, SYSTEM_PROMPT); if (text) return NextResponse.json({ text, model: 'ChatGPT' }) } catch {}
  try { const text = await tryClaude(prompt, undefined, SYSTEM_PROMPT); if (text) return NextResponse.json({ text, model: 'Claude' }) } catch {}
  try { const text = await tryGemini(prompt); if (text) return NextResponse.json({ text, model: 'Gemini' }) } catch {}
  return NextResponse.json({ text: 'Žiadne AI nie je dostupné.', model: 'none' })
}