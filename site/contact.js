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
