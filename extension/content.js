const HOST_NAME = 'com.linkfetcher.app';
const URL_RE = /^https?:\/\/[^\s<>"{}|\\^`\[\]]+$/i;

function getSelectedText() {
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : '';
}

function handleCopy() {
  const text = getSelectedText();
  if (text && URL_RE.test(text)) {
    chrome.runtime.sendNativeMessage(HOST_NAME, { type: 'url-detected', url: text }).catch(() => {});
    return;
  }

  setTimeout(() => {
    navigator.clipboard.readText().then((clip) => {
      if (clip && URL_RE.test(clip)) {
        chrome.runtime.sendNativeMessage(HOST_NAME, { type: 'url-detected', url: clip }).catch(() => {});
      }
    }).catch(() => {});
  }, 50);
}

document.addEventListener('copy', handleCopy, true);