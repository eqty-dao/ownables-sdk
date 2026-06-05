## A Guide for Devs and Builders: Working with Ownables

As the Ownables ecosystem grows, the need for robust tooling and clear developer guidelines becomes essential. This guide walks you through how to structure and send Ownables using the SDK and Hub infrastructure.

If you're building Ownables or integrating them into your app, this guide is for you.

---

### 🔧 Structuring Your Ownable Message

Each Ownable is packaged and transferred through Hub. The SDK uploads the package to Hub and asks Hub to replay the package so owner state and availability notifications are updated.

To ensure your Ownable can be **previewed before download**, you should include a **`thumbnail.webp`** file inside the Ownable zip package.

#### 📸 Thumbnail Guidelines:

- File name must be: `thumbnail.webp`
- Maximum file size: **256 KB**
- Format: `.webp` (required)
- This preview is used by clients to render a quick snapshot of the Ownable before the user chooses to download it.

> **Note**: In the official SDK, thumbnail resizing is handled automatically when you initiate a transfer. However, in custom apps, you may need to handle resizing manually depending on your use case.

---

### 🚀 Sending Ownables

Ownables can be sent between wallets through Hub, which supports:

- File previews (when `thumbnail.webp` is present)
- Hub-side Ownable package storage and download
- Owner-state replay for availability notifications

Make sure your message includes the structured Ownable zip with any required metadata or signature files as per the Ownables spec.

---

### ✅ Quick Checklist for App Integrators:

- [ ] Package your Ownable as a `.zip` file
- [ ] Include `thumbnail.webp` (≤ 256 KB)
- [ ] Use SDK for automatic resizing, or implement your own
- [ ] Send the package using the Hub transfer flow
- [ ] Handle preview rendering on the recipient side

---

### 📚 More Resources

- [Ownables Docs](https://docs.ltonetwork.com/ownables/what-are-ownables)
- [Ownables SDK on GitHub](https://github.com/eqty-dao/ownables-sdk)
- [Examples and Demos](https://demo.ownables.info)
