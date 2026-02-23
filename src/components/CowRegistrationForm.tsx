/**
 * CowRegistrationForm component
 * Task 18b.1: Register a new cow with individual identification number
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.6
 */
import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface CowRegistrationFormProps {
  initialCowId?: string;
  onRegistered: (cowId: string) => void;
  onCancel?: () => void;
}

interface FormState {
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

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '1rem',
};

const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginBottom: '0.25rem',
  fontSize: '0.9rem',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  fontSize: '1rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  width: '100%',
  boxSizing: 'border-box',
};

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: '1px solid #cc0000',
};

export function CowRegistrationForm({ initialCowId = '', onRegistered, onCancel }: CowRegistrationFormProps) {
  const [form, setForm] = useState<FormState>({
    cowId: initialCowId,
    earTagNo: '',
    sex: '',
    breed: '',
    birthDate: '',
    parity: '',
    lastCalvingDate: '',
    name: '',
    farm: '',
  });
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

      onRegistered(form.cowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>牛の新規登録</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="cowId">
            個体識別番号 <span style={{ color: '#cc0000' }}>*</span>
          </label>
          <input
            id="cowId"
            type="text"
            value={form.cowId}
            onChange={(e) => handleChange('cowId', e.target.value)}
            placeholder="0000000000（10桁）"
            maxLength={10}
            style={cowIdError ? inputErrorStyle : inputStyle}
            disabled={loading}
          />
          {cowIdError && (
            <span style={{ color: '#cc0000', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              {cowIdError}
            </span>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="sex">
            性別 <span style={{ color: '#cc0000' }}>*</span>
          </label>
          <select
            id="sex"
            value={form.sex}
            onChange={(e) => handleChange('sex', e.target.value)}
            style={inputStyle}
            disabled={loading}
          >
            <option value="">選択してください</option>
            <option value="FEMALE">雌</option>
            <option value="MALE">雄</option>
            <option value="CASTRATED">去勢</option>
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="breed">
            品種 <span style={{ color: '#cc0000' }}>*</span>
          </label>
          <input
            id="breed"
            type="text"
            value={form.breed}
            onChange={(e) => handleChange('breed', e.target.value)}
            placeholder="例: ホルスタイン"
            style={inputStyle}
            disabled={loading}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="birthDate">
            生年月日 <span style={{ color: '#cc0000' }}>*</span>
          </label>
          <input
            id="birthDate"
            type="date"
            value={form.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
            style={inputStyle}
            disabled={loading}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="earTagNo">耳標番号</label>
          <input
            id="earTagNo"
            type="text"
            value={form.earTagNo}
            onChange={(e) => handleChange('earTagNo', e.target.value)}
            placeholder="任意"
            style={inputStyle}
            disabled={loading}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="parity">産次</label>
          <input
            id="parity"
            type="number"
            min={0}
            value={form.parity}
            onChange={(e) => handleChange('parity', e.target.value)}
            placeholder="任意"
            style={inputStyle}
            disabled={loading}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="lastCalvingDate">最終分娩日</label>
          <input
            id="lastCalvingDate"
            type="date"
            value={form.lastCalvingDate}
            onChange={(e) => handleChange('lastCalvingDate', e.target.value)}
            style={inputStyle}
            disabled={loading}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="name">名前</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="任意"
            style={inputStyle}
            disabled={loading}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="farm">農場</label>
          <input
            id="farm"
            type="text"
            value={form.farm}
            onChange={(e) => handleChange('farm', e.target.value)}
            placeholder="任意"
            style={inputStyle}
            disabled={loading}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem',
              background: '#fff0f0',
              border: '1px solid #cc0000',
              borderRadius: '4px',
              color: '#cc0000',
              marginBottom: '1rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: loading ? '#ccc' : '#0066cc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '登録中...' : '牛を登録する'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default CowRegistrationForm;
