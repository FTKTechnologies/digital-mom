/**
 * Digital Mom website enquiries: Apps Script project (script.new) linked to the "Website enquiries" Google Sheet in the digitalmomseo account.
 * contact.php posts each enquiry here as JSON. The script adds a row to the sheet, writes a client brief as a Google Doc
 * in the "Client briefs" folder next to the sheet, and returns the Doc link, which goes into the email to info@.
 *
 * Setup: paste into a new Apps Script project, replace PASTE_KEY_HERE with the key from the project's sheet-secret.json,
 * then Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone. The key keeps strangers out.
 * Anyone with access to the sheet's folder sees the rows and briefs; share the folder, never the script.
 */
const KEY = 'PASTE_KEY_HERE';
const DAILY_CAP = 50;
const SHEET_ID = '1jRacK7NnXo0sB7LHBoTWcNMd-vrDQHSGrSs6Q_LxiGM'; // the "Website enquiries" sheet in digitalmomseo's Drive
// There is deliberately no doGet and nothing that reads the sheet: the website can only add, never read.
const HEADERS = ['Received', 'Status', 'Name', 'Business', 'Email', 'WhatsApp', 'Website or social link', 'Service', 'Answers', 'Message', 'Brief'];

function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return reply({ ok: false, error: 'bad json' }); }
  if (!data || data.key !== KEY) return reply({ ok: false, error: 'forbidden' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // At most DAILY_CAP enquiries a day, so a stolen key cannot flood the Drive. The email to info@ still goes out.
    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), 'Africa/Johannesburg', 'yyyy-MM-dd');
    const count = props.getProperty('day') === today ? Number(props.getProperty('count') || 0) : 0;
    if (count >= DAILY_CAP) return reply({ ok: false, error: 'daily cap reached' });
    props.setProperties({ day: today, count: String(count + 1) });

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    const answers = (data.answers || []).map(a => `${a.label}: ${a.value}`).join('\n');
    const doc = makeBrief(data);
    sheet.appendRow([new Date(), 'New', clean(data.name), clean(data.business), clean(data.email), clean(data.phone),
      clean(data.link), clean(data.service), answers, clean(data.message), doc.getUrl()]);
    return reply({ ok: true, brief: doc.getUrl() });
  } finally {
    lock.releaseLock();
  }
}

// Plain text only: a leading = + - or @ would make Sheets treat the value as a formula.
function clean(value) {
  const text = String(value || '').slice(0, 3000);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function briefsFolder() {
  const parent = DriveApp.getFileById(SHEET_ID).getParents().next();
  const found = parent.getFoldersByName('Client briefs');
  return found.hasNext() ? found.next() : parent.createFolder('Client briefs');
}

function makeBrief(data) {
  const when = Utilities.formatDate(new Date(), 'Africa/Johannesburg', 'yyyy-MM-dd');
  const who = String(data.business || data.name || 'Enquiry').slice(0, 80);
  const doc = DocumentApp.create(`${when} ${who}${data.service ? ' · ' + data.service : ''}`);
  const body = doc.getBody();
  body.appendParagraph(who).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(`Website enquiry received ${when}${data.service ? ', about ' + data.service : ''}.`);
  body.appendParagraph('Contact').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  [['Name', data.name], ['Business', data.business], ['Email', data.email], ['WhatsApp', data.phone], ['Website or social link', data.link]]
    .filter(([, v]) => v).forEach(([k, v]) => body.appendListItem(`${k}: ${v}`));
  if ((data.answers || []).length) {
    body.appendParagraph(`${data.service} answers`).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    data.answers.forEach(a => body.appendListItem(`${a.label}: ${a.value}`));
  }
  body.appendParagraph('Message').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(String(data.message || '(No extra message.)'));
  body.appendParagraph('Notes').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('');
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(briefsFolder());
  return file;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
