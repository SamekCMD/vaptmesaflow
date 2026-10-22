import {useCallback,useLayoutEffect,useRef} from 'react';

/** Cancel only UI continuations: an already admitted server write keeps its original target. */
export function useBoundContinuation(identity:string){
  const reference=useRef({identity}),mounted=useRef(false);
  if(reference.current.identity!==identity)reference.current={identity};
  useLayoutEffect(()=>{
    reference.current={identity};mounted.current=true;
    return()=>{mounted.current=false;};
  },[identity]);
  return useCallback(()=>{
    const captured=reference.current;
    return()=>mounted.current&&reference.current===captured;
  },[]);
}
