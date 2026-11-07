import React, { useState, useEffect, useRef } from "react";

// Fil de discussion de la ville + saisie. Les messages des simulés arrivent comme ceux de vrais joueurs.
export default function CityChat({ feed, online, onSend, playerName }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);
  const box = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [feed, open]);
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t.slice(0, 120));
    setText("");
  };
  return (
    <div className="mp-chat" onClick={(e) => e.stopPropagation()}>
      <div className="mp-chat-head" onClick={() => setOpen(!open)}>
        <span>💬 Discussion</span><span className="mp-online">● {online} en ville</span>
      </div>
      {open && (
        <>
          <div className="mp-chat-log" ref={box}>
            {feed.map((m) => (
              <div key={m.key} className={m.me ? "me" : ""}><b>{m.name}</b><i>{m.level}</i> {m.text}</div>
            ))}
          </div>
          <form onSubmit={submit}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Écrire en tant que ${playerName}…`} maxLength={120} />
          </form>
        </>
      )}
    </div>
  );
}
