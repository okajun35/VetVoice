import React from 'react';
import styles from './Alert.module.css';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface AlertProps {
  variant: AlertVariant;
  children?: React.ReactNode;
  className?: string;
}

export function Alert({ variant, children, className }: AlertProps) {
  const classNames = [
    styles.alert,
    styles[`alert--${variant}`],
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="alert" className={classNames}>
      {children}
    </div>
  );
}
