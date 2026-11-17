import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  PlugZap,
  ShieldAlert,
} from 'lucide-react';
import type { ConnectionState } from '../types/agent';

interface ConnectionStatusIndicatorProps {
  state: ConnectionState;
  demoMode: boolean;
  compact?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  state,
  demoMode,
  compact = false,
}) => {
  if (demoMode && state === 'connected') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-sky-300">
        <FlaskConical className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">
          {compact ? 'وضع العرض التجريبي' : 'وضع العرض التجريبي (بيانات محاكاة)'}
        </span>
      </div>
    );
  }

  switch (state) {
    case 'connected':
      return (
        <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">متصل بالوكيل المحلي</span>
        </div>
      );
    case 'permission_required':
      return (
        <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">يتطلب صلاحية ومصادقة</span>
        </div>
      );
    case 'error':
      return (
        <div className="inline-flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">خطأ في الاتصال بالوكيل</span>
        </div>
      );
    case 'disconnected':
    default:
      return (
        <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <PlugZap className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">غير متصل بالوكيل المحلي</span>
        </div>
      );
  }
};
