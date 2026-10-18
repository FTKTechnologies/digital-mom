'use strict';
const dialog = document.querySelector('#contact-dialog');
const form = document.querySelector('#contact-form');
const status = document.querySelector('#form-status');
const submit = form.querySelector('[type="submit"]');
let loading = false;
async function prepareForm() {
  submit.disabled = true;
  status.textContent = 'Preparing your form…';
  try {
    const response = await fetch('/contact.php', {credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json'}});
    const result = await response.json();
    if (!response.ok || typeof result.token !== 'string') throw new Error();
    form.elements.token.value = result.token;
    status.textContent = '';
    submit.disabled = false;
  } catch {
    status.textContent = 'The contact form is unavailable right now. Please WhatsApp us instead.';
  }
}
document.querySelectorAll('.contact-open').forEach(button => button.addEventListener('click', () => {
  dialog.showModal();
  if (!loading) prepareForm();
}));
dialog.querySelector('.modal-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) {
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
}});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (loading || !form.reportValidity() || !form.elements.token.value) return;
  loading = true;
  submit.disabled = true;
  status.textContent = 'Sending your message…';
  try {
    const response = await fetch(form.action, {method:'POST', body:new FormData(form), credentials:'same-origin', headers:{Accept:'application/json'}});
    const result = await response.json();
    if (!response.ok) {
      status.textContent = result.message || 'We couldn’t send your message. Please try WhatsApp.';
      if (response.status === 403) {
        form.elements.token.value = '';
        status.textContent += ' Close and reopen this form to try again.';
      }
    } else {
      form.reset();
      status.textContent = 'Thanks! Your enquiry has been submitted. We’ll be in touch.';
    }
  } catch {
    status.textContent = 'We couldn’t confirm your message was sent. Please try WhatsApp.';
  } finally {
    loading = false;
    submit.disabled = !form.elements.token.value;
  }
});
