import { useSyncExternalStore } from 'react';
import { fixture } from './mock-client';
export function useAuth() {
  const userId=useSyncExternalStore(fixture.subscribe,()=>fixture.userId);
  return {session:userId?{id:userId,name:'Synthetic Reviewer',role:'rep'}:null,logout:()=>fixture.setUser(null)};
}
