import { Link } from 'react-router-dom';
import { useTitle } from '../components/Common';

export default function NotFound() {
  useTitle('Page not found');
  return (
    <section className="container empty-page">
      <p className="eyebrow">404</p>
      <h1>This page wandered off</h1>
      <p>The page you are looking for does not exist or has moved.</p>
      <div className="empty-page__ctas">
        <Link to="/" className="btn btn--lg">Go home</Link>
        <Link to="/shop" className="btn btn--lg btn--ghost">Shop products</Link>
      </div>
    </section>
  );
}
