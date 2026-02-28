import { useState, useEffect } from 'react';
import { TextField, Box, type TextFieldProps } from '@mui/material';
import PasswordToggleButton from './PasswordToggleButton';

export interface PasswordFieldProps extends Omit<TextFieldProps, 'type'> {
  showToggle?: boolean;
  resetVisibility?: boolean;
}

export default function PasswordField({
  showToggle = true,
  resetVisibility = false,
  inputProps,
  ...textFieldProps
}: PasswordFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Reset visibility state when resetVisibility prop changes to true
  useEffect(() => {
    if (resetVisibility) {
      setIsPasswordVisible(false);
    }
  }, [resetVisibility]);

  // Reset visibility state on component unmount
  useEffect(() => {
    return () => {
      setIsPasswordVisible(false);
    };
  }, []);

  const handleToggle = () => {
    setIsPasswordVisible((prev) => !prev);
  };

  const inputType = isPasswordVisible ? 'text' : 'password';
  const fieldId = textFieldProps.id || 'password-field';

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <TextField
        {...textFieldProps}
        type={inputType}
        id={fieldId}
        inputProps={{
          ...inputProps,
          'aria-label': inputProps?.['aria-label'] || 'Password',
        }}
        InputProps={{
          ...textFieldProps.InputProps,
          endAdornment: showToggle ? (
            <PasswordToggleButton
              isVisible={isPasswordVisible}
              onToggle={handleToggle}
              fieldId={fieldId}
            />
          ) : (
            textFieldProps.InputProps?.endAdornment
          ),
        }}
      />
    </Box>
  );
}
