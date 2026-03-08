import { useMusic } from '../contexts/MusicContext'
import { useEffect } from 'react'

// Sample tracks - you can add your own music URLs here
const SAMPLE_TRACKS = [
  {
    id: 'sample-1',
    title: 'Summer Vibes',
    artist: 'Sample Artist',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'sample-2',
    title: 'Sunset Boulevard',
    artist: 'Sample Artist',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 'sample-3',
    title: 'Urban Beats',
    artist: 'Sample Artist',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
]

export function MusicInitializer() {
  const { tracks, addTrack } = useMusic()

  useEffect(() => {
    // Load sample tracks on first load if no tracks exist
    if (tracks.length === 0) {
      SAMPLE_TRACKS.forEach(track => addTrack(track))
    }
  }, [])

  return null
}
