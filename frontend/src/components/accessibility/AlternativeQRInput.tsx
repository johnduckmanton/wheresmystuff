import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
} from '@mui/material';
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  QrCode as QrCodeIcon,
  Keyboard as KeyboardIcon,
  VolumeUp as VolumeUpIcon,
} from '@mui/icons-material';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface AlternativeQRInputProps {
  onQRCodeEntered: (qrCode: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

/**
 * Alternative QR Code Input Methods
 * Provides manual entry and voice input as alternatives to camera scanning
 * Validates: Requirements 13.3, 13.5
 */
export default function AlternativeQRInput({
  onQRCodeEntered,
  onError,
  disabled = false,
}: AlternativeQRInputProps) {
  const { announceToScreenReader } = useAccessibility();
  const [inputMethod, setInputMethod] = useState<'manual' | 'voice'>('manual');
  const [manualInput, setManualInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textFieldRef = useRef<HTMLInputElement>(null);

  // Check for voice input support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
        announceToScreenReader('Voice input started. Please speak the QR code.', 'assertive');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const cleanedTranscript = transcript.replace(/\s+/g, '').toUpperCase();
        
        // Validate QR code format
        if (cleanedTranscript.startsWith('CONT_')) {
          setManualInput(cleanedTranscript);
          announceToScreenReader(`QR code captured: ${cleanedTranscript}`, 'polite');
        } else {
          setVoiceError('Please speak a valid QR code starting with "CONT"');
          announceToScreenReader('Invalid QR code format. Please try again.', 'assertive');
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        let errorMessage = 'Voice input error occurred';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone not available. Please check permissions.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone permission denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage = 'Network error. Please check your connection.';
            break;
          default:
            errorMessage = `Voice input error: ${event.error}`;
        }
        
        setVoiceError(errorMessage);
        announceToScreenReader(errorMessage, 'assertive');
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [announceToScreenReader]);

  const handleManualSubmit = () => {
    const trimmedInput = manualInput.trim();
    
    if (!trimmedInput) {
      onError('Please enter a QR code');
      announceToScreenReader('QR code field is empty', 'assertive');
      textFieldRef.current?.focus();
      return;
    }

    // Basic QR code validation
    if (!trimmedInput.startsWith('CONT_')) {
      onError('QR code must start with "CONT_"');
      announceToScreenReader('Invalid QR code format', 'assertive');
      textFieldRef.current?.focus();
      return;
    }

    onQRCodeEntered(trimmedInput);
    announceToScreenReader('QR code submitted successfully', 'polite');
  };

  const startVoiceInput = () => {
    if (!recognitionRef.current || isListening) return;

    try {
      recognitionRef.current.start();
    } catch (error) {
      setVoiceError('Failed to start voice input. Please try again.');
      announceToScreenReader('Failed to start voice input', 'assertive');
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const speakInstructions = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        'To enter a QR code manually, type or paste the code in the text field. ' +
        'QR codes start with "CONT" followed by an underscore and additional characters. ' +
        'For voice input, click the microphone button and speak the QR code clearly.'
      );
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !disabled) {
      handleManualSubmit();
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Instructions */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Alternative methods to enter QR codes when camera scanning is not available
        </Typography>
        <Tooltip title="Listen to instructions">
          <IconButton
            onClick={speakInstructions}
            size="small"
            aria-label="Listen to instructions for QR code input"
          >
            <VolumeUpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Input Method Selection */}
      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <FormLabel component="legend">Input Method</FormLabel>
        <RadioGroup
          value={inputMethod}
          onChange={(e) => setInputMethod(e.target.value as 'manual' | 'voice')}
          row
          sx={{ mt: 1 }}
        >
          <FormControlLabel
            value="manual"
            control={<Radio />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <KeyboardIcon fontSize="small" />
                Manual Entry
              </Box>
            }
          />
          <FormControlLabel
            value="voice"
            control={<Radio />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MicIcon fontSize="small" />
                Voice Input
              </Box>
            }
            disabled={!voiceSupported}
          />
        </RadioGroup>
      </FormControl>

      <Divider sx={{ mb: 3 }} />

      {/* Manual Input */}
      {inputMethod === 'manual' && (
        <Box>
          <TextField
            ref={textFieldRef}
            fullWidth
            label="QR Code"
            placeholder="CONT_abc123_1234567890_xyz"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            multiline
            rows={3}
            helperText="Enter the complete QR code. QR codes start with 'CONT_' followed by container information."
            InputProps={{
              'aria-describedby': 'qr-input-help',
            }}
            sx={{ mb: 2 }}
          />
          
          <Typography
            id="qr-input-help"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
          >
            Example format: CONT_abc123_1234567890_xyz
          </Typography>

          <Button
            variant="contained"
            onClick={handleManualSubmit}
            disabled={disabled || !manualInput.trim()}
            startIcon={<QrCodeIcon />}
            fullWidth
            sx={{ minHeight: 48 }}
          >
            Submit QR Code
          </Button>
        </Box>
      )}

      {/* Voice Input */}
      {inputMethod === 'voice' && (
        <Box>
          {!voiceSupported ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Voice input is not supported in your browser. Please use manual entry instead.
            </Alert>
          ) : (
            <>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <IconButton
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  disabled={disabled}
                  size="large"
                  sx={{
                    width: 80,
                    height: 80,
                    backgroundColor: isListening ? 'error.main' : 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: isListening ? 'error.dark' : 'primary.dark',
                    },
                    '&:disabled': {
                      backgroundColor: 'action.disabled',
                    },
                  }}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                >
                  {isListening ? <MicOffIcon fontSize="large" /> : <MicIcon fontSize="large" />}
                </IconButton>
                
                <Typography variant="body2" sx={{ mt: 2 }}>
                  {isListening ? 'Listening... Speak the QR code clearly' : 'Click to start voice input'}
                </Typography>
              </Box>

              {voiceError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {voiceError}
                </Alert>
              )}

              {manualInput && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Captured QR Code:
                  </Typography>
                  <TextField
                    fullWidth
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    disabled={disabled}
                    multiline
                    rows={2}
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleManualSubmit}
                    disabled={disabled}
                    startIcon={<QrCodeIcon />}
                    fullWidth
                    sx={{ minHeight: 48 }}
                  >
                    Submit QR Code
                  </Button>
                </Box>
              )}

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Voice Input Tips:</strong>
                  <br />
                  • Speak clearly and at a normal pace
                  <br />
                  • Say each character separately for best results
                  <br />
                  • Example: "C-O-N-T underscore A-B-C-1-2-3..."
                  <br />
                  • You can edit the captured text before submitting
                </Typography>
              </Alert>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}