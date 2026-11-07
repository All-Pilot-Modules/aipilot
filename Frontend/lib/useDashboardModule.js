'use client';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAPI } from '@/lib/useSWR';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dashboard URLs carry only the module name (?module=psy-AI). Names are unique
// per teacher (uix_module_teacher_name), so the id is resolved from the
// teacher's module list — the same cached request the sidebar makes. Older
// links that still carry ?moduleId= (or an id in ?module=) keep working.
export function useDashboardModule() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const teacherId = user?.id || user?.sub;
  const nameParam = searchParams.get('module') || searchParams.get('module_name') || '';
  const legacyId = searchParams.get('moduleId') || searchParams.get('module_id')
    || (UUID.test(nameParam) ? nameParam : null);

  const { data, error, isLoading } = useAPI(
    teacherId ? `/api/modules?teacher_id=${teacherId}` : null,
    { dedupingInterval: 300000 }
  );

  return useMemo(() => {
    const modules = data?.data || data || [];
    const found = legacyId
      ? modules.find(m => m.id === legacyId)
      : modules.find(m => m.name === nameParam) || modules.find(m => m.name?.toLowerCase() === nameParam.toLowerCase());
    return {
      moduleName: found?.name || (legacyId && nameParam === legacyId ? '' : nameParam),
      moduleId: found?.id || legacyId || null,
      module: found || null,
      loading: Boolean(authLoading) || (Boolean(teacherId) && (isLoading || (!data && !error))),
      notFound: Boolean(data) && !found && !legacyId && Boolean(nameParam),
      error,
    };
  }, [authLoading, data, error, isLoading, legacyId, nameParam, teacherId]);
}
