// Newer official fixture notices can supersede a stale upstream scheduled status.
// Match the exact original date and fixture ID; never override a verified final.
const postponed = new Set(['401928518','401928519','401928524','401928500','401928497','401928506','401928532']);
const sourceUrl = 'https://rfef.es/es/noticias/la-rfef-acuerda-ampliar-la-suspension-de-sus-competiciones-hasta-el-6-de-noviembre';
export function applyVerifiedFixtureStatuses(payload, day) {
  if (String(day).replaceAll('-', '') !== '20261104') return payload;
  for (const event of payload?.events || []) {
    if (!postponed.has(String(event.id)) || String(event.date || '').slice(0, 10) !== '2026-11-04') continue;
    const type = event.status?.type || event.competitions?.[0]?.status?.type;
    if (type?.completed || type?.state === 'post') continue;
    const status = {type: {id:'8',name:'STATUS_POSTPONED',state:'pre',completed:false,description:'Postponed',detail:'Postponed',shortDetail:'Postponed'}};
    event.status = status;
    event.statusVerification = {sourceUrl,publishedAt:'2026-11-03T17:00:00+01:00'};
    for (const competition of event.competitions || []) competition.status = status;
  }
  return payload;
}
