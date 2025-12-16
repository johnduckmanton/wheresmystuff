import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
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
 * Validates: Requirements 1.1
 */
export function InventoryProvider({ children }: InventoryProviderProps) {
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load inventories on mount
  useEffect(() => {
    loadInventories();
  }, []);

  // Auto-select first inventory if none selected
  useEffect(() => {
    if (!currentInventory && inventories.length > 0) {
      setCurrentInventory(inventories[0]);
    }
  }, [inventories, currentInventory]);

  const loadInventories = async () => {
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