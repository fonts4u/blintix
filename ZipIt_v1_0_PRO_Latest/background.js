chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
    chrome.sidePanel.setOptions({ path: 'popup.html', enabled: true }).catch((error) => console.error(error));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'fetch_asset') {
        fetch(msg.url)
            .then(r => msg.as_text ? r.text() : r.blob())
            .then(data => {
                if (msg.as_text) {
                    sendResponse({ data: data });
                } else {
                    const reader = new FileReader();
                    reader.onload = () => sendResponse({ data: reader.result });
                    reader.onerror = () => sendResponse({ error: true });
                    reader.readAsDataURL(data);
                }
            })
            .catch(() => sendResponse({ error: true }));
        return true; // async
    }
});
