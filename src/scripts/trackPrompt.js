import { track } from './analytics.js';
import { toast } from './motion.js';
import { openSheet } from './sheets.js';
import { $, esc } from './util.js';
// The same template as docs/tracking-guide.md links to, so the prompt, the download and the guide never drift apart
import template from '../../docs/show-log-template.csv?raw';

/* ---------- "Track your own shows": a prompt for any AI chat, from the footer ----------
   It follows docs/tracking-guide.md: the 11 columns and the rules that let Show Log import the sheet later.
   It works either way round: converting a list someone already has, or interviewing them to build one. */
const rows = template.trim().split('\n');
const HEADER = rows[0];
// A whole three-act bill, a stand-up night and a show abroad are enough to show the shape
const EXAMPLES = [rows[1], rows[2], rows[3], rows[5], rows[6]].join('\n');

export const TRACK_PROMPT = `I want to keep a log of every concert and stand-up comedy show I've been to, as a spreadsheet I can import into a site called Show Log later. Please help me build it.

First, ask me whether I already have a list (notes, an old spreadsheet, ticket emails, a calendar).
- If I do, I'll paste it. Convert it into the format below, then list anything you couldn't work out (a missing date, an unclear venue) so I can fill it in.
- If I don't, interview me to build it. Go year by year, starting with the most recent, and ask about one show at a time: who I saw, where, roughly when, and who else was on the bill. Suggest ways to jog my memory, like ticket emails, Ticketmaster or AXS order history, my calendar, photos, and setlist.fm.

If you're not sure about a detail, such as a venue's exact name or city, ask me rather than guessing.

The format is a CSV with exactly these 11 columns, in this order, with this header row:
${HEADER}

Rules:
1. One row per act, not per night. A headliner with two openers is three rows.
2. Headliner first, then the openers in billing order.
3. Every row of the same night has identical Date, Venue and City.
4. Spell each artist and venue the same way every time.
5. Date as YYYY-MM-DD. If I don't know the exact date, leave Date blank and put what I do know (the year or month) in Notes. Never guess a date.
6. Type is exactly Music or Comedy.
7. State is the two-letter US state; outside the US, the state, province or prefecture. Country is US for the United States, otherwise the full country name.
8. Rating (1 to 5), Price (a number with no currency sign) and With (who I went with, comma-separated) are optional, and go on the headliner's row only.
9. Notes is free text. Quote any value that contains a comma, as CSV does.

Example rows:
${EXAMPLES}

When we're done, or whenever I ask, give me the whole CSV in one code block, newest night first, and then list any rows that need checking.`;

const CLAUDE_URL = `https://claude.ai/new?q=${encodeURIComponent(TRACK_PROMPT)}`;

function copyPrompt(){
  const box = $('#trackPromptText');
  const done = () => { toast('Prompt copied'); track('track_prompt', {action: 'copy'}); };
  // Without clipboard access, select the text so Ctrl/⌘+C works
  const fallback = () => { box.focus(); box.select(); toast('Selected. Press Ctrl/⌘+C'); };
  if (!navigator.clipboard) { fallback(); return; }
  navigator.clipboard.writeText(TRACK_PROMPT).then(done, fallback);
}

function downloadTemplate(){
  const url = URL.createObjectURL(new Blob([template], {type: 'text/csv'}));
  const a = document.createElement('a');
  a.href = url; a.download = 'show-log-template.csv';
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  track('track_prompt', {action: 'template'});
}

export function openTrackPrompt(){
  openSheet(`<h3>Track your own shows</h3>
    <div class="track">
      <p class="track-lede">Paste this into Claude, ChatGPT or Gemini. It turns your notes into a spreadsheet Show Log can import later, or interviews you to build one from scratch. I will build to support this as an import if there is interest, but it's good practice!</p>
      <textarea id="trackPromptText" class="track-prompt" readonly aria-label="The prompt">${esc(TRACK_PROMPT)}</textarea>
      <div class="foot">
        <button type="button" class="primary" id="trackCopy">Copy prompt</button>
        <a class="btn" id="trackClaude" href="${esc(CLAUDE_URL)}" target="_blank" rel="noopener">Open in Claude</a>
        <span class="spacer"></span>
        <button type="button" data-close>Close</button>
      </div>
      <p class="track-more">Rather fill it in yourself? <button type="button" class="linkish" id="trackTemplate">Download the spreadsheet template</button> with the columns and a few examples.</p>
    </div>`);
  $('#trackCopy').onclick = copyPrompt;
  $('#trackTemplate').onclick = downloadTemplate;
  $('#trackClaude').onclick = () => track('track_prompt', {action: 'open_claude'});
  track('track_prompt', {action: 'open'});
}
