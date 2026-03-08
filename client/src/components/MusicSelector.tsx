import { useMusic } from '../contexts/MusicContext'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Music, Trash2, Plus } from 'lucide-react'
import { useState } from 'react'

export function MusicSelector() {
  const { tracks, currentTrack, setCurrentTrack, addTrack, removeTrack } = useMusic()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', artist: '', url: '' })

  const handleAddTrack = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.title && formData.artist && formData.url) {
      addTrack({
        id: `track-${Date.now()}`,
        title: formData.title,
        artist: formData.artist,
        url: formData.url,
      })
      setFormData({ title: '', artist: '', url: '' })
      setShowForm(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              Music Library
            </CardTitle>
            <CardDescription>
              {tracks.length} track{tracks.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Music
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add Music Form */}
        {showForm && (
          <form onSubmit={handleAddTrack} className="space-y-3 p-4 bg-muted rounded-lg">
            <div>
              <label className="text-sm font-medium">Song Title</label>
              <input
                type="text"
                placeholder="Enter song title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Artist</label>
              <input
                type="text"
                placeholder="Enter artist name"
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL</label>
              <input
                type="url"
                placeholder="https://example.com/song.mp3"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1">
                Add Track
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Tracks List */}
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tracks yet. Add one to get started!
          </p>
        ) : (
          <div className="space-y-2">
            {tracks.map((track) => (
              <div
                key={track.id}
                onClick={() => setCurrentTrack(track)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  currentTrack?.id === track.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-muted border-border hover:bg-muted/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTrack(track.id)
                    }}
                    className="ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
