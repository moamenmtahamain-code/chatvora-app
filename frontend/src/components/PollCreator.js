'use client';

import { useState } from 'react';
import { FiX, FiPlus, FiBarChart2 } from 'react-icons/fi';
import { premiumAPI } from '../lib/api';

export default function PollCreator({ conversationId, onCreated, onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const removeOption = (i) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i, val) => {
    const updated = [...options];
    updated[i] = val;
    setOptions(updated);
  };

  const handleSubmit = async () => {
    if (!question.trim() || options.filter(o => o.trim()).length < 2) return;
    setIsSubmitting(true);
    try {
      const res = await premiumAPI.createPoll({
        conversationId,
        question: question.trim(),
        options: options.filter(o => o.trim()).map(text => ({ text: text.trim() }))
      });
      onCreated?.(res.data);
      onClose();
    } catch (err) {
      console.error('Poll creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="poll-creator">
      <div className="poll-creator-header">
        <FiBarChart2 size={20} />
        <h4>Create Poll</h4>
        <button className="poll-close-btn" onClick={onClose}><FiX /></button>
      </div>

      <input
        className="poll-question-input"
        placeholder="Ask a question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={200}
      />

      <div className="poll-options-list">
        {options.map((opt, i) => (
          <div key={i} className="poll-option-row">
            <span className="poll-option-number">{i + 1}</span>
            <input
              className="poll-option-input"
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              maxLength={100}
            />
            {options.length > 2 && (
              <button className="poll-remove-btn" onClick={() => removeOption(i)}>
                <FiX size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {options.length < 10 && (
        <button className="poll-add-option" onClick={addOption}>
          <FiPlus size={14} /> Add option
        </button>
      )}

      <button
        className="poll-submit-btn"
        onClick={handleSubmit}
        disabled={!question.trim() || options.filter(o => o.trim()).length < 2 || isSubmitting}
      >
        {isSubmitting ? 'Creating...' : 'Create Poll'}
      </button>
    </div>
  );
}