// Pure-logic tests (no browser): node tests/unit.mjs
import assert from 'node:assert/strict';
import { parseICS, occurrences } from '../js/core/ics.js';
import { parseCSV, parseBookmarkCSV, groupsToText, textToGroups } from '../js/core/bookmarks.js';

const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:1
DTSTART:20261021T140000Z
DTEND:20261021T150000Z
SUMMARY:One-off\\, with comma
LOCATION:Room 1
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART;VALUE=DATE:20261019
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4
SUMMARY:Weekly
EXDATE;VALUE=DATE:20261021
END:VEVENT
BEGIN:VEVENT
UID:3
DTSTART;TZID=America/New_York:20261101T090000
RRULE:FREQ=MONTHLY;BYDAY=1SU
SUMMARY:First Sunday
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '\r\n');
const ev = parseICS(ics);
assert.equal(ev.length, 3);
assert.equal(ev[0].title, 'One-off, with comma');
const occ = occurrences(ev, new Date(2026, 9, 1), new Date(2026, 11, 31));
const weekly = occ.filter(o => o.title === 'Weekly').map(o => o.start.getDate());
assert.deepEqual(weekly, [19, 26, 28]); // COUNT=4 → Mon19, Wed21 (EXDATE), Mon26, Wed28
const fs = occ.filter(o => o.title === 'First Sunday').map(o => o.start.getDate());
assert.deepEqual(fs, [1, 6], 'first Sunday of Nov (1) and Dec (6)');
assert.equal(occ.find(o => o.title.startsWith('One-off')).start.toISOString(), '2026-10-21T14:00:00.000Z');
// NY 09:00 on 2026-11-01 is 09:00 EST (DST ended that morning) = 14:00Z
assert.equal(occ.find(o => o.title === 'First Sunday').start.toISOString(), '2026-11-01T14:00:00.000Z');

const csv = parseCSV('id,title,url,folder\n1,"A, b",https://a.com,Work\n2,C,https://c.com,"My ""Fav"""\n');
assert.equal(csv[1][1], 'A, b'); assert.equal(csv[2][3], 'My "Fav"');
const g = parseBookmarkCSV('id,title,note,url,folder\n1,A,,https://a.com,Work\n2,B,,https://b.com,Work\n3,C,,https://c.com,Play');
assert.deepEqual(g.map(x => [x.name, x.items.length]), [['Work', 2], ['Play', 1]]);
const txt = groupsToText([{ name: 'Dev', items: [{ title: 'GH', url: 'https://github.com', icon: 'si:github' }, { title: 'X', url: 'https://x.com', icon: '' }] }]);
assert.equal(txt, '# Dev\nGH | https://github.com | si:github\nX | https://x.com');
assert.deepEqual(textToGroups(txt), [{ name: 'Dev', items: [{ title: 'GH', url: 'https://github.com', icon: 'si:github' }, { title: 'X', url: 'https://x.com', icon: '' }] }]);
import { evaluate } from '../js/core/calc.js';
import { moonPhase, phaseName, illumination, nextPhase } from '../js/widgets/sky.js';
const ev2 = [['1+2*3', 7], ['(1+2)*3', 9], ['2^3^2', 512], ['-2^2', -4], ['2^-3', 0.125], ['3*-2', -6], ['10%4', 2], ['sqrt(16)+abs(-3)', 7], ['pi*2', Math.PI * 2], ['1.5e2/3', 50], ['2*(3+4)-5/5', 13]];
for (const [e, r] of ev2) assert.ok(Math.abs(evaluate(e) - r) < 1e-9, e + ' → ' + evaluate(e));
for (const bad of ['1+', '(1', 'foo(1)', '1/0', '']) assert.throws(() => evaluate(bad), bad);
// moon: 2000-01-06 18:14Z new; 2026-10-26 ~ full moon window; illumination bounds
assert.ok(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14))) < 0.001);
assert.equal(phaseName(moonPhase(new Date(Date.UTC(2000, 0, 21, 4, 40))))[0], 'Full moon'); // known full moon 2000-01-21 04:40 UTC
assert.ok(illumination(0) < 1e-9 && Math.abs(illumination(0.5) - 1) < 1e-9);
const nf = nextPhase(0.5, new Date(Date.UTC(2026, 0, 1))); assert.ok(nf > new Date(Date.UTC(2026, 0, 1)) && nf < new Date(Date.UTC(2026, 0, 31)));
console.log('unit tests passed');
import { nextOccurrence } from '../js/widgets/countdown.js';
const now = new Date(2026, 9, 21);
assert.equal(nextOccurrence('1990-05-14', 'yearly', now).toDateString(), new Date(2027, 4, 14).toDateString());
assert.equal(nextOccurrence('1990-10-21', 'yearly', now).toDateString(), now.toDateString());
assert.equal(nextOccurrence('2026-01-31', 'monthly', now).toDateString(), new Date(2026, 9, 31).toDateString());
assert.equal(nextOccurrence('2026-10-14', 'weekly', now).toDateString(), new Date(2026, 9, 21).toDateString());
assert.equal(nextOccurrence('2025-01-01', 'none', now).toDateString(), new Date(2025, 0, 1).toDateString());
console.log('countdown tests passed');
