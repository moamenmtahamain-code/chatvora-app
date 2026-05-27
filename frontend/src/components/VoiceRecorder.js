'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMic, FiTrash2, FiSend, FiX, FiPlay, FiPause, FiClock } from 'react-icons/fi';
import { uploadAPI } from '../lib/api';

export default function VoiceRecorder({ onSend, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [waveformData, setWaveformData] = useState([]);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
  };

  const startRecording = async () => {
    try {
      setError(null);
      chunksRef.current = [];
      setDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      drawWaveform();
    } catch (e) {
      setError('Microphone access denied');
      console.error('[VoiceRecorder] Start failed:', e);
    }
  };

  const drawWaveform = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      const normalized = Array.from(dataArray).slice(0, 40).map(v => v / 255);
      setWaveformData(normalized);
      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !recordedUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = recordedUrl;
      audioRef.current.play();
      setIsPlaying(true);
      audioRef.current.onended = () => setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    cleanup();
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setWaveformData([]);
  };

  const sendRecording = async () => {
    if (!recordedBlob) return;
    setIsUploading(true);
    try {
      const file = new File([recordedBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const response = await uploadAPI.single(file);
      const media = {
        url: response.data.url,
        filename: response.data.filename,
        size: response.data.size,
        mimeType: response.data.mimeType,
        type: 'audio'
      };
      onSend(media, duration);
      cleanup();
      setRecordedBlob(null);
      setRecordedUrl(null);
      setDuration(0);
      setWaveformData([]);
    } catch (e) {
      setError('Upload failed');
      console.error('[VoiceRecorder] Upload error:', e);
    }
    setIsUploading(false);
  };

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      className="voice-recorder"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="voice-recorder-inner">
        {error && (
          <div className="voice-recorder-error">
            <span>{error}</span>
            <button onClick={() => setError(null)}><FiX /></button>
          </div>
        )}

        {!isRecording && !recordedBlob ? (
          <button
            className="voice-record-btn"
            onMouseDown={startRecording}
            onTouchStart={startRecording}
          >
            <div className="voice-record-ring" />
            <FiMic size={24} />
          </button>
        ) : isRecording ? (
          <div className="voice-recording-active">
            <div className="voice-waveform">
              {waveformData.map((val, i) => (
                <div
                  key={i}
                  className="voice-waveform-bar"
                  style={{ height: `${Math.max(4, val * 48)}px` }}
                />
              ))}
            </div>
            <div className="voice-recording-status">
              <div className="voice-recording-dot" />
              <span className="voice-recording-duration">
                {formatDuration(duration)}
              </span>
            </div>
            <div className="voice-recording-actions">
              <button className="voice-action-btn danger" onClick={deleteRecording}>
                <FiTrash2 />
              </button>
              <button
                className="voice-action-btn primary"
                onMouseUp={stopRecording}
                onTouchEnd={stopRecording}
                onMouseLeave={stopRecording}
              >
                <FiSend />
              </button>
            </div>
          </div>
        ) : (
          <div className="voice-recorded-preview">
            <div className="voice-waveform-playback">
              <button className="voice-playback-toggle" onClick={togglePlayback}>
                {isPlaying ? <FiPause /> : <FiPlay />}
              </button>
              <div className="voice-waveform-bars">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className={`voice-waveform-bar ${isPlaying ? 'playing' : ''}`}
                    style={{
                      height: `${Math.max(4, Math.sin(i * 0.3 + (isPlaying ? Date.now() * 0.005 : 0)) * 24 + 24)}px`,
                      animationDelay: `${i * 0.05}s`
                    }}
                  />
                ))}
              </div>
              <span className="voice-recording-duration">{formatDuration(duration)}</span>
            </div>
            <div className="voice-recorded-actions">
              <button className="voice-action-btn danger" onClick={deleteRecording}>
                <FiTrash2 />
              </button>
              <button
                className="voice-action-btn primary"
                onClick={sendRecording}
                disabled={isUploading}
              >
                {isUploading ? <span className="voice-spinner" /> : <FiSend />}
              </button>
            </div>
          </div>
        )}
      </div>

      <audio ref={audioRef} hidden />
    </motion.div>
  );
}
