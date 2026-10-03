chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "downloadVideo") {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename || "video.mp4",
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true; // Indicates asynchronous response
  }
});
