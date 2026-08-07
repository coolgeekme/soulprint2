export function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => chrome.runtime.sendMessage(message, (response) => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else if (response?.ok === false) reject(new Error(response.error || 'SoulPrint request failed'));
    else resolve(response?.data);
  }));
}
export const getStored = (keys) => chrome.storage.local.get(keys);
export const setStored = (values) => chrome.storage.local.set(values);
