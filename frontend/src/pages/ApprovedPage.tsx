import { Navigate, useParams } from 'react-router-dom';

export function ApprovedPage() {
  const { id } = useParams();
  return <Navigate to={id ? `/applications/${encodeURIComponent(id)}/sign` : '/applications'} replace />;
}
