import { apiClient } from './auth';

export function validateDocumentFile(file, testbank = false) {
  if (!file) throw new Error('Select a file.');
  const allowed = testbank ? ['pdf', 'docx', 'txt'] : ['pdf', 'docx', 'pptx', 'txt'];
  const extension = file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(extension)) throw new Error(`Supported formats: ${allowed.join(', ')}.`);
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Choose a non-empty file up to 20 MB.');
}

export async function openDocument(doc) {
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  try {
    const { url } = await apiClient.get(`/api/documents/${doc.id}/download-url`);
    if (popup) popup.location.href = url;
    else window.location.assign(url);
  } catch (error) {
    popup?.close();
    alert(error.message || 'Download unavailable. Please retry.');
  }
}
