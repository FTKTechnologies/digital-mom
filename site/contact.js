'use strict';
// Wires every form marked [data-contact-form]: the contact dialog (token prepared on open) and the full
// enquiry form on /contact/ (token prepared on load). Server rules live in contact.php.
const MESSAGES = {
  success: 'Thanks, we’ve got your message. We’ll take a look and be in touch.',
  failed: 'That didn’t go through. Please check your details and try again.',
  unavailable: 'The contact form is unavailable right now. Please WhatsApp us instead.',
};

function wireForm(form, dialog) {
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[type="submit"]');
  let loading = false;
  let prepared = false;

  async function prepare() {
    if (prepared) return;
    prepared = true;
    submit.disabled = true;
    status.textContent = 'Preparing your form…';
    try {
      const response = await fetch('/contact.php', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok || typeof result.token !== 'string') throw new Error();
      form.elements.token.value = result.token;
      status.textContent = '';
      submit.disabled = false;
    } catch {
      prepared = false;
      status.textContent = MESSAGES.unavailable;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (loading || !form.reportValidity() || !form.elements.token.value) return;
    loading = true;
    submit.disabled = true;
    status.textContent = 'Sending your message…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) {
        status.textContent = result.message || MESSAGES.failed;
        if (response.status === 403) {
          form.elements.token.value = '';
          prepared = false;
          status.textContent += dialog ? ' Close and reopen this form to try again.' : ' Reload the page to try again.';
        }
      } else {
        form.reset();
        form.elements.token.value = '';
        prepared = false;
        status.textContent = MESSAGES.success;
      }
    } catch {
      status.textContent = 'We couldn’t confirm your message was sent. Please try WhatsApp.';
    } finally {
      loading = false;
      submit.disabled = !form.elements.token.value;
    }
  });

  return prepare;
}

// Enquiry form on /contact/: picking a service opens its questions (src/enquiry.json). Closed sets are disabled, so
// their answers are not sent. With a service picked, the message becomes optional. /contact/?service=<page slug>
// (the Get a quote buttons) opens with that service picked.
function wireTopics(form) {
  const sets = [...form.querySelectorAll('[data-enquiry-set]')];
  if (!sets.length) return;
  const message = form.elements.message;
  const label = form.querySelector('[data-message-label]');
  const help = form.querySelector('[data-message-help]');
  const original = { label: label.textContent, help: help.textContent };
  const update = () => {
    const topic = form.querySelector('input[name="topic"]:checked')?.value || '';
    for (const set of sets) {
      const open = set.dataset.enquirySet === topic;
      set.hidden = !open;
      set.disabled = !open;
    }
    const picked = topic !== '' && topic !== 'unsure';
    message.required = !picked;
    message.minLength = picked ? 0 : 10;
    label.textContent = picked ? 'Anything else we should know? (optional)' : original.label;
    help.textContent = picked ? 'Goals, dates, budget or questions. Whatever helps.' : original.help;
  };
  form.addEventListener('change', event => { if (event.target.name === 'topic') update(); });
  form.addEventListener('reset', () => setTimeout(update));
  const wanted = new URLSearchParams(location.search).get('service');
  const preset = wanted && sets.find(set => set.dataset.service === wanted);
  if (preset) form.querySelector(`input[name="topic"][value="${preset.dataset.enquirySet}"]`).checked = true;
  update();
}

// The form in stages (inside [data-wizard], the maintenance page pop-up): one [data-step] at a time with Back/Next.
// The questions step is skipped when no service is picked ("Not sure yet"). Send shows on the last step only.
function wireWizard(form) {
  const box = form.closest('[data-wizard]');
  if (!box) return () => {};
  const all = [...form.querySelectorAll('[data-step]')];
  const back = form.querySelector('[data-step-back]');
  const next = form.querySelector('[data-step-next]');
  const submit = form.querySelector('[type="submit"]');
  const count = form.querySelector('[data-step-count]');
  const status = form.querySelector('[data-form-status]');
  let current = 'intro';
  const steps = () => {
    const topic = form.querySelector('input[name="topic"]:checked')?.value || '';
    return all.filter(step => step.dataset.step !== 'questions' || topic !== 'unsure');
  };
  const show = name => {
    const list = steps();
    const index = Math.max(0, list.findIndex(step => step.dataset.step === name));
    current = list[index].dataset.step;
    for (const step of all) step.hidden = step !== list[index];
    back.hidden = index === 0;
    next.hidden = index === list.length - 1;
    submit.hidden = index !== list.length - 1;
    count.textContent = `Step ${index + 1} of ${list.length}`;
    box.closest('dialog')?.scrollTo(0, 0);
  };
  const valid = () => {
    const step = all.find(s => s.dataset.step === current);
    if (current === 'service' && !form.querySelector('input[name="topic"]:checked')) {
      status.textContent = 'Please choose what we can help with, or pick “Not sure yet”.';
      return false;
    }
    for (const field of step.querySelectorAll('input, textarea, select')) if (!field.disabled && !field.checkValidity()) { field.reportValidity(); return false; }
    status.textContent = '';
    return true;
  };
  const move = by => {
    const list = steps();
    const index = list.findIndex(step => step.dataset.step === current);
    show(list[Math.min(list.length - 1, Math.max(0, index + by))].dataset.step);
  };
  next.addEventListener('click', () => { if (valid()) move(1); });
  back.addEventListener('click', () => { status.textContent = ''; move(-1); });
  // Enter in a field moves on instead of sending early. Runs before the send handler in wireForm.
  form.addEventListener('submit', event => {
    if (current === steps().at(-1).dataset.step) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (valid()) move(1);
  }, true);
  form.addEventListener('change', event => { if (event.target.name === 'topic') status.textContent = ''; });
  show('intro');
  return () => show('intro');
}

const restartWizard = [];
for (const form of document.querySelectorAll('[data-contact-form]')) {
  wireTopics(form);
  restartWizard.push(wireWizard(form));
}

const dialog = document.querySelector('#contact-dialog');
let prepareDialog = () => {};
for (const form of document.querySelectorAll('[data-contact-form]')) {
  const inDialog = dialog && dialog.contains(form);
  const prepare = wireForm(form, inDialog);
  if (inDialog) prepareDialog = prepare;
  else prepare();
}

if (dialog) {
  document.querySelectorAll('.contact-open').forEach(button => button.addEventListener('click', () => {
    // After a sent enquiry the stepped form starts again from the first step; otherwise it opens where it was left.
    const status = dialog.querySelector('[data-form-status]');
    if (status && status.textContent === MESSAGES.success) { status.textContent = ''; restartWizard.forEach(restart => restart()); }
    dialog.showModal();
    prepareDialog();
  }));
  dialog.querySelector('.modal-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}
