import styles from './Badge.module.css';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'neutral', size = 'md' }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[`badge--${variant}`]} ${styles[`badge--${size}`]}`}>
      {children}
    </span>
  );
}
