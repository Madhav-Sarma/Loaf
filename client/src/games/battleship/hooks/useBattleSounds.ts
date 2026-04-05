import { useCallback, useRef } from 'react'

import type { SoundCue } from '../types'

interface ToneConfig {
  frequency: number
  durationMs: number
  gain: number
  type: OscillatorType
}

function scheduleTone(
  context: AudioContext,
  config: ToneConfig,
  offsetSeconds = 0
): void {
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.type = config.type
  oscillator.frequency.setValueAtTime(
    config.frequency,
    context.currentTime + offsetSeconds
  )

  gainNode.gain.setValueAtTime(0.0001, context.currentTime + offsetSeconds)
  gainNode.gain.exponentialRampToValueAtTime(
    config.gain,
    context.currentTime + offsetSeconds + 0.01
  )
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + offsetSeconds + config.durationMs / 1000
  )

  oscillator.connect(gainNode)
  gainNode.connect(context.destination)

  oscillator.start(context.currentTime + offsetSeconds)
  oscillator.stop(context.currentTime + offsetSeconds + config.durationMs / 1000)
}

export function useBattleSounds() {
  const audioContextRef = useRef<AudioContext | null>(null)

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext

      if (!AudioContextConstructor) {
        return null
      }

      audioContextRef.current = new AudioContextConstructor()
    }

    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume()
      } catch {
        return null
      }
    }

    return audioContextRef.current
  }, [])

  const playCue = useCallback(
    async (cue: SoundCue) => {
      const context = await ensureAudioContext()
      if (!context) {
        return
      }

      if (cue === 'hit') {
        scheduleTone(context, {
          frequency: 280,
          durationMs: 120,
          gain: 0.06,
          type: 'triangle',
        })
        scheduleTone(
          context,
          {
            frequency: 420,
            durationMs: 130,
            gain: 0.04,
            type: 'triangle',
          },
          0.07
        )
        return
      }

      if (cue === 'miss') {
        scheduleTone(context, {
          frequency: 180,
          durationMs: 180,
          gain: 0.045,
          type: 'sine',
        })
        return
      }

      if (cue === 'sunk') {
        scheduleTone(context, {
          frequency: 210,
          durationMs: 130,
          gain: 0.065,
          type: 'square',
        })
        scheduleTone(
          context,
          {
            frequency: 140,
            durationMs: 200,
            gain: 0.05,
            type: 'sawtooth',
          },
          0.1
        )
        return
      }

      if (cue === 'win') {
        scheduleTone(context, {
          frequency: 350,
          durationMs: 140,
          gain: 0.06,
          type: 'triangle',
        })
        scheduleTone(
          context,
          {
            frequency: 470,
            durationMs: 160,
            gain: 0.06,
            type: 'triangle',
          },
          0.12
        )
        scheduleTone(
          context,
          {
            frequency: 620,
            durationMs: 180,
            gain: 0.06,
            type: 'triangle',
          },
          0.26
        )
        return
      }

      scheduleTone(context, {
        frequency: 230,
        durationMs: 220,
        gain: 0.045,
        type: 'sawtooth',
      })
      scheduleTone(
        context,
        {
          frequency: 150,
          durationMs: 260,
          gain: 0.04,
          type: 'sine',
        },
        0.15
      )
    },
    [ensureAudioContext]
  )

  return {
    playCue,
  }
}
