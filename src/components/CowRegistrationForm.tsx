/**
 * CowRegistrationForm component
 * Task 18b.1: Register a new cow with individual identification number
 * Task 5.1: Add mode and initialData props for edit mode support
 * Task 12.1: Refactored to use design system (Input, Button, CSS Module)
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.6, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Input } from './ui/Input/Input';
import { Button } from './ui/Button/Button';
import styles from './CowRegistrationForm.module.css';

const client = generateClient<Schema>();

export interface FormState {
  cowId: string;
  earTagNo: string;
  sex: 'FEMALE' | 'MALE' | 'CASTRATED' | '';
  breed: string;
  birthDate: string;
  parity: string;
  lastCalvingDate: string;
  name: string;
  farm: string;
}

interface CowRegistrationFormProps {
  mode?: 'create' | 'edit';
  initialCowId?: string;
  initialData?: Partial<FormState>;
  onRegistered: (cowId: string) => void;
  onCancel?: () => void;
}

/** Pure helper: compute initial FormState from props. Exported for testing. */
export function buildInitialFormState(
  initialCowId: string,
  initialData?: Partial<FormState>,
): FormState {
  return {
    cowId: initialData?.cowId ?? initialCowId,
    earTagNo: initialData?.earTagNo ?? '',
    sex: initialData?.sex ?? '',
    breed: initialData?.breed ?? '',
    birthDate: initialData?.birthDate ?? '',
    parity:
      initialData?.parity !== undefined && initialData.parity !== null
        ? String(initialData.parity)
        : '',
    lastCalvingDate: initialData?.lastCalvingDate ?? '',
    name: initialData?.name ?? '',
    farm: initialData?.farm ?? '',
  };
}

export function CowRegistrationForm({
  mode = 'create',
  initialCowId = '',
  initialData,
  onRegistered,
  onCancel,
}: CowRegistrationFormProps) {
  const isEditMode = mode === 'edit';

  const [form, setForm] = useState<FormState>(
    buildInitialFormState(initialCowId, initialData),
  );
  const [cowIdError, setCowIdError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'cowId') setCowIdError(null);
  };

  const validateCowId = (value: string): boolean => {
    if (!/^\d{10}$/.test(value)) {
      setCowIdError('個体識別番号は10桁の数字で入力してください（先頭0も可）');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateCowId(form.cowId)) return;
    if (!form.sex) { setError('性別を選択してください'); return; }
    if (!form.breed.trim()) { setError('品種を入力してください'); return; }
    if (!form.birthDate) { setError('生年月日を入力してください'); return; }

    setLoading(true);
    try {
      if (isEditMode) {
        const { errors } = await client.models.Cow.update({
          cowId: form.cowId,
          earTagNo: form.earTagNo || undefined,
          sex: form.sex as 'FEMALE' | 'MALE' | 'CASTRATED',
          breed: form.breed,
          birthDate: form.birthDate,
          parity: form.parity ? parseInt(form.parity, 10) : undefined,
          lastCalvingDate: form.lastCalvingDate || undefined,
          name: form.name || undefined,
          farm: form.farm || undefined,
        });

        if (errors && errors.length > 0) {
          setError(errors.map((e) => e.message).join('\n'));
          return;
        }
      } else {
        const { errors } = await client.models.Cow.create({
          cowId: form.cowId,
          earTagNo: form.earTagNo || undefined,
          sex: form.sex as 'FEMALE' | 'MALE' | 'CASTRATED',
          breed: form.breed,
          birthDate: form.birthDate,
          parity: form.parity ? parseInt(form.parity, 10) : undefined,
          lastCalvingDate: form.lastCalvingDate || undefined,
          name: form.name || undefined,
          farm: form.farm || undefined,
        });

        if (errors && errors.length > 0) {
          setError(errors.map((e) => e.message).join('\n'));
          return;
        }
      }

      onRegistered(form.cowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : isEditMode ? '更新中にエラーが発生しました' : '登録中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{isEditMode ? '牛の情報編集' : '牛の新規登録'}</h2>
      <form onSubmit={handleSubmit} noValidate className={styles.form}>

        <Input
          id="cowId"
          label="個体識別番号 *"
          type="text"
          value={form.cowId}
          onChange={(e) => handleChange('cowId', e.target.value)}
          placeholder="0000000000（10桁）"
          maxLength={10}
          disabled={loading || isEditMode}
          readOnly={isEditMode}
          error={cowIdError ?? undefined}
        />

        <div className={styles.field}>
          <label htmlFor="sex" className={styles.selectLabel}>
            性別 <span className={styles.required}>*</span>
          </label>
          <select
            id="sex"
            value={form.sex}
            onChange={(e) => handleChange('sex', e.target.value)}
            className={styles.select}
            disabled={loading}
          >
            <option value="">選択してください</option>
            <option value="FEMALE">雌</option>
            <option value="MALE">雄</option>
            <option value="CASTRATED">去勢</option>
          </select>
        </div>

        <Input
          id="breed"
          label="品種 *"
          type="text"
          value={form.breed}
          onChange={(e) => handleChange('breed', e.target.value)}
          placeholder="例: ホルスタイン"
          disabled={loading}
        />

        <Input
          id="birthDate"
          label="生年月日 *"
          type="date"
          value={form.birthDate}
          onChange={(e) => handleChange('birthDate', e.target.value)}
          disabled={loading}
        />

        <Input
          id="earTagNo"
          label="耳標番号"
          type="text"
          value={form.earTagNo}
          onChange={(e) => handleChange('earTagNo', e.target.value)}
          placeholder="任意"
          disabled={loading}
        />

        <Input
          id="parity"
          label="産次"
          type="number"
          min={0}
          value={form.parity}
          onChange={(e) => handleChange('parity', e.target.value)}
          placeholder="任意"
          disabled={loading}
        />

        <Input
          id="lastCalvingDate"
          label="最終分娩日"
          type="date"
          value={form.lastCalvingDate}
          onChange={(e) => handleChange('lastCalvingDate', e.target.value)}
          disabled={loading}
        />

        <Input
          id="name"
          label="名前"
          type="text"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="任意"
          disabled={loading}
        />

        <Input
          id="farm"
          label="農場"
          type="text"
          value={form.farm}
          onChange={(e) => handleChange('farm', e.target.value)}
          placeholder="任意"
          disabled={loading}
        />

        {error && (
          <div role="alert" className={styles.errorAlert}>
            {error}
          </div>
        )}

        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            fullWidth
          >
            {isEditMode ? '更新する' : '牛を登録する'}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              キャンセル
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default CowRegistrationForm;
