import styles from './Card.module.css';

export interface CardProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  elevated?: boolean;
  className?: string;
}

export function Card({ header, children, footer, elevated = false, className }: CardProps) {
  return (
    <div className={`${styles.card} ${elevated ? styles['card--elevated'] : ''} ${className || ''}`}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
