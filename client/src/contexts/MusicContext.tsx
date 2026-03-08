import { createContext, useContext, useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

interface Track {
  id: string
  title: string
  artist: string
  url: string
  duration?: number
}

interface MusicContextType {
  currentTrack: Track | null
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  tracks: Track[]
  setCurrentTrack: (track: Track) => void
  togglePlay: () => void
  setVolume: (volume: number) => void
  setCurrentTime: (time: number) => void
  addTrack: (track: Track) => void
  removeTrack: (trackId: string) => void
  nextTrack: () => void
  previousTrack: () => void
}

const MusicContext = createContext<MusicContextType | undefined>(undefined)

export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTrack, setCurrentTrackState] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [tracks, setTracks] = useState<Track[]>([])

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.volume = volume
    }
  }, [])

  // Update audio src when track changes
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.src = currentTrack.url
      if (isPlaying) {
        audioRef.current.play().catch(err => console.error('Play error:', err))
      }
    }
  }, [currentTrack])

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return

    if (isPlaying) {
      audioRef.current.play().catch(err => console.error('Play error:', err))
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying, currentTrack])

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  // Handle seeking
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = currentTime
    }
  }, [currentTime])

  // Listen to audio element events
  useEffect(() => {
    if (!audioRef.current) return

    const handleTimeUpdate = () => {
      setCurrentTime(audioRef.current?.currentTime ?? 0)
    }

    const handleLoadedMetadata = () => {
      setDuration(audioRef.current?.duration ?? 0)
    }

    const handleEnded = () => {
      nextTrack()
    }

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate)
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
    audioRef.current.addEventListener('ended', handleEnded)

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate)
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audioRef.current.removeEventListener('ended', handleEnded)
      }
    }
  }, [])

  const setCurrentTrack = (track: Track) => {
    setCurrentTrackState(track)
    setCurrentTime(0)
    setIsPlaying(true)
  }

  const togglePlay = () => {
    if (!currentTrack) return
    setIsPlaying(!isPlaying)
  }

  const nextTrack = () => {
    if (!currentTrack || tracks.length === 0) return
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id)
    const nextIndex = (currentIndex + 1) % tracks.length
    setCurrentTrack(tracks[nextIndex])
  }

  const previousTrack = () => {
    if (!currentTrack || tracks.length === 0) return
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id)
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length
    setCurrentTrack(tracks[prevIndex])
  }

  const addTrack = (track: Track) => {
    setTracks(prev => {
      const exists = prev.some(t => t.id === track.id)
      return exists ? prev : [...prev, track]
    })
  }

  const removeTrack = (trackId: string) => {
    setTracks(prev => prev.filter(t => t.id !== trackId))
    if (currentTrack?.id === trackId) {
      setCurrentTrackState(null)
      setIsPlaying(false)
    }
  }

  const value: MusicContextType = {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    tracks,
    setCurrentTrack,
    togglePlay,
    setVolume,
    setCurrentTime,
    addTrack,
    removeTrack,
    nextTrack,
    previousTrack,
  }

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  )
}

export function useMusic() {
  const context = useContext(MusicContext)
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider')
  }
  return context
}
