import { useEffect } from 'react';
import { MapLayer } from '../types/ponziland';

export const usePersistence = (
  selectedPlayerAddresses: Set<string>,
  selectedLayer: MapLayer,
  hideNotRecommended: boolean,
  isSidebarCollapsed: boolean,
  activeTab: 'map' | 'analysis',
  durationCapHours: number,
  selectedToken: string,
  selectedStakeToken: string
) => {
  // Persistence effects - save state changes to localStorage
  useEffect(() => {
    localStorage.setItem('ponziland-selected-players', JSON.stringify(Array.from(selectedPlayerAddresses)));
  }, [selectedPlayerAddresses]);

  useEffect(() => {
    localStorage.setItem('ponziland-selected-layer', JSON.stringify(selectedLayer));
  }, [selectedLayer]);

  useEffect(() => {
    localStorage.setItem('ponziland-hide-not-recommended', JSON.stringify(hideNotRecommended));
  }, [hideNotRecommended]);

  useEffect(() => {
    localStorage.setItem('ponziland-sidebar-collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('ponziland-active-tab', JSON.stringify(activeTab));
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('ponziland-duration-cap', JSON.stringify(durationCapHours));
  }, [durationCapHours]);

  useEffect(() => {
    localStorage.setItem('ponziland-selected-token', JSON.stringify(selectedToken));
  }, [selectedToken]);

  useEffect(() => {
    localStorage.setItem('ponziland-stake-token', JSON.stringify(selectedStakeToken));
  }, [selectedStakeToken]);
};