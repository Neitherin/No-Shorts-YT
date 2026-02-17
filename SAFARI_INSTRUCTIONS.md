# How to Install on Safari (Mac / iOS)

Since this extension is cross-browser compatible (Manifest V3), you can easily convert it for Safari using Xcode on a Mac.

## Prerequisites
- A Mac computer
- Xcode (free from the App Store)

## Instructions

1.  **Clone this repository** to your Mac.
2.  Open **Terminal** on your Mac.
3.  Navigate to the folder containing this extension.
4.  Run the following command:
    ```bash
    xcrun safari-web-extension-converter .
    ```
5.  **Xcode will open** a new project.
    - Confirm the conversion if prompted.
6.  **Run the App:**
    - Click the **Play** button in Xcode (or press `Cmd + R`).
    - This will build and launch the "No Shorts YT" app.
7.  **Enable in Safari:**
    - Open Safari.
    - Go to **Settings > Extensions**.
    - Check the box for "No Shorts YT".

## Note for iOS
To run on iPhone/iPad, you need to select the iOS target in the Xcode project created in step 5, and build it to your device (requires connecting your device or using a Simulator).
