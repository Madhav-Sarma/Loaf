# Music Player Feature Documentation

## Overview
The Loaf app now includes a global music player that's accessible throughout the entire application. Users can add, select, and control music playback from any page.

## Features

### 🎵 Music Player Controls
- **Play/Pause**: Control music playback
- **Previous/Next Track**: Navigate between tracks
- **Volume Control**: Adjust volume with a slider
- **Progress Bar**: Visual representation of track progress
- **Time Display**: Current time and total duration

### 🎧 Music Management
- **Add Música**: Add new tracks via URL
- **Remove Tracks**: Delete tracks from the library
- **Select Tracks**: Click any track to play it
- **Auto-Load Samples**: Sample tracks are automatically loaded on first launch

## Architecture

### Components

#### `MusicContext.tsx`
Global state management for music player functionality.

**Key Functions:**
- `setCurrentTrack(track)` - Set and play a track
- `togglePlay()` - Toggle play/pause
- `setVolume(volume)` - Set volume (0-1)
- `addTrack(track)` - Add track to library
- `removeTrack(trackId)` - Remove track from library
- `nextTrack() / previousTrack()` - Navigate tracks

#### `MusicPlayer.tsx`
Fixed bottom player component with:
- Current track info (title, artist)
- Playback controls
- Volume slider
- Progress bar

#### `MusicSelector.tsx`
Music library manager on home page with:
- Add music form
- Track list
- Delete buttons
- Track selection

#### `MusicInitializer.tsx`
Automatically loads sample tracks on app startup.

## Usage

### Playing Music
1. Navigate to the home page
2. Find "Music Library" section
3. Click any track to play it
4. Use controls in the bottom player

### Adding Music
1. Click "Add Music" button
2. Fill in:
   - **Song Title**: Name of the song
   - **Artist**: Artist name
   - **URL**: Direct link to MP3 file
3. Click "Add Track"

### Removing Music
1. Open Music Library
2. Click the trash icon on any track

### Controlling Playback
- **Play/Pause**: Click the play button
- **Skip**: Use next/previous arrows
- **Volume**: Drag the volume slider
- **Seek**: The progress bar shows position

## Adding Custom Sample Tracks

Edit `src/components/MusicInitializer.tsx`:

```typescript
const SAMPLE_TRACKS = [
  {
    id: 'unique-id',
    title: 'Song Title',
    artist: 'Artist Name',
    url: 'https://example.com/song.mp3',
  },
]
```

## Using Music Context in Components

Access the music player from any component:

```typescript
import { useMusic } from '@/contexts/MusicContext'

export function MyComponent() {
  const { currentTrack, isPlaying, togglePlay } = useMusic()
  
  return (
    <div>
      {currentTrack && <p>{currentTrack.title}</p>}
      <button onClick={togglePlay}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
    </div>
  )
}
```

## Styling

The player uses:
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Theme Toggle** respects dark/light mode
- **Responsive Design** for mobile and desktop

## Browser Compatibility

- Modern browsers with HTML5 Audio support
- Works on mobile devices (iOS/Android)
- Includes PWA support for offline audio

## Future Enhancements

Potential additions:
- Playlist creation
- Shuffle/repeat modes
- Audio visualization
- Equalizer
- Local storage persistence
- Server-side music sync
