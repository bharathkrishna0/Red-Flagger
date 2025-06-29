chrome.runtime.onInstalled.addListener(() => {
  console.log('Scam Detector Extension Installled Buddy');
});
chrome.runtime.onMessage.addListener((message, sender,sendResponse) => {
  if (message.type === 'Page_Analyzed'){
    console.log('Page analysis complete:',message.data);
  }
});
