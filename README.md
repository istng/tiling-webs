# Tiling Webs

A floating, tiling web browser built with Electron. Open any website in a draggable frame — no embedding restrictions. Snap frames to tiles, open links into new frames, and switch between them from a side panel.

## Requirements

- [Node.js](https://nodejs.org) v18+
- [Yarn](https://yarnpkg.com)

## Setup

```bash
yarn
```

## Run

```bash
yarn start
```

## Usage

### Opening frames

- Type a URL in the toolbar and press **Enter** or click **Open**
- Double-click the empty desktop to focus the URL bar

### Navigating within a frame

- Edit the URL bar in the frame's title bar and press **Enter**
- Use **‹** / **›** for back and forward

### Tiling & snapping

Drag a frame by its title bar. As you approach the screen edges, a purple dashed preview shows where it will snap. Release to lock it in.

| Drag toward | Snaps to |
|---|---|
| Left or right edge | Left or right half |
| Top or bottom edge | Top or bottom half |
| Any corner | That quadrant |
| Very top edge (centre) | Full screen |

Snap zones are smart — if the left half is already taken, dragging left offers the free quarter instead.

### Opening links in new frames

| Action | Result |
|---|---|
| **Ctrl/Cmd + click** any link | Opens in a new floating frame |
| `target="_blank"` links | Automatically open as new frames |
| `window.open()` calls | Automatically open as new frames |
| **↗ new frame** button | Clones the current frame's URL |

### Window list

Click **≡** in the toolbar (or press **⌘L** / **Ctrl+L**) to open the frame list. It shows every open frame with its title and favicon. Click an item to focus it; click **×** to close it.

### Resizing

Drag the bottom-right corner handle of any frame to resize it.

### Closing a frame

Click the red dot (●) in the frame's title bar, or close it from the window list.
