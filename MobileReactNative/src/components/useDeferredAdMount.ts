import {useEffect, useState} from 'react';
import {InteractionManager} from 'react-native';

/** Keep SDK initialization and native-view mounting out of navigation/press interactions. */
export function useDeferredAdMount(enabled: boolean) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!enabled) return;
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, [enabled]);

  return enabled && ready;
}
