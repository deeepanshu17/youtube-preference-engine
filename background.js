// Background Service Worker for YouTube Recommendation Explainer
const DEBUG = true;

chrome.runtime.onInstalled.addListener(() => {
    if (DEBUG) console.log("[YRE] Extension installed.");
});

// Since YouTube is an SPA, listening to URL changes can be helpful to trigger checks
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.url.includes("youtube.com")) {
        // Send a message to the content script that the URL changed
        chrome.tabs.sendMessage(details.tabId, { type: "URL_CHANGED", url: details.url }).catch(err => {
            // Ignored: content script might not be fully injected yet
        });
    }
});
