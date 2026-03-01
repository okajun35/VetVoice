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
import {
  buildInitialFormState,
  type FormState,
} from './cowRegistrationForm.helpers';
import styles from './CowRegistrationForm.module.css';

const client = generateClient<Schema>();

export type { FormState } from './cowRegistrationForm.helpers';

interface CowRegistrationFormProps {
  mode?: 'create' | 'edit';
  initialCowId?: string;
  initialData?: Partial<FormState>;
  onRegistered: (cowId: string) => void;
  onCancel?: () => void;
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
      setCowIdError('INVALID_ID_FORMAT_REQUIRE_10_DIGITS');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateCowId(form.cowId)) return;
    if (!form.sex) { setError('REQUIRED_FIELD_MISSING: SEX_TYPE'); return; }
    if (!form.breed.trim()) { setError('REQUIRED_FIELD_MISSING: BREED'); return; }
    if (!form.birthDate) { setError('REQUIRED_FIELD_MISSING: BIRTH_DATE'); return; }

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
      setError(err instanceof Error ? err.message : isEditMode ? 'UPDATE_OPERATION_FAILED' : 'REGISTRATION_OPERATION_FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{isEditMode ? 'ENTRY_EDIT' : 'ENTRY_REGISTRATION'}</h2>
      <form onSubmit={handleSubmit} noValidate className={styles.form}>

        <Input
          id="cowId"
          label="ID_CODE (10-DIGIT) *"
          type="text"
          value={form.cowId}
          onChange={(e) => handleChange('cowId', e.target.value)}
          placeholder="0000000000"
          maxLength={10}
          disabled={loading || isEditMode}
          readOnly={isEditMode}
          error={cowIdError ?? undefined}
        />

        <div className={styles.field}>
          <label htmlFor="sex" className={styles.selectLabel}>
            SEX_TYPE <span className={styles.required}>*</span>
          </label>
          <select
            id="sex"
            value={form.sex}
            onChange={(e) => handleChange('sex', e.target.value)}
            className={styles.select}
            disabled={loading}
          >
            <option value="">SELECT_ENTRY</option>
            <option value="FEMALE">FEMALE</option>
            <option value="MALE">MALE</option>
            <option value="CASTRATED">CASTRATED</option>
          </select>
        </div>

        <Input
          id="breed"
          label="BREED_SPECIES *"
          type="text"
          value={form.breed}
          onChange={(e) => handleChange('breed', e.target.value)}
          placeholder="E.G. HOLSTEIN"
          disabled={loading}
        />

        <Input
          id="birthDate"
          label="BIRTH_DATE *"
          type="date"
          value={form.birthDate}
          onChange={(e) => handleChange('birthDate', e.target.value)}
          disabled={loading}
        />

        <Input
          id="earTagNo"
          label="EARTAG_NO"
          type="text"
          value={form.earTagNo}
          onChange={(e) => handleChange('earTagNo', e.target.value)}
          placeholder="OPTIONAL"
          disabled={loading}
        />

        <Input
          id="parity"
          label="PARITY"
          type="number"
          min={0}
          value={form.parity}
          onChange={(e) => handleChange('parity', e.target.value)}
          placeholder="OPTIONAL"
          disabled={loading}
        />

        <Input
          id="lastCalvingDate"
          label="LAST_CALVING_DATE"
          type="date"
          value={form.lastCalvingDate}
          onChange={(e) => handleChange('lastCalvingDate', e.target.value)}
          disabled={loading}
        />

        <Input
          id="name"
          label="NAME"
          type="text"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="OPTIONAL"
          disabled={loading}
        />

        <Input
          id="farm"
          label="FARM"
          type="text"
          value={form.farm}
          onChange={(e) => handleChange('farm', e.target.value)}
          placeholder="OPTIONAL"
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
            {isEditMode ? 'COMMIT_CHANGES' : 'REGISTER_ENTRY'}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
            >
              CANCEL
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default CowRegistrationForm;
