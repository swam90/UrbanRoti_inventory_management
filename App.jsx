import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, Edit2, Trash2, Share2, X, FileSpreadsheet, Mail,
  MessageCircle, Printer, ArrowLeft, Save, Home, ClipboardList, BarChart3,
  StickyNote, Building2, Boxes, Receipt, Search
} from 'lucide-react';
import * as XLSX from 'xlsx';

/* ─────────────  CONSTANTS  ───────────── */
const UOM = ['pcs', 'bags', 'boxes', 'ctns', 'kgs', 'gms', 'pkts', 'ltrs', 'set'];
const COST_CENTERS = ['Restaurant', 'Catering'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ─────────────  HELPERS  ───────────── */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (n) => 'S$' + (Number(n) || 0).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const monthKey = (iso) => iso ? iso.slice(0, 7) : '';

/* SG phone helpers — store 8-digit local number; display with +65 */
const cleanPhone = (s) => (s || '').replace(/\D/g, '').replace(/^65/, '').slice(0, 8);
const fmtPhone = (s) => {
  const c = cleanPhone(s);
  if (!c) return '';
  return '+65 ' + (c.length > 4 ? c.slice(0, 4) + ' ' + c.slice(4) : c);
};

/* OneMap (Singapore Land Authority) postal-code lookup */
const lookupPostal = async (code) => {
  const c = (code || '').replace(/\D/g, '');
  if (c.length !== 6) return null;
  try {
    const r = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${c}&returnGeom=N&getAddrDetails=Y&pageNum=1`);
    const data = await r.json();
    const hit = data?.results?.[0];
    if (!hit || hit.POSTAL === 'NIL') return null;
    return hit.ADDRESS || `${hit.BLK_NO || ''} ${hit.ROAD_NAME || ''} SINGAPORE ${hit.POSTAL}`.trim();
  } catch {
    return null;
  }
};

/* ─────────────  STORAGE (localStorage)  ───────────── */
const useStore = () => {
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = (k) => {
      try {
        const r = localStorage.getItem(k);
        return r ? JSON.parse(r) : null;
      } catch { return null; }
    };
    const v = load('inv:vendors');
    const i = load('inv:items');
    const n = load('inv:notes');
    const e = load('inv:entries');
    if (v) setVendors(v);
    if (i) setItems(i);
    if (n !== null) setNotes(n);
    if (e) setEntries(e);
    setReady(true);
  }, []);

  const persist = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (err) { console.error('persist', err); }
  };

  return {
    ready,
    vendors, items, notes, entries,
    setVendors: (v) => { setVendors(v); persist('inv:vendors', v); },
    setItems:   (v) => { setItems(v); persist('inv:items', v); },
    setNotes:   (v) => { setNotes(v); persist('inv:notes', v); },
    setEntries: (v) => { setEntries(v); persist('inv:entries', v); },
  };
};

/* ─────────────  MAIN APP  ───────────── */
export default function App() {
  const store = useStore();
  const [tab, setTab] = useState('home');

  if (!store.ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', maxWidth: 1100, margin: '0 auto' }}>
      <header className="no-print" style={{ padding: '20px 18px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: 'var(--wine)', textTransform: 'uppercase' }}>
            ◆ Ledger
          </div>
          <h1 className="serif" style={{ fontSize: 28, fontWeight: 700, margin: '2px 0 0', lineHeight: 1 }}>
            Inventory<span style={{ color: 'var(--amber)' }}>.</span>
          </h1>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
      </header>

      <main style={{ padding: '12px 18px' }}>
        {tab === 'home'    && <Dashboard store={store} go={setTab} />}
        {tab === 'masters' && <Masters store={store} />}
        {tab === 'entry'   && <Entries store={store} />}
        {tab === 'reports' && <Reports store={store} />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

/* ─────────────  BOTTOM NAV  ───────────── */
function BottomNav({ tab, setTab }) {
  const items = [
    { k: 'home',    icon: Home,          label: 'Home' },
    { k: 'masters', icon: Boxes,         label: 'Masters' },
    { k: 'entry',   icon: ClipboardList, label: 'Entry' },
    { k: 'reports', icon: BarChart3,     label: 'Reports' },
  ];
  return (
    <nav className="no-print" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(250, 246, 238, 0.95)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--line)',
      display: 'flex', justifyContent: 'space-around',
      padding: '8px 0 calc(14px + env(safe-area-inset-bottom))',
      zIndex: 50
    }}>
      {items.map(({ k, icon: Icon, label }) => {
        const active = tab === k;
        return (
          <button key={k} onClick={() => setTab(k)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 12px', color: active ? 'var(--moss)' : 'var(--muted)',
            fontWeight: active ? 700 : 500, fontSize: 11
          }}>
            <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
            {label}
            {active && <div style={{ width: 4, height: 4, borderRadius: 2, background: 'var(--amber)', marginTop: -1 }} />}
          </button>
        );
      })}
    </nav>
  );
}

/* ─────────────  DASHBOARD  ───────────── */
function Dashboard({ store, go }) {
  const monthEntries = useMemo(() => {
    const mk = monthKey(todayISO());
    return store.entries.filter(e => monthKey(e.date) === mk);
  }, [store.entries]);

  const totalThisMonth = useMemo(() => {
    return monthEntries.reduce((s, e) =>
      s + e.lineItems.reduce((ss, li) => ss + (li.amount || 0), 0), 0);
  }, [monthEntries]);

  const tiles = [
    { label: 'Vendors',    value: store.vendors.length, icon: Building2, go: 'masters' },
    { label: 'Items',      value: store.items.length,   icon: Package,   go: 'masters' },
    { label: 'This month', value: monthEntries.length,  icon: Receipt,   go: 'entry' },
  ];

  return (
    <div>
      <div className="card" style={{ padding: 22, marginBottom: 18, background: 'var(--moss)', color: '#faf6ee', border: 'none', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(201,137,43,.15)' }} />
        <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .75 }}>
          {MONTHS[new Date().getMonth()]} {new Date().getFullYear()}
        </div>
        <div className="serif num" style={{ fontSize: 38, fontWeight: 700, marginTop: 6, lineHeight: 1 }}>
          {fmtMoney(totalThisMonth)}
        </div>
        <div style={{ fontSize: 13, opacity: .8, marginTop: 6 }}>
          across {monthEntries.length} {monthEntries.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
        {tiles.map(t => (
          <button key={t.label} onClick={() => go(t.go)} className="card" style={{ padding: 14, cursor: 'pointer', background: '#fff', textAlign: 'left' }}>
            <t.icon size={18} color="var(--moss)" />
            <div className="num serif" style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{t.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.label}</div>
          </button>
        ))}
      </div>

      <h2 className="serif" style={{ fontSize: 18, fontWeight: 700, margin: '18px 0 10px' }}>Quick actions</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        <button onClick={() => go('entry')} className="btn btn-primary" style={{ justifyContent: 'space-between', padding: '14px 18px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Plus size={18} /> New daily entry</span>
          <span style={{ opacity: .7, fontSize: 12 }}>→</span>
        </button>
        <button onClick={() => go('reports')} className="btn btn-ghost" style={{ justifyContent: 'space-between', padding: '14px 18px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><BarChart3 size={18} /> View monthly report</span>
          <span style={{ opacity: .5, fontSize: 12 }}>→</span>
        </button>
        <button onClick={() => go('masters')} className="btn btn-ghost" style={{ justifyContent: 'space-between', padding: '14px 18px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Boxes size={18} /> Manage vendors & items</span>
          <span style={{ opacity: .5, fontSize: 12 }}>→</span>
        </button>
      </div>
    </div>
  );
}

/* ─────────────  MASTERS  ───────────── */
function Masters({ store }) {
  const [sub, setSub] = useState('vendors');
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, padding: 4, background: 'var(--paper-2)', borderRadius: 12 }}>
        {[
          { k: 'vendors', label: 'Vendors', icon: Building2 },
          { k: 'items',   label: 'Items',   icon: Package },
          { k: 'notes',   label: 'Notes',   icon: StickyNote },
        ].map(t => (
          <button key={t.k} onClick={() => setSub(t.k)} style={{
            flex: 1, padding: '10px 8px', border: 'none', borderRadius: 9,
            background: sub === t.k ? '#fff' : 'transparent',
            boxShadow: sub === t.k ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
            color: sub === t.k ? 'var(--moss-dk)' : 'var(--muted)',
            fontWeight: sub === t.k ? 700 : 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13
          }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {sub === 'vendors' && <VendorMaster store={store} />}
      {sub === 'items'   && <ItemMaster store={store} />}
      {sub === 'notes'   && <NotesMaster store={store} />}
    </div>
  );
}

/* ─────────────  VENDOR MASTER  ───────────── */
function VendorMaster({ store }) {
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return store.vendors.filter(v => !s || v.name.toLowerCase().includes(s) || (v.contact || '').includes(s));
  }, [store.vendors, q]);

  const onSave = (v) => {
    if (editing?.id) {
      store.setVendors(store.vendors.map(x => x.id === v.id ? v : x));
    } else {
      store.setVendors([...store.vendors, { ...v, id: uid() }]);
    }
    setEditing(null);
  };

  const onDelete = (id) => {
    if (!window.confirm('Delete this vendor?')) return;
    store.setVendors(store.vendors.filter(v => v.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search vendors…" style={{ paddingLeft: 36 }} />
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}><Plus size={16} /> New</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} text="No vendors yet" hint="Tap “New” to add your first vendor." />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(v => (
            <div key={v.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="serif" style={{ fontWeight: 700, fontSize: 16 }}>{v.name}</div>
                {v.address && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{v.address}</div>}
                {v.postal && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Singapore {v.postal}</div>}
                {v.contact && <div style={{ fontSize: 13, color: 'var(--moss)', marginTop: 2, fontWeight: 600 }}>{fmtPhone(v.contact)}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                <IconBtn onClick={() => setEditing(v)} aria="Edit"><Edit2 size={15} /></IconBtn>
                <IconBtn onClick={() => onDelete(v.id)} aria="Delete" danger><Trash2 size={15} /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit Vendor' : 'New Vendor'} onClose={() => setEditing(null)}>
          <VendorForm vendor={editing} onSave={onSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function VendorForm({ vendor, onSave, onCancel }) {
  const [name, setName] = useState(vendor.name || '');
  const [postal, setPostal] = useState(vendor.postal || '');
  const [address, setAddress] = useState(vendor.address || '');
  const [contact, setContact] = useState(cleanPhone(vendor.contact));
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMsg, setLookupMsg] = useState('');

  const handlePostal = (raw) => {
    const code = raw.replace(/\D/g, '').slice(0, 6);
    setPostal(code);
    setLookupMsg('');
    if (code.length === 6) {
      setLookingUp(true);
      lookupPostal(code).then(addr => {
        setLookingUp(false);
        if (addr) {
          setAddress(addr);
          setLookupMsg('✓ Address found');
        } else {
          setLookupMsg('No match — enter address manually');
        }
      });
    }
  };

  const submit = () => {
    if (!name.trim()) { alert('Vendor name is required'); return; }
    onSave({
      ...vendor,
      name: name.trim(),
      postal: postal.trim(),
      address: address.trim(),
      contact: cleanPhone(contact),
    });
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div><label>Vendor name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tan Provisions Pte Ltd" autoFocus /></div>

      <div>
        <label>Postal code (Singapore)</label>
        <input value={postal} onChange={e => handlePostal(e.target.value)} placeholder="6 digits" inputMode="numeric" maxLength={6} />
        {lookingUp && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Looking up address…</div>}
        {!lookingUp && lookupMsg && (
          <div style={{ fontSize: 12, color: lookupMsg.startsWith('✓') ? 'var(--moss)' : 'var(--wine)', marginTop: 4 }}>{lookupMsg}</div>
        )}
      </div>

      <div><label>Address</label><textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} placeholder="Auto-filled from postal code" /></div>

      <div>
        <label>Contact no.</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--moss)', fontWeight: 700, pointerEvents: 'none', fontSize: 14 }}>+65</span>
          <input value={contact} onChange={e => setContact(cleanPhone(e.target.value))} placeholder="8-digit number" inputMode="numeric" maxLength={8} style={{ paddingLeft: 50 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} style={{ flex: 1 }}><Save size={15} /> Save</button>
      </div>
    </div>
  );
}

/* ─────────────  ITEM MASTER  ───────────── */
function ItemMaster({ store }) {
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return store.items.filter(i => !s || i.description.toLowerCase().includes(s));
  }, [store.items, q]);

  const onSave = (item) => {
    if (editing?.id) {
      store.setItems(store.items.map(x => x.id === item.id ? item : x));
    } else {
      store.setItems([...store.items, { ...item, id: uid() }]);
    }
    setEditing(null);
  };

  const onDelete = (id) => {
    if (!window.confirm('Delete this item?')) return;
    store.setItems(store.items.filter(i => i.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search items…" style={{ paddingLeft: 36 }} />
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}><Plus size={16} /> New</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} text="No items yet" hint="Add items you regularly purchase." />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(i => (
            <div key={i.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="serif" style={{ fontWeight: 700, fontSize: 16 }}>{i.description}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', fontSize: 13 }}>
                  <span style={{ background: 'var(--paper-2)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{i.uom}</span>
                  <span className="num" style={{ color: 'var(--moss)', fontWeight: 600 }}>{fmtMoney(i.price)} / {i.uom}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <IconBtn onClick={() => setEditing(i)} aria="Edit"><Edit2 size={15} /></IconBtn>
                <IconBtn onClick={() => onDelete(i.id)} aria="Delete" danger><Trash2 size={15} /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit Item' : 'New Item'} onClose={() => setEditing(null)}>
          <ItemForm item={editing} onSave={onSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function ItemForm({ item, onSave, onCancel }) {
  const [description, setDescription] = useState(item.description || '');
  const [uom, setUom] = useState(item.uom || UOM[0]);
  const [price, setPrice] = useState(item.price ?? '');

  const submit = () => {
    if (!description.trim()) { alert('Item description is required'); return; }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) { alert('Enter a valid unit price'); return; }
    onSave({ ...item, description: description.trim(), uom, price: p });
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div><label>Item description *</label><input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Basmati Rice" autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label>UOM</label>
          <select value={uom} onChange={e => setUom(e.target.value)}>
            {UOM.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label>Unit price *</label>
          <input value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" inputMode="decimal" type="number" min="0" step="0.01" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} style={{ flex: 1 }}><Save size={15} /> Save</button>
      </div>
    </div>
  );
}

/* ─────────────  NOTES  ───────────── */
function NotesMaster({ store }) {
  const [text, setText] = useState(store.notes);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setText(store.notes); }, [store.notes]);

  const save = () => {
    store.setNotes(text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
        Free-form notes — supplier reminders, payment terms, anything you want at hand.
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={12} placeholder="Type your notes here…" style={{ resize: 'vertical' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <button className="btn btn-primary" onClick={save}><Save size={15} /> Save notes</button>
        {saved && <span style={{ fontSize: 13, color: 'var(--moss)' }}>✓ Saved</span>}
      </div>
    </div>
  );
}

/* ─────────────  ENTRIES  ───────────── */
function Entries({ store }) {
  const [editing, setEditing] = useState(null);

  const sorted = useMemo(() =>
    [...store.entries].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [store.entries]);

  const onSave = (entry) => {
    if (entry.id) {
      store.setEntries(store.entries.map(e => e.id === entry.id ? entry : e));
    } else {
      store.setEntries([...store.entries, { ...entry, id: uid() }]);
    }
    setEditing(null);
  };

  const onDelete = (id) => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    store.setEntries(store.entries.filter(e => e.id !== id));
  };

  if (editing) {
    return <EntryForm
      entry={editing}
      vendors={store.vendors}
      items={store.items}
      onSave={onSave}
      onCancel={() => setEditing(null)} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Daily entries</h2>
        <button className="btn btn-primary" onClick={() => setEditing({})}><Plus size={16} /> New entry</button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={ClipboardList} text="No entries yet" hint="Start recording daily inventory purchases." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {sorted.map(e => {
            const total = e.lineItems.reduce((s, li) => s + (li.amount || 0), 0);
            const centers = [...new Set(e.lineItems.map(li => li.costCenter))];
            return (
              <div key={e.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{fmtDate(e.date)}</div>
                    <div className="serif" style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{e.vendorName}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {e.lineItems.length} item{e.lineItems.length !== 1 ? 's' : ''} · {centers.join(', ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num serif" style={{ fontWeight: 700, fontSize: 17, color: 'var(--moss-dk)' }}>{fmtMoney(total)}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
                      <IconBtn onClick={() => setEditing(e)} aria="Edit"><Edit2 size={14} /></IconBtn>
                      <IconBtn onClick={() => onDelete(e.id)} aria="Delete" danger><Trash2 size={14} /></IconBtn>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EntryForm({ entry, vendors, items, onSave, onCancel }) {
  const [date, setDate] = useState(entry.date || todayISO());
  const [vendorId, setVendorId] = useState(entry.vendorId || '');
  const [vendorName, setVendorName] = useState(entry.vendorName || '');
  const [vendorPostal, setVendorPostal] = useState(entry.vendorPostal || '');
  const [vendorAddress, setVendorAddress] = useState(entry.vendorAddress || '');
  const [vendorContact, setVendorContact] = useState(cleanPhone(entry.vendorContact));
  const [lookingUp, setLookingUp] = useState(false);
  const [lineItems, setLineItems] = useState(entry.lineItems?.length ? entry.lineItems : [newLine()]);

  function newLine() {
    return { id: uid(), itemId: '', description: '', uom: UOM[0], unitPrice: 0, qty: '', amount: 0, costCenter: COST_CENTERS[0], isCustom: false };
  }

  const pickVendor = (id) => {
    setVendorId(id);
    const v = vendors.find(x => x.id === id);
    if (v) {
      setVendorName(v.name);
      setVendorPostal(v.postal || '');
      setVendorAddress(v.address || '');
      setVendorContact(cleanPhone(v.contact));
    }
  };

  const handlePostal = (raw) => {
    const code = raw.replace(/\D/g, '').slice(0, 6);
    setVendorPostal(code);
    if (code.length === 6) {
      setLookingUp(true);
      lookupPostal(code).then(addr => {
        setLookingUp(false);
        if (addr) setVendorAddress(addr);
      });
    }
  };

  const updateLine = (idx, patch) => {
    setLineItems(prev => prev.map((li, i) => {
      if (i !== idx) return li;
      const merged = { ...li, ...patch };
      const qty = parseFloat(merged.qty);
      const price = parseFloat(merged.unitPrice);
      merged.amount = (!isNaN(qty) && !isNaN(price)) ? +(qty * price).toFixed(2) : 0;
      return merged;
    }));
  };

  const pickItem = (idx, itemId) => {
    if (itemId === '__custom__') {
      updateLine(idx, { itemId: '', description: '', uom: UOM[0], unitPrice: 0, isCustom: true });
      return;
    }
    const it = items.find(x => x.id === itemId);
    if (it) {
      updateLine(idx, { itemId, description: it.description, uom: it.uom, unitPrice: it.price, isCustom: false });
    } else {
      updateLine(idx, { itemId: '', description: '', uom: UOM[0], unitPrice: 0, isCustom: false });
    }
  };

  const addLine = () => setLineItems([...lineItems, newLine()]);
  const removeLine = (idx) => setLineItems(lineItems.filter((_, i) => i !== idx));

  const total = lineItems.reduce((s, li) => s + (li.amount || 0), 0);

  const submit = () => {
    if (!vendorName.trim()) { alert('Pick or enter a vendor'); return; }
    const valid = lineItems.filter(li => li.description.trim() && parseFloat(li.qty) > 0);
    if (!valid.length) { alert('Add at least one item with a quantity'); return; }
    onSave({
      id: entry.id,
      date, vendorId, vendorName: vendorName.trim(),
      vendorPostal: vendorPostal.trim(),
      vendorAddress: vendorAddress.trim(),
      vendorContact: cleanPhone(vendorContact),
      lineItems: valid,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-ghost" onClick={onCancel} style={{ padding: 8 }}><ArrowLeft size={16} /></button>
        <h2 className="serif" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {entry.id ? 'Edit entry' : 'New entry'}
        </h2>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 14, display: 'grid', gap: 12 }}>
        <div><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>

        <div>
          <label>Vendor</label>
          <select value={vendorId} onChange={e => pickVendor(e.target.value)}>
            <option value="">— Select vendor —</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {!vendorId && (
          <div><label>Vendor name (manual)</label>
            <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Type vendor name" />
          </div>
        )}

        <div>
          <label>Postal code</label>
          <input value={vendorPostal} onChange={e => handlePostal(e.target.value)} placeholder="6 digits — address auto-fills" inputMode="numeric" maxLength={6} />
          {lookingUp && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Looking up address…</div>}
        </div>

        <div><label>Address</label>
          <textarea value={vendorAddress} onChange={e => setVendorAddress(e.target.value)} rows={2} placeholder="Auto-filled from postal code" />
        </div>

        <div>
          <label>Contact no.</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--moss)', fontWeight: 700, pointerEvents: 'none', fontSize: 14 }}>+65</span>
            <input value={vendorContact} onChange={e => setVendorContact(cleanPhone(e.target.value))} placeholder="8-digit number" inputMode="numeric" maxLength={8} style={{ paddingLeft: 50 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 4px 8px' }}>
        <h3 className="serif" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Items</h3>
        <button className="btn btn-ghost" onClick={addLine} style={{ padding: '6px 12px', fontSize: 13 }}><Plus size={14} /> Add item</button>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {lineItems.map((li, idx) => (
          <div key={li.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Item #{idx + 1}</span>
              {lineItems.length > 1 && (
                <IconBtn onClick={() => removeLine(idx)} aria="Remove" danger><X size={14} /></IconBtn>
              )}
            </div>

            <select
              value={li.isCustom ? '__custom__' : li.itemId}
              onChange={e => pickItem(idx, e.target.value)}
              style={{ marginBottom: 8 }}
            >
              <option value="">— Select item —</option>
              {items.map(it => <option key={it.id} value={it.id}>{it.description}</option>)}
              <option value="__custom__">✎ Custom (manual entry)</option>
            </select>

            {(li.isCustom || (!li.itemId && li.description)) && (
              <input
                value={li.description}
                onChange={e => updateLine(idx, { description: e.target.value })}
                placeholder="Custom item name"
                style={{ marginBottom: 8 }}
              />
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr 1fr 1.1fr 1.2fr',
              gap: 6,
              alignItems: 'end',
            }}>
              <Field label="UOM">
                <select value={li.uom} onChange={e => updateLine(idx, { uom: e.target.value })} style={compactInput}>
                  {UOM.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Price">
                <input value={li.unitPrice} onChange={e => updateLine(idx, { unitPrice: e.target.value })} type="number" min="0" step="0.01" inputMode="decimal" style={compactInput} />
              </Field>
              <Field label="Qty">
                <input value={li.qty} onChange={e => updateLine(idx, { qty: e.target.value })} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" style={compactInput} />
              </Field>
              <Field label="Amount">
                <input value={fmtMoney(li.amount)} readOnly style={{ ...compactInput, background: 'var(--paper-2)', fontWeight: 700, color: 'var(--moss-dk)' }} />
              </Field>
              <Field label="Cost">
                <select value={li.costCenter} onChange={e => updateLine(idx, { costCenter: e.target.value })} style={compactInput}>
                  {COST_CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14, background: 'var(--moss)', color: '#faf6ee', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>Total</span>
        <span className="serif num" style={{ fontSize: 24, fontWeight: 700 }}>{fmtMoney(total)}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} style={{ flex: 2 }}><Save size={15} /> Save entry</button>
      </div>
    </div>
  );
}

/* ─────────────  REPORTS  ───────────── */
function Reports({ store }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [center, setCenter] = useState('All');

  const rows = useMemo(() => {
    const mk = `${year}-${String(month + 1).padStart(2, '0')}`;
    const out = [];
    store.entries
      .filter(e => monthKey(e.date) === mk)
      .forEach(e => {
        e.lineItems.forEach(li => {
          if (center !== 'All' && li.costCenter !== center) return;
          out.push({
            date: e.date, vendorName: e.vendorName,
            description: li.description, uom: li.uom,
            qty: parseFloat(li.qty) || 0, amount: li.amount || 0,
            costCenter: li.costCenter,
          });
        });
      });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [store.entries, year, month, center]);

  const totals = useMemo(() => {
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    const rest = rows.filter(r => r.costCenter === 'Restaurant').reduce((s, r) => s + r.amount, 0);
    const cat  = rows.filter(r => r.costCenter === 'Catering').reduce((s, r) => s + r.amount, 0);
    return { sum, rest, cat };
  }, [rows]);

  const filename = `inventory_${MONTHS[month]}_${year}${center !== 'All' ? '_' + center : ''}`;

  const exportExcel = () => {
    if (!rows.length) { alert('No data to export'); return; }
    const data = rows.map(r => ({
      Date: fmtDate(r.date), Vendor: r.vendorName, Item: r.description,
      UOM: r.uom, Quantity: r.qty, Amount: r.amount, 'Cost Center': r.costCenter,
    }));
    data.push({});
    data.push({ Item: 'TOTAL', Amount: totals.sum });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[month]} ${year}`);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportPDF = () => {
    if (!rows.length) { alert('No data to export'); return; }
    window.print();
  };

  const buildSummaryText = () => {
    const lines = [
      `📋 Inventory Report — ${MONTHS[month]} ${year}`,
      `Cost Center: ${center}`,
      `Entries: ${rows.length}`,
      '',
      `Total: ${fmtMoney(totals.sum)}`,
      `Restaurant: ${fmtMoney(totals.rest)}`,
      `Catering: ${fmtMoney(totals.cat)}`,
      '',
      '— Items —',
      ...rows.slice(0, 30).map(r =>
        `${fmtDate(r.date)} · ${r.description} (${r.qty} ${r.uom}) — ${fmtMoney(r.amount)} [${r.costCenter}]`
      ),
      rows.length > 30 ? `…and ${rows.length - 30} more` : '',
    ].filter(Boolean);
    return lines.join('\n');
  };

  const shareWhatsApp = () => {
    if (!rows.length) { alert('No data to share'); return; }
    const text = encodeURIComponent(buildSummaryText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareEmail = () => {
    if (!rows.length) { alert('No data to share'); return; }
    const subject = encodeURIComponent(`Inventory Report — ${MONTHS[month]} ${year}`);
    const body = encodeURIComponent(buildSummaryText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareNative = async () => {
    if (!rows.length) { alert('No data to share'); return; }
    if (navigator.share) {
      try {
        await navigator.share({ title: `Inventory ${MONTHS[month]} ${year}`, text: buildSummaryText() });
      } catch {}
    } else {
      shareWhatsApp();
    }
  };

  const years = useMemo(() => {
    const ys = new Set([now.getFullYear()]);
    store.entries.forEach(e => { if (e.date) ys.add(parseInt(e.date.slice(0, 4))); });
    return [...ys].sort((a, b) => b - a);
  }, [store.entries, now]);

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>Monthly report</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div>
            <label>Month</label>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label>Year</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label>Cost</label>
            <select value={center} onChange={e => setCenter(e.target.value)}>
              <option value="All">All</option>
              {COST_CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button className="btn btn-ghost" onClick={exportExcel} style={{ flexShrink: 0, fontSize: 13 }}>
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button className="btn btn-ghost" onClick={exportPDF} style={{ flexShrink: 0, fontSize: 13 }}>
            <Printer size={15} /> PDF
          </button>
          <button className="btn btn-ghost" onClick={shareWhatsApp} style={{ flexShrink: 0, fontSize: 13 }}>
            <MessageCircle size={15} /> WhatsApp
          </button>
          <button className="btn btn-ghost" onClick={shareEmail} style={{ flexShrink: 0, fontSize: 13 }}>
            <Mail size={15} /> Email
          </button>
          <button className="btn btn-ghost" onClick={shareNative} style={{ flexShrink: 0, fontSize: 13 }}>
            <Share2 size={15} /> Share
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 14, background: '#fff' }}>
        <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
          {MONTHS[month]} {year} · {center}
        </div>
        <div className="serif num" style={{ fontSize: 30, fontWeight: 700, margin: '4px 0 12px', color: 'var(--moss-dk)' }}>
          {fmtMoney(totals.sum)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ padding: '10px 12px', background: 'var(--paper-2)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--moss-dk)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Restaurant</div>
            <div className="num serif" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{fmtMoney(totals.rest)}</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--paper-2)', borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--wine)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Catering</div>
            <div className="num serif" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{fmtMoney(totals.cat)}</div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} text="No data for this period" hint="Try a different month or cost center." />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: 'var(--paper-2)' }}>
                <tr>
                  <Th>Date</Th><Th>Item</Th><Th>UOM</Th>
                  <Th right>Qty</Th><Th right>Amount</Th><Th>Cost</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                    <Td><span className="num">{fmtDate(r.date)}</span></Td>
                    <Td><div style={{ fontWeight: 600 }}>{r.description}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.vendorName}</div></Td>
                    <Td>{r.uom}</Td>
                    <Td right><span className="num">{r.qty}</span></Td>
                    <Td right><span className="num" style={{ fontWeight: 600 }}>{fmtMoney(r.amount)}</span></Td>
                    <Td><span className={r.costCenter === 'Restaurant' ? 'pill pill-rest' : 'pill pill-cat'}>{r.costCenter[0]}</span></Td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: 'var(--paper-2)', fontWeight: 700 }}>
                <tr>
                  <Td colSpan={4} right><strong>TOTAL</strong></Td>
                  <Td right><span className="num serif" style={{ fontSize: 15 }}>{fmtMoney(totals.sum)}</span></Td>
                  <Td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────  UI HELPERS  ───────────── */
const compactInput = { padding: '8px 8px', fontSize: 13, borderRadius: 8 };

function Field({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={{ fontSize: 10, marginBottom: 3, letterSpacing: '.05em' }}>{label}</label>
      {children}
    </div>
  );
}
function Th({ children, right }) {
  return <th style={{ padding: '10px 12px', textAlign: right ? 'right' : 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}
function Td({ children, right, colSpan }) {
  return <td colSpan={colSpan} style={{ padding: '10px 12px', textAlign: right ? 'right' : 'left', verticalAlign: 'top' }}>{children}</td>;
}
function IconBtn({ children, onClick, aria, danger }) {
  return (
    <button onClick={onClick} aria-label={aria} style={{
      width: 32, height: 32, padding: 0, borderRadius: 8,
      background: 'transparent', border: '1px solid var(--line)',
      cursor: 'pointer', color: danger ? 'var(--wine)' : 'var(--ink)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
    }}>{children}</button>
  );
}
function EmptyState({ icon: Icon, text, hint }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 14 }}>
      <Icon size={32} color="var(--muted)" />
      <div className="serif" style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>{text}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{hint}</div>
    </div>
  );
}
function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,29,26,.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, padding: 0,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 520, padding: 20,
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 -20px 60px rgba(0,0,0,.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="serif" style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--muted)' }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
