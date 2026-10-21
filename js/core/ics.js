// Minimal iCalendar (RFC 5545) reader: VEVENT with DTSTART/DTEND/SUMMARY/LOCATION, RRULE (DAILY/WEEKLY/MONTHLY/YEARLY,
// INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY), EXDATE and RECURRENCE-ID overrides. Good for typical Google/iCloud/Fastmail feeds.

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function unfold(text) { return text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); }

function parseLine(line) {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const left = line.slice(0, i), value = line.slice(i + 1);
  const [name, ...params] = left.split(';');
  const p = {};
  for (const x of params) { const [k, v] = x.split('='); p[k.toUpperCase()] = (v || '').replace(/^"|"$/g, ''); }
  return { name: name.toUpperCase(), params: p, value };
}

function tzOffsetMs(tz, utcMs) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const o = Object.fromEntries(f.formatToParts(new Date(utcMs)).map(p => [p.type, p.value]));
  return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second) - utcMs;
}

function parseDate(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh = '0', mi = '0', ss = '0', z] = m;
  const allDay = !m[4];
  if (allDay) return { date: new Date(+y, mo - 1, +d), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, mo - 1, +d, +hh, +mi, +ss)), allDay: false };
  const tz = params.TZID;
  if (tz) {
    try {
      const guess = Date.UTC(+y, mo - 1, +d, +hh, +mi, +ss);
      return { date: new Date(guess - tzOffsetMs(tz, guess - tzOffsetMs(tz, guess))), allDay: false };
    } catch { /* unknown tz → floating */ }
  }
  return { date: new Date(+y, mo - 1, +d, +hh, +mi, +ss), allDay: false };
}

function unescapeText(s) { return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'); }

export function parseICS(text) {
  const events = [];
  let cur = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = { ex: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur?.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    switch (p.name) {
      case 'DTSTART': { const d = parseDate(p.value, p.params); if (d) { cur.start = d.date; cur.allDay = d.allDay; } break; }
      case 'DTEND': { const d = parseDate(p.value, p.params); if (d) cur.end = d.date; break; }
      case 'SUMMARY': cur.title = unescapeText(p.value); break;
      case 'LOCATION': cur.location = unescapeText(p.value); break;
      case 'DESCRIPTION': cur.description = unescapeText(p.value); break;
      case 'UID': cur.uid = p.value; break;
      case 'URL': cur.url = p.value; break;
      case 'RRULE': cur.rrule = Object.fromEntries(p.value.split(';').map(x => x.split('='))); break;
      case 'EXDATE': for (const v of p.value.split(',')) { const d = parseDate(v, p.params); if (d) cur.ex.push(d.date.getTime()); } break;
      case 'RECURRENCE-ID': { const d = parseDate(p.value, p.params); if (d) cur.recId = d.date.getTime(); break; }
      case 'STATUS': cur.status = p.value; break;
    }
  }
  return events.filter(e => e.status !== 'CANCELLED');
}

/** Expand into concrete occurrences overlapping [from, to). */
export function occurrences(events, from, to) {
  const out = [];
  const overridden = new Set(events.filter(e => e.recId != null).map(e => `${e.uid}|${e.recId}`));
  for (const e of events) {
    const dur = (e.end ? e.end - e.start : e.allDay ? 86400000 : 0);
    const push = start => {
      const end = new Date(start.getTime() + dur);
      if (end > from && start < to || (dur === 0 && start >= from && start < to)) {
        out.push({ title: e.title || '(no title)', start, end, allDay: e.allDay, location: e.location, url: e.url });
      }
    };
    if (e.recId != null || !e.rrule) { push(e.start); continue; }
    for (const s of expand(e, to)) {
      if (e.ex.includes(s.getTime()) || overridden.has(`${e.uid}|${s.getTime()}`)) continue;
      push(s);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function* expand(e, to) {
  const r = e.rrule;
  const freq = r.FREQ, interval = +(r.INTERVAL || 1);
  const until = r.UNTIL ? parseDate(r.UNTIL, {})?.date : null;
  const limit = r.COUNT ? +r.COUNT : Infinity;
  const end = until && until < to ? until : to;
  const byday = r.BYDAY ? r.BYDAY.split(',').map(x => ({ n: parseInt(x, 10) || 0, d: DAYS.indexOf(x.replace(/^[+-]?\d+/, '')) })) : null;
  const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
  const s0 = e.start;
  let count = 0, guard = 0;
  const mk = (y, mo, d) => new Date(y, mo, d, s0.getHours(), s0.getMinutes(), s0.getSeconds());
  const emit = d => d >= s0 && d <= end;

  if (freq === 'DAILY') {
    for (let d = new Date(s0); d <= end && count < limit && guard++ < 5000; d = mk(d.getFullYear(), d.getMonth(), d.getDate() + interval)) { count++; if (emit(d)) yield d; }
  } else if (freq === 'WEEKLY') {
    const days = byday ? byday.map(x => x.d) : [s0.getDay()];
    const wkStart = mk(s0.getFullYear(), s0.getMonth(), s0.getDate() - s0.getDay());
    for (let w = new Date(wkStart); w <= end && count < limit && guard++ < 2000; w = mk(w.getFullYear(), w.getMonth(), w.getDate() + 7 * interval)) {
      for (const dow of [...days].sort()) {
        const d = mk(w.getFullYear(), w.getMonth(), w.getDate() + dow);
        if (d < s0) continue;
        if (count >= limit || d > end) break;
        count++; if (emit(d)) yield d;
      }
    }
  } else if (freq === 'MONTHLY') {
    for (let m = 0; guard++ < 1200 && count < limit; m += interval) {
      const base = new Date(s0.getFullYear(), s0.getMonth() + m, 1);
      if (base > end) break;
      const dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      let days = [];
      if (bymd) days = bymd.map(x => (x < 0 ? dim + 1 + x : x));
      else if (byday) {
        for (const { n, d } of byday) {
          const all = [];
          for (let i = 1; i <= dim; i++) if (new Date(base.getFullYear(), base.getMonth(), i).getDay() === d) all.push(i);
          days.push(n === 0 ? all[0] : n > 0 ? all[n - 1] : all[all.length + n]);
        }
      } else days = [s0.getDate()];
      for (const day of days.filter(x => x >= 1 && x <= dim).sort((a, b) => a - b)) {
        const d = mk(base.getFullYear(), base.getMonth(), day);
        if (d < s0) continue;
        if (count >= limit || d > end) break;
        count++; if (emit(d)) yield d;
      }
    }
  } else if (freq === 'YEARLY') {
    for (let y = 0; guard++ < 200 && count < limit; y += interval) {
      const d = mk(s0.getFullYear() + y, s0.getMonth(), s0.getDate());
      if (d > end) break;
      count++; if (emit(d)) yield d;
    }
  } else yield s0;
}
