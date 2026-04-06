const STORAGE_KEY = 'wms_last_module';
type Module = 'inventory' | 'moving';

export function useLastUsedModule() {
  const set = (module: Module) => {
    try {
      localStorage.setItem(STORAGE_KEY, module);
    } catch {
      // silent degradation in private browsing / quota exceeded
    }
  };
  const get = (): Module | null => {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (val === 'inventory' || val === 'moving') return val;
      return null;
    } catch {
      return null;
    }
  };
  return { set, get };
}
