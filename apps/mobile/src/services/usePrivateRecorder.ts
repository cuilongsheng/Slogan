import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { privateClipFromUri } from './privateClip';
import type { PrivateClip } from './privateClip.types';

export function usePrivateRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [clip, setClip] = useState<PrivateClip | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clipRef = useRef<PrivateClip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopping = useRef<Promise<PrivateClip | null> | null>(null);

  const discard = useCallback(() => {
    clipRef.current?.release();
    clipRef.current = null;
    setClip(null);
  }, []);

  const stop = useCallback(async (): Promise<PrivateClip | null> => {
    if (stopping.current) return stopping.current;
    stopping.current = (async () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (!recorder.isRecording) return null;
      try { await recorder.stop(); }
      finally {
        setRecording(false);
        await setAudioModeAsync({ allowsRecording: false });
      }
      if (!recorder.uri) throw new Error('PRIVATE_AUDIO_UNAVAILABLE');
      const next = await privateClipFromUri(recorder.uri);
      if (next.size !== null && next.size > 5 * 1024 * 1024) {
        next.release();
        throw new Error('PRIVATE_AUDIO_TOO_LARGE');
      }
      clipRef.current?.release();
      clipRef.current = next;
      setClip(next);
      return next;
    })();
    try { return await stopping.current; } finally { stopping.current = null; }
  }, [recorder]);

  const start = useCallback(async () => {
    discard();
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) throw new Error('PRIVATE_AUDIO_PERMISSION_DENIED');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      timer.current = setTimeout(() => { void stop().catch(() => setError('PRIVATE_AUDIO_UNAVAILABLE')); }, 30000);
    } catch (error) {
      await setAudioModeAsync({ allowsRecording: false });
      throw error;
    }
  }, [discard, recorder, stop]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.isRecording) void recorder.stop();
    void setAudioModeAsync({ allowsRecording: false });
    clipRef.current?.release();
  }, [recorder]);

  return { start, stop, discard, clip, recording, error, elapsedSeconds: Math.min(30, Math.floor(recorderState.durationMillis / 1000)) };
}
