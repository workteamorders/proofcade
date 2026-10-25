import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="screen gate-card">
      <div className="insert">GAME OVER</div>
      <p>That page is not on the board.</p>
      <Link className="btn" href="/">Back to start</Link>
    </div>
  );
}
