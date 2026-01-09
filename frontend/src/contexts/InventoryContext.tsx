import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import type { Inventory } from '../types';
import apiClient from '../services/api';

interface InventoryContextType {
  currentInventory: Inventory | null;
  inventories: Inventory[];
  setCurrentInventory: (inventory: Inventory | null) => void;
  loadInventories: () => Promise<void>;
  isLoading: boolean;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

interface InventoryProviderProps {
  children: ReactNode;
}

/**
 * Inventory Context Provider
 * Manages current inventory selection and inventory list
 * Only loads inventories when user is authenticated
 * Validates: Requirements 1.1
 */
export function InventoryProvider({ children }: InventoryProviderProps) {
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication status and listen for changes
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try both getCurrentUser and fetchAuthSession for more reliable auth check
        await Promise.all([
          getCurrentUser(),
          fetchAuthSession()
        ]);
        
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    
    // Check auth on mount
    checkAuth();
    
    // Listen for auth state changes
    const hubListener = (data: any) => {
      const { event } = data.payload;
      
      if (event === 'signedIn') {
        setIsAuthenticated(true);
      } else if (event === 'signedOut') {
        setIsAuthenticated(false);
      } else if (event === 'tokenRefresh') {
        checkAuth();
      }
    };
    
    // Subscribe to auth events
    const unsubscribe = Hub.listen('auth', hubListener);
    
    // Cleanup
    return () => {
      unsubscribe();
    };
  }, []);

  // Load inventories only when authenticated
  useEffect(() => {
    if (isAuthenticated === true) {
      loadInventories();
    } else if (isAuthenticated === false) {
      // Clear data when not authenticated
      setInventories([]);
      setCurrentInventory(null);
    }
  }, [isAuthenticated]);

  // Auto-select first inventory if none selected
  useEffect(() => {
    if (!currentInventory && inventories.length > 0) {
      setCurrentInventory(inventories[0]);
    }
  }, [inventories, currentInventory]);

  const loadInventories = async () => {
    // Don't load if not authenticated
    if (isAuthenticated !== true) {
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiClient.getInventories();
      
      // If no inventories exist, create a default one
      if (data.length === 0) {
        try {
          const defaultInventory = await apiClient.createInventory({
            name: 'My Inventory',
            description: 'Default inventory'
          });
          setInventories([defaultInventory]);
          setCurrentInventory(defaultInventory);
        } catch (createError) {
          console.error('Failed to create default inventory:', createError);
          setInventories([]);
          setCurrentInventory(null);
        }
      } else {
        setInventories(data);
        
        // If current inventory is no longer in the list, clear it
        if (currentInventory && !data.find(inv => inv.id === currentInventory.id)) {
          setCurrentInventory(null);
        }
      }
    } catch (error) {
      console.error('Failed to load inventories:', error);
      setInventories([]);
      setCurrentInventory(null);
    } finally {
      setIsLoading(false);
    }
  };

  const value: InventoryContextType = {
    currentInventory,
    inventories,
    setCurrentInventory,
    loadInventories,
    isLoading,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}