// Copy text for the user. navigator.clipboard only works on https or localhost; VideoHub opened from another PC on
// the network (http://<server-ip>:7788) has no clipboard API, so: the old execCommand copy, and when that fails too
// a dialog with the text selected, for Ctrl+C.
import { h, toast, confirmBox } from './app.js';

function legacyCopy(text) {
  const ta = h('textarea', { readonly: true, style: { position: 'fixed', top: '-1000px', opacity: '0' }, value: text });
  (document.fullscreenElement || document.body).append(ta);
  try { ta.select(); return document.execCommand('copy'); } catch { return false; } finally { ta.remove(); }
}

// true when the text is on the clipboard; false when the user was shown the dialog instead
export async function copyText(text, okMsg = 'Copied', title = 'Copy this text') {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard API');
    await navigator.clipboard.writeText(text); if (okMsg) toast(okMsg); return true;
  } catch { }
  if (legacyCopy(text)) { if (okMsg) toast(okMsg); return true; }
  const ta = h('textarea', { readonly: true, style: { width: '100%', minHeight: '120px' }, value: text });
  const done = confirmBox(title, h('div', {}, h('p', { class: 'dim' }, 'The browser did not allow copying here. Press Ctrl+C (⌘C on a Mac) to copy the selected text.'), ta), 'Done');
  setTimeout(() => { ta.focus(); ta.select(); }, 0);
  await done; return false;
}
