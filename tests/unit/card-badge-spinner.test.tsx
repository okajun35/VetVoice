import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../../src/components/ui/Card/Card';
import { Badge } from '../../src/components/ui/Badge/Badge';
import { Spinner } from '../../src/components/ui/Spinner/Spinner';

describe('Card component', () => {
  it('renders children in body', () => {
    render(<Card>Test content</Card>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders with header', () => {
    render(<Card header={<h2>Card Header</h2>}>Body content</Card>);
    expect(screen.getByText('Card Header')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders with footer', () => {
    render(<Card footer={<div>Card Footer</div>}>Body content</Card>);
    expect(screen.getByText('Card Footer')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('renders with header, body, and footer', () => {
    render(
      <Card header={<h2>Header</h2>} footer={<div>Footer</div>}>
        Body
      </Card>
    );
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('applies elevated class when elevated prop is true', () => {
    const { container } = render(<Card elevated>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('card--elevated');
  });

  it('does not apply elevated class when elevated prop is false', () => {
    const { container } = render(<Card elevated={false}>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain('card--elevated');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('custom-class');
  });
});

describe('Badge component', () => {
  it('renders children', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('renders with success variant', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('badge--success');
  });

  it('renders with warning variant', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('badge--warning');
  });

  it('renders with error variant', () => {
    const { container } = render(<Badge variant="error">Error</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('badge--error');
  });

  it('renders with info variant', () => {
    const { container } = render(<Badge variant="info">Info</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('badge--info');
  });

  it('renders with neutral variant by default', () => {
    const { container } = render(<Badge>Neutral</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('badge--neutral');
  });

  it('renders with small size', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('badge--sm');
  });

  it('renders with medium size by default', () => {
    const { container } = render(<Badge>Medium</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('badge--md');
  });
});

describe('Spinner component', () => {
  it('renders with default label', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<Spinner label="Processing..." />);
    expect(screen.getByLabelText('Processing...')).toBeInTheDocument();
  });

  it('has role="status" for accessibility', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with small size', () => {
    const { container } = render(<Spinner size="sm" />);
    const spinner = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(spinner.className).toContain('spinner--sm');
  });

  it('renders with medium size by default', () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(spinner.className).toContain('spinner--md');
  });

  it('renders with large size', () => {
    const { container } = render(<Spinner size="lg" />);
    const spinner = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(spinner.className).toContain('spinner--lg');
  });

  it('includes screen reader only text', () => {
    render(<Spinner label="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('spinner element has aria-hidden="true"', () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
  });
});
