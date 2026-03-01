import React, { useId } from 'react';
import styles from './Textarea.module.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({
  label,
  error,
  helperText,
  id: providedId,
  className,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const helperTextId = helperText ? `${id}-helper` : undefined;

  const ariaDescribedBy = [errorId, helperTextId].filter(Boolean).join(' ') || undefined;

  const classNames = [
    styles.textarea,
    error ? styles['textarea--error'] : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.container}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={classNames}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        {...props}
      />
      {helperText && !error && (
        <span id={helperTextId} className={styles.helper}>
          {helperText}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
