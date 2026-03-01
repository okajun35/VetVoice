/**
 * Unit tests for UI primitive components:
 * Select, Textarea, Tabs, Alert
 *
 * Requirements: 2.1, 2.3, 2.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '../../src/components/ui/Select';
import { Textarea } from '../../src/components/ui/Textarea';
import { Tabs } from '../../src/components/ui/Tabs';
import { Alert } from '../../src/components/ui/Alert';

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ];

  it('renders a select element', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Select options={options} label="診療種別" />);
    expect(screen.getByText('診療種別')).toBeInTheDocument();
    const label = screen.getByText('診療種別');
    const select = screen.getByRole('combobox');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', select.id);
  });

  it('renders all options', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option C' })).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    render(<Select options={options} error="選択してください" />);
    expect(screen.getByText('選択してください')).toBeInTheDocument();
  });

  it('sets aria-invalid when error is provided', () => {
    render(<Select options={options} error="エラー" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid');
  });

  it('renders as disabled when disabled prop is set', () => {
    render(<Select options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('does not render label when label prop is omitted', () => {
    render(<Select options={options} />);
    expect(screen.queryByRole('label')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Textarea label="メモ" />);
    expect(screen.getByText('メモ')).toBeInTheDocument();
    const label = screen.getByText('メモ');
    const textarea = screen.getByRole('textbox');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', textarea.id);
  });

  it('shows error message when error prop is provided', () => {
    render(<Textarea error="入力してください" />);
    expect(screen.getByText('入力してください')).toBeInTheDocument();
  });

  it('sets aria-invalid when error is provided', () => {
    render(<Textarea error="エラー" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('applies rows attribute when specified', () => {
    render(<Textarea rows={8} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '8');
  });

  it('does not render label when label prop is omitted', () => {
    render(<Textarea />);
    expect(screen.queryByRole('label')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

describe('Tabs', () => {
  const tabs = [
    { value: 'text', label: 'テキスト入力' },
    { value: 'audio', label: '音声ファイル' },
    { value: 'json', label: 'JSON入力' },
  ];

  it('renders a tablist container', () => {
    const onTabChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="text" onTabChange={onTabChange} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders all tab buttons', () => {
    const onTabChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="text" onTabChange={onTabChange} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'テキスト入力' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '音声ファイル' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'JSON入力' })).toBeInTheDocument();
  });

  it('sets aria-selected=true on the active tab', () => {
    const onTabChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="audio" onTabChange={onTabChange} />);
    expect(screen.getByRole('tab', { name: '音声ファイル' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sets aria-selected=false on inactive tabs', () => {
    const onTabChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="audio" onTabChange={onTabChange} />);
    expect(screen.getByRole('tab', { name: 'テキスト入力' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'JSON入力' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onTabChange with the correct value when a tab is clicked', async () => {
    const onTabChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="text" onTabChange={onTabChange} />);
    await userEvent.click(screen.getByRole('tab', { name: '音声ファイル' }));
    expect(onTabChange).toHaveBeenCalledOnce();
    expect(onTabChange).toHaveBeenCalledWith('audio');
  });

  it('each tab button has role="tab"', () => {
    const onTabChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="text" onTabChange={onTabChange} />);
    const tabButtons = screen.getAllByRole('tab');
    tabButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('role', 'tab');
    });
  });
});

// ---------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------

describe('Alert', () => {
  it('renders with role="alert"', () => {
    render(<Alert variant="info">メッセージ</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(<Alert variant="info">テスト内容</Alert>);
    expect(screen.getByText('テスト内容')).toBeInTheDocument();
  });

  it('renders success variant', () => {
    render(<Alert variant="success">成功</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('成功');
  });

  it('renders warning variant', () => {
    render(<Alert variant="warning">警告</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('警告');
  });

  it('renders error variant', () => {
    render(<Alert variant="error">エラーが発生しました</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('エラーが発生しました');
  });

  it('renders info variant', () => {
    render(<Alert variant="info">情報</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('情報');
  });

  it('renders without children', () => {
    render(<Alert variant="info" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
