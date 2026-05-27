'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiFile, FiImage, FiVideo, FiMusic, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { uploadAPI } from '../lib/api';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'video/*': ['.mp4', '.webm'],
  'audio/*': ['.mp3', '.wav', '.ogg'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt']
};

export default function FileUploader({ onSend, onClose }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const file = rejectedFiles[0];
      if (file.errors[0]?.code === 'file-too-large') {
        alert('File too large. Maximum 50MB.');
      }
      return;
    }
    setFiles(prev => [...prev, ...acceptedFiles.map(f => Object.assign(f, {
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      id: Math.random().toString(36)
    }))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 10
  });

  const removeFile = (id) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return <FiImage />;
    if (type.startsWith('video/')) return <FiVideo />;
    if (type.startsWith('audio/')) return <FiMusic />;
    return <FiFile />;
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const response = await uploadAPI.single(file);
        const media = {
          url: response.data.url,
          filename: response.data.filename,
          size: response.data.size,
          mimeType: response.data.mimeType,
          type: response.data.type
        };
        const msgType = response.data.type === 'image' ? 'image'
          : response.data.type === 'video' ? 'video'
          : response.data.type === 'audio' ? 'audio'
          : 'document';
        onSend(msgType, media);
        setUploadProgress(((i + 1) / files.length) * 100);
      } catch (e) {
        console.error('[FileUploader] Upload error:', e);
      }
    }

    setFiles([]);
    setUploading(false);
    setUploadProgress(0);
    if (onClose) onClose();
  };

  return (
    <motion.div
      className="file-uploader-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="file-uploader-modal"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
      >
        <div className="file-uploader-header">
          <h3>Send Files</h3>
          <button className="file-uploader-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div
          {...getRootProps()}
          className={`file-uploader-dropzone ${isDragActive ? 'active' : ''}`}
        >
          <input {...getInputProps()} />
          <FiUploadCloud size={48} />
          {isDragActive ? (
            <p>Drop files here...</p>
          ) : (
            <>
              <p>Drag & drop files here</p>
              <span className="file-uploader-hint">or click to browse (up to 50MB)</span>
            </>
          )}
        </div>

        {files.length > 0 && (
          <div className="file-uploader-list">
            {files.map(file => (
              <div key={file.id} className="file-uploader-item">
                <div className="file-uploader-icon">
                  {file.preview ? (
                    <img src={file.preview} alt="Preview" />
                  ) : (
                    getFileIcon(file.type)
                  )}
                </div>
                <div className="file-uploader-info">
                  <span className="file-uploader-name">{file.name}</span>
                  <span className="file-uploader-size">{formatSize(file.size)}</span>
                </div>
                <button className="file-uploader-remove" onClick={() => removeFile(file.id)}>
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="file-uploader-progress">
            <div className="file-uploader-progress-bar">
              <div
                className="file-uploader-progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
        )}

        <div className="file-uploader-actions">
          <button className="file-uploader-cancel" onClick={onClose}>Cancel</button>
          <button
            className="file-uploader-send"
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
          >
            {uploading ? 'Uploading...' : `Send ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
