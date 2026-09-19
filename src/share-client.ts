/** Progressive enhancement only: no network calls and no stored sharing events. */
export const SHARE_JS = `
for (const panel of document.querySelectorAll('[data-share]')) {
  const status = panel.querySelector('[role=status]');
  const copy = panel.querySelector('[data-share-copy]');
  const native = panel.querySelector('[data-share-native]');
  copy.addEventListener('click', async () => {
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(panel.dataset.shareUrl);
      status.textContent = panel.dataset.copied;
    } catch {
      status.textContent = panel.dataset.copyFailed;
      const field = panel.querySelector('.share-url');
      field.focus(); field.select();
    }
  });
  copy.hidden = false;
  if (typeof navigator.share === 'function') {
    native.addEventListener('click', async () => {
      status.textContent = '';
      try {
        await navigator.share({ title: panel.dataset.shareTitle, text: panel.dataset.shareText, url: panel.dataset.shareUrl });
      } catch (error) {
        if (error?.name !== 'AbortError') status.textContent = panel.dataset.shareFailed;
      } finally { native.focus(); }
    });
    native.hidden = false;
  }
}
`;
