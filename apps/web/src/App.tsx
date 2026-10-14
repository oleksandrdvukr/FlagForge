import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ApiError } from './api/client';
import { Shell } from './layout/Shell';
import { AuditPage } from './pages/AuditPage';
import { FlagEditorPage } from './pages/FlagEditorPage';
import { FlagsPage } from './pages/FlagsPage';
import { HomeRedirect } from './pages/HomeRedirect';
import { KeysPage } from './pages/KeysPage';
import { LoginPage } from './pages/LoginPage';
import { NewWorkspacePage } from './pages/NewWorkspacePage';
import { PlaygroundPage } from './pages/PlaygroundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Client errors (401/404) won't fix themselves; only retry transient failures.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <HomeRedirect /> },
  { path: '/workspaces/new', element: <NewWorkspacePage /> },
  { path: '/w/:workspaceId', element: <HomeRedirect /> },
  {
    path: '/w/:workspaceId/e/:environmentId',
    element: <Shell />,
    children: [
      { path: 'flags', element: <FlagsPage /> },
      { path: 'flags/:flagId', element: <FlagEditorPage /> },
      { path: 'playground', element: <PlaygroundPage /> },
      { path: 'keys', element: <KeysPage /> },
      { path: 'audit', element: <AuditPage /> },
    ],
  },
  { path: '*', element: <HomeRedirect /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
