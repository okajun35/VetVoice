import styles from './Tabs.module.css';

export interface TabItem {
  value: string;
  label: string;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={[styles.tabList, className || ''].filter(Boolean).join(' ')}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={activeTab === tab.value}
          className={[
            styles.tab,
            activeTab === tab.value ? styles['tab--active'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onTabChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
