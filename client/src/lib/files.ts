import { api, resolveUrl } from './api';

/**
 * Asks the API for a short-lived signed URL (the API checks ownership first), then opens or downloads it.
 * A blank tab is opened synchronously so popup blockers allow it, then pointed at the signed URL.
 */
export async function openResume(id: string, disposition: 'inline' | 'attachment') {
  const popup = disposition === 'inline' ? window.open('', '_blank') : null;
  try {
    const { data } = await api<{ url: string; filename: string }>(`/resumes/${id}/download`, { query: { disposition } });
    const url = resolveUrl(data.url);
    if (disposition === 'inline') {
      if (popup) {
        popup.opener = null;
        popup.location.href = url;
      } else {
        window.location.assign(url);
      }
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } catch (err) {
    popup?.close();
    throw err;
  }
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
