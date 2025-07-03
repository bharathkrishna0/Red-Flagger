

# 🔴 Website Red Flagger – Chrome Extension

**Website Red Flagger** is a simple and powerful Chrome Extension that automatically detects scam or malicious websites using the [danwand.in scam check API](https://scam.danwand.in/api/check) and immediately alerts the user.

> 🛡️ **Stay safe while browsing the web!**

---

## 🚀 Features

* ✅ Automatically scans the current website on page load
* ⚠️ Displays a clear alert if the website is a **known scam**
* 🌐 Lightweight and fast – no external libraries
* 🧩 Easy to install, use, and extend

---

## 🛠️ Installation

1. Clone or download this repository.
2. Open Chrome and go to: `chrome://extensions/`
3. Enable **Developer Mode** (toggle in top-right corner).
4. Click **"Load unpacked"** and select the extension folder.
5. Done! The extension will now scan every site you visit.

---

## 📂 Project Structure

```
website-red-flagger/
├── manifest.json
├── content.js
├── icon.png
└── README.md
```

---




## 🧪 API Reference

* **POST** `https://scam.danwand.in/api/check`
* **Body:**

```json
{ "url": "https://example.com" }
```

* **Response:**

```json
{ "scam": true }
```

---



## 🙌 Credits

* API by [danwand.in](https://scam.danwand.in)


