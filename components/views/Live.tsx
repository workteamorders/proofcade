'use client';
import { useState } from 'react';
import { useApp } from '@/lib/app';
import { Msg } from '../ui';

export function LiveView() {
  const app = useApp();
  const [text, setText] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim(); if (!v) return;
    app.needWallet('A wallet is needed to post.', () => { app.postMsg(v); setText(''); });
  };
  return (
    <>
      <div className="live-head on-dark"><div className="eyebrow"><b>Live</b> · callouts</div></div>
      <h1 style={{ marginBottom: 18 }}>Callouts</h1>
      <div className="live-head on-dark">
        <span className="chip"><span className="led" /><b>LIVE</b> — {128 + app.msgs.length} callouts · 54 users <span style={{ opacity: 0.7 }}>(24 h)</span></span>
        <label className="chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={app.toastsOn} onChange={(e) => app.setToastsOn(e.target.checked)} /> Toasts</label>
      </div>
      <form className="screen compose" onSubmit={submit}>
        <label className="sr" htmlFor="ctext">Post a callout</label>
        <input id="ctext" type="text" maxLength={280} value={text} onChange={(e) => setText(e.target.value)} placeholder={app.connected ? 'Call your shot…' : 'Connect a wallet to post a callout'} autoComplete="off" />
        <button className="btn" type="submit">{app.connected ? 'Post' : 'Insert coin'}</button>
      </form>
      <div className="feed">{app.msgs.map((m) => <Msg key={m.id} m={m} />)}</div>
    </>
  );
}
