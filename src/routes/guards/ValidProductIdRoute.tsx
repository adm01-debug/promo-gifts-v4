import { Navigate, useParams } from 'react-router-dom';
import type { ReactElement } from 'react';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards /produto/:id routes — redirects to /catalogo if the param is missing,
 * literally "undefined"/"null", or not a valid UUID. Prevents bad calls to the
 * external-db-bridge edge function (which throws 400 on invalid UUIDs).
 */
export function ValidProductIdRoute({ children }: { children: ReactElement }) {
  const { id } = useParams<{ id: string }>();
  const isValid = !!id && id !== 'undefined' && id !== 'null' && UUID_RE.test(id);
  if (!isValid) return <Navigate to="/catalogo" replace />;
  return children;
}
