import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function Spinner({ size = 'md', label = 'Loading...' }: SpinnerProps) {
  return (
    <div className={styles.container} role="status" aria-label={label}>
      <div className={`${styles.spinner} ${styles[`spinner--${size}`]}`} aria-hidden="true" />
      <span className={styles.srOnly}>{label}</span>
    </div>
  );
}
