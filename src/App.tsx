/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { ViewerPortal } from './components/ViewerPortal';
import { supabase } from './supabase';

// A viewer account owns nothing, so it never mounts AppProvider (which would
// fetch and bootstrap an owner's data). The role lives in app_metadata, which
// only the server can set; the database enforces the same split regardless.
export default function App() {
  const [isViewer, setIsViewer] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setIsViewer(data.session?.user.app_metadata?.role === 'viewer');
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsViewer(session?.user.app_metadata?.role === 'viewer');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (isViewer === null) return null;
  if (isViewer) return <ViewerPortal />;
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}
