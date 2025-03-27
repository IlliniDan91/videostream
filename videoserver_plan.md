# Project: Local Media Streaming - Fedora Linux

**Goal:** Create a functional prototype for local media streaming using Fedora Linux.

**UI:** Basic – Focus on core functionality.

**Dependencies:**

*   Node.js & npm
*   Fedora Linux (with access to terminal)
*   `ffmpeg` (Installed via `sudo dnf install ffmpeg`)
*   HLS.js

**I. Setup & Dependencies**

1.  **Node.js & npm:** Ensure Node.js and npm are installed. Download from [https://nodejs.org/](https://nodejs.org/).

2.  **Project Directory:** Create a new directory for the project (e.g., `local-media-stream`).

3.  **Initialize npm:** Navigate to the project directory in your terminal and run `npm init -y`.

4.  **Install Dependencies:**
    *   `npm install express`
    *   `npm install hls` (for HLS.js)

5.  **`ffmpeg` Installation:**
    *   Open a terminal in Fedora.
    *   Run `sudo dnf install ffmpeg` to install the `ffmpeg` package.

**II. Directory Browsing Implementation**

1.  **File System Scanning:**
    *   Use Node.js’s `fs.readdir()` function to scan the specified directory.
    *   The UI will present a dropdown menu populated with the scanned directory names.
    *   Store the selected directory path in a variable (e.g., `selectedDirectory`).

2.  **UI for Directory Selection:**
    *   Create a basic HTML form with a dropdown menu populated with the scanned directory names.
    *   The user selects a directory from the dropdown.

**III. HLS Streaming Implementation**

1.  **`ffmpeg` Conversion:**
    *   Use `ffmpeg` to convert the selected media file into HLS chunks.
    *   The command should look something like this (adjust paths as needed):
        `ffmpeg -i /path/to/your/movie.mp4 -c:v libx264 -c:a aac -f hls /path/to/output/stream.m3u8`
        *   `-i`: Input file
        *   `-c:v`: Video codec (libx264 is a common choice)
        *   `-c:a`: Audio codec (aac)
        *   `-f hls`: Output format (HLS)
        *   `/path/to/output/stream.m3u8`: Output HLS manifest file.

2.  **HLS.js Integration:**
    *   Include HLS.js in your HTML file: `<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>` (Use a CDN for simplicity).
    *   Create an HLS player element in your HTML: `<video id="hlsPlayer" controls autoplay></video>`
    *   Use HLS.js to stream the HLS manifest file (`stream.m3u8`) to the video element:
        ```javascript
        const hls = new Hls();
        hls.loadSource('stream.m3u8');
        hls.onPlay(() => {
          console.log('HLS stream started');
        });
        ```

**IV. Basic HTML Structure (Example)**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Local Media Streaming</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <h1>Local Media Streaming</h1>

  <select id="directorySelect">
    <!-- Directory options will be populated here -->
  </select>

  <video id="hlsPlayer" controls autoplay></video>

  <script>
    // JavaScript code for directory selection and HLS streaming
  </script>
</body>
</html>