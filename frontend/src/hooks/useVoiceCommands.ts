import { useEffect, useRef, useCallback, useState } from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface VoiceCommand {
  command: string | RegExp;
  action: (matches?: string[]) => void;
  description: string;
}

interface VoiceCommandsOptions {
  enabled?: boolean;
  continuous?: boolean;
  language?: string;
}

/**
 * Hook for voice command recognition
 * Validates: Requirements 13.3, 13.5
 */
export function useVoiceCommands(
  commands: VoiceCommand[],
  options: VoiceCommandsOptions = {}
) {
  const { settings, announceToScreenReader } = useAccessibility();
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { enabled = true, continuous = false, language = 'en-US' } = options;

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = continuous;
      recognition.interimResults = false;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        announceToScreenReader('Voice commands activated', 'polite');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        
        // Find matching command
        const matchedCommand = commands.find(cmd => {
          if (typeof cmd.command === 'string') {
            return transcript.includes(cmd.command.toLowerCase());
          } else {
            return cmd.command.test(transcript);
          }
        });

        if (matchedCommand) {
          let matches: string[] = [];
          if (typeof matchedCommand.command !== 'string') {
            const regexMatch = transcript.match(matchedCommand.command);
            matches = regexMatch ? Array.from(regexMatch) : [];
          }
          
          matchedCommand.action(matches);
          announceToScreenReader(`Command executed: ${matchedCommand.description}`, 'polite');
        } else {
          announceToScreenReader('Command not recognized', 'polite');
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        let errorMessage = 'Voice command error occurred';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone not available';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone permission denied';
            break;
          case 'network':
            errorMessage = 'Network error';
            break;
          default:
            errorMessage = `Voice error: ${event.error}`;
        }
        
        setError(errorMessage);
        announceToScreenReader(errorMessage, 'assertive');
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [commands, continuous, language, announceToScreenReader]);

  const startListening = useCallback(() => {
    if (!enabled || !settings.keyboardNavigation || !recognitionRef.current || isListening) {
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      setError('Failed to start voice recognition');
      announceToScreenReader('Failed to start voice recognition', 'assertive');
    }
  }, [enabled, settings.keyboardNavigation, isListening, announceToScreenReader]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}

/**
 * Hook for common navigation voice commands
 * Validates: Requirements 13.3, 13.5
 */
export function useNavigationVoiceCommands() {
  const { announceToScreenReader } = useAccessibility();

  const commands: VoiceCommand[] = [
    {
      command: /go to (.*)/,
      action: (matches) => {
        if (matches && matches[1]) {
          const destination = matches[1].toLowerCase();
          const routes: Record<string, string> = {
            'home': '/home',
            'containers': '/containers',
            'projects': '/projects',
            'things': '/things',
            'locations': '/locations',
            'categories': '/categories',
            'people': '/people',
            'moving': '/moving',
            'storage': '/storage',
            'profile': '/profile',
          };
          
          if (routes[destination]) {
            window.location.hash = routes[destination];
            announceToScreenReader(`Navigating to ${destination}`, 'polite');
          }
        }
      },
      description: 'Navigate to page',
    },
    {
      command: 'go back',
      action: () => {
        window.history.back();
        announceToScreenReader('Going back', 'polite');
      },
      description: 'Go back to previous page',
    },
    {
      command: 'scroll up',
      action: () => {
        window.scrollBy(0, -200);
        announceToScreenReader('Scrolled up', 'polite');
      },
      description: 'Scroll up',
    },
    {
      command: 'scroll down',
      action: () => {
        window.scrollBy(0, 200);
        announceToScreenReader('Scrolled down', 'polite');
      },
      description: 'Scroll down',
    },
    {
      command: 'scroll to top',
      action: () => {
        window.scrollTo(0, 0);
        announceToScreenReader('Scrolled to top', 'polite');
      },
      description: 'Scroll to top of page',
    },
    {
      command: 'help',
      action: () => {
        const helpText = commands.map(cmd => cmd.description).join(', ');
        announceToScreenReader(`Available commands: ${helpText}`, 'polite');
      },
      description: 'List available voice commands',
    },
  ];

  return useVoiceCommands(commands, { continuous: false });
}

/**
 * Hook for container management voice commands
 * Validates: Requirements 13.3, 13.5
 */
export function useContainerVoiceCommands(onAction: (action: string, data?: any) => void) {
  const commands: VoiceCommand[] = [
    {
      command: 'create container',
      action: () => onAction('create'),
      description: 'Create new container',
    },
    {
      command: /search for (.*)/,
      action: (matches) => {
        if (matches && matches[1]) {
          onAction('search', { query: matches[1] });
        }
      },
      description: 'Search containers',
    },
    {
      command: 'clear search',
      action: () => onAction('clearSearch'),
      description: 'Clear search filters',
    },
    {
      command: 'show all containers',
      action: () => onAction('showAll'),
      description: 'Show all containers',
    },
    {
      command: /filter by (.*)/,
      action: (matches) => {
        if (matches && matches[1]) {
          onAction('filter', { type: matches[1] });
        }
      },
      description: 'Filter containers by type',
    },
    {
      command: 'generate qr codes',
      action: () => onAction('generateQR'),
      description: 'Generate QR codes for containers',
    },
    {
      command: 'scan qr code',
      action: () => onAction('scanQR'),
      description: 'Open QR code scanner',
    },
  ];

  return useVoiceCommands(commands, { continuous: false });
}

/**
 * Hook for packing interface voice commands
 * Validates: Requirements 13.3, 13.5
 */
export function usePackingVoiceCommands(onAction: (action: string, data?: any) => void) {
  const commands: VoiceCommand[] = [
    {
      command: 'select all',
      action: () => onAction('selectAll'),
      description: 'Select all items',
    },
    {
      command: 'clear selection',
      action: () => onAction('clearSelection'),
      description: 'Clear item selection',
    },
    {
      command: 'pack selected',
      action: () => onAction('packSelected'),
      description: 'Pack selected items',
    },
    {
      command: 'remove selected',
      action: () => onAction('removeSelected'),
      description: 'Remove selected items from container',
    },
    {
      command: /select item (.*)/,
      action: (matches) => {
        if (matches && matches[1]) {
          onAction('selectItem', { name: matches[1] });
        }
      },
      description: 'Select specific item by name',
    },
    {
      command: /search items (.*)/,
      action: (matches) => {
        if (matches && matches[1]) {
          onAction('searchItems', { query: matches[1] });
        }
      },
      description: 'Search for items',
    },
    {
      command: /filter by category (.*)/,
      action: (matches) => {
        if (matches && matches[1]) {
          onAction('filterByCategory', { category: matches[1] });
        }
      },
      description: 'Filter items by category',
    },
  ];

  return useVoiceCommands(commands, { continuous: false });
}