import React, { useCallback, useEffect, useRef, useState } from 'react';

interface VoiceInputProps {
  onSubmit: (utterance: string) => void;
}

type SpeechRecognitionType =
  | (Window & typeof globalThis & { webkitSpeechRecognition?: any })['SpeechRecognition']
  | (Window & typeof globalThis & { webkitSpeechRecognition?: any })['webkitSpeechRecognition']
  | undefined;

const hasBrowserSpeech = (): boolean => {
  return typeof window !== 'undefined' &&
    (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));
};

export const VoiceInput: React.FC<VoiceInputProps> = ({ onSubmit }) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  useEffect(() => {
    setIsSupported(hasBrowserSpeech());

    if (!hasBrowserSpeech()) return;

    // Lazily create recognition instance
    const SpeechRecognitionCtor: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setText(transcript);
      onSubmit(transcript);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [onSubmit]);

  const handleToggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [isListening]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
    },
    [onSubmit, text]
  );

  return (
    <form onSubmit={handleSubmit} className="section-spacing">
      <div className="input-shell">
        <label className="field-label">
          Describe the skill session you want
        </label>
        <textarea
          placeholder="Example: I need a Cardano smart contract mentor for 1 hour, under 80 ADA."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="action-row">
          <div className="row">
            <span className="small-muted">
              SkillForge parses your intent into skill, budget, and duration.
            </span>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleToggleListening}
              disabled={!isSupported}
            >
              {isListening && <span className="voice-indicator" />}
              {isSupported ? (isListening ? 'Listening…' : 'Speak intent') : 'Voice unavailable'}
            </button>
            <button type="submit" className="btn btn-primary">
              Match providers
            </button>
          </div>
        </div>
        {!isSupported && (
          <p className="small-muted">
            Your browser does not expose the Web Speech API. You can still type your intent above.
          </p>
        )}
      </div>
    </form>
  );
};

export default VoiceInput;


