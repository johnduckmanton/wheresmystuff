import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLastUsedModule } from '../hooks/useLastUsedModule';

const INVENTORY_PREFIXES = ['/things', '/locations', '/categories', '/people', '/inventory'];
const MOVING_PREFIXES = ['/moving', '/containers', '/projects', '/storage'];

export function RouteModuleTracker() {
  const location = useLocation();
  const { set } = useLastUsedModule();

  useEffect(() => {
    const path = location.pathname;
    if (INVENTORY_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      set('inventory');
    } else if (MOVING_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      set('moving');
    }
  }, [location.pathname]);

  return null;
}
