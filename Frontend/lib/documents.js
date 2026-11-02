import { apiClient } from './auth.js';

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

export async function uploadDocument({ file, title, module, userId, testbank = false }) {
  validateDocumentFile(file, testbank);
  if (!module?.name || !userId) throw new Error('Your module or session is unavailable. Refresh this page and try again.');
  const form = new FormData();
  form.append('file', file);
  form.append('title', title?.trim() || file.name);
  form.append('module_name', module.name);
  form.append('teacher_id', userId);
  form.append('is_testbank', String(testbank));
  try {
    return await apiClient.upload('/api/upload', form);
  } catch (error) {
    if (error.status === 401 || /not authenticated|authentication required/i.test(error.message)) {
      throw new Error('Your session has expired. Sign in again, then retry your upload.');
    }
    throw error;
  }
}
