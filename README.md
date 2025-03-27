# Local Media Streaming

A simple web application for streaming local media files using HLS (HTTP Live Streaming).

## Prerequisites

- Node.js and npm
- FFmpeg installed on your system
- A modern web browser that supports HLS.js

## Installation

1. Install FFmpeg (if not already installed):
   ```bash
   sudo dnf install ffmpeg
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Use the interface to:
   - Select a directory from your home folder
   - Choose a video file from the selected directory
   - Click "Start Streaming" to begin playback

## Supported Video Formats

The application supports the following video formats:
- MP4 (.mp4)
- MKV (.mkv)
- AVI (.avi)
- MOV (.mov)
- M4V (.m4v)

## Notes

- The application will scan your home directory for available folders
- Video files are converted to HLS format for streaming
- Streamed videos are temporarily stored in the `streams` directory 