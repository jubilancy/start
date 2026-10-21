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
console.log('unit tests passed');
