// src/hooks/useStudentDraft.ts
import { useState, useCallback } from 'react';

export type StudentDraft = {
  name: string;
  phone: string;
  routeId?: number | null;
  lat?: number | null;
  lng?: number | null;
};

export default function useStudentDraft(initial?: Partial<StudentDraft>) {
  const [draft, setDraft] = useState<StudentDraft>({
    name: '',
    phone: '',
    routeId: null,
    lat: null,
    lng: null,
    ...initial,
  });

  const update = useCallback(<K extends keyof StudentDraft>(key: K, value: StudentDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const reset = useCallback(() => setDraft({
    name: '',
    phone: '',
    routeId: null,
    lat: null,
    lng: null,
  }), []);

  return { draft, update, setDraft, reset };
}
